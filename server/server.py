"""
server.py — FastAPI application for ConnectQ emotion-sensing comfort device.

Receives sensor data from the giver Arduino via WebSocket, processes it through
signal_processor and emotion_inference, and sends servo commands to the receiver.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from openai import OpenAI
from hume import HumeClient
from hume.expression_measurement.batch.types import InferenceBaseRequest, Models, Prosody, Language
import asyncio
import shutil
import json
import os
import time
import logging
from datetime import datetime

from signal_processor import SignalProcessor, write_input, INPUT_PATH
from emotion_inference import run_inference

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
hume_client = HumeClient(api_key=os.getenv("HUME_API_KEY"))

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
STATIC_DIR = os.path.join(BASE_DIR, "static")
AUDIO_DIR = os.path.join(DATA_DIR, "received_audio")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)

voice_path = os.path.join(DATA_DIR, "voice_data.json")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Track connected Arduinos by name
connected_arduinos: dict[str, WebSocket] = {}

_last_pipeline_time: float = 0.0
PIPELINE_COOLDOWN = 2.0  # seconds between pipeline runs


async def run_pipeline(priority: bool = False) -> None:
    """Run emotion inference and send result to the receiver Arduino.

    priority=True bypasses the cooldown (used for touch and voice triggers).
    """
    global _last_pipeline_time
    now = time.time()
    if not priority and now - _last_pipeline_time < PIPELINE_COOLDOWN:
        logger.debug("cooldown active, skipping (%.1fs between runs)", PIPELINE_COOLDOWN)
        return
    _last_pipeline_time = now

    try:
        with open(INPUT_PATH) as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.error("could not read input_data.json: %s", e)
        return

    logger.info("running emotion inference...")
    try:
        result = await asyncio.to_thread(run_inference, data, client)
    except ValueError as e:
        logger.error("emotion inference failed: %s", e)
        return

    logger.info("emotion inference done: %s %dμs", result.get("emotion"), result.get("microseconds", 0))

    receiver = connected_arduinos.get("receiver")
    if receiver:
        await receiver.send_text(json.dumps(result))
        logger.info("sent to receiver: %s", result.get("emotion"))
    else:
        logger.info("receiver not connected, result ready but not sent")


def _on_signal_write(output: dict) -> None:
    """Callback from SignalProcessor — write file and schedule pipeline."""
    write_input(output)
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(run_pipeline())
    except RuntimeError:
        pass


processor = SignalProcessor(write_fn=_on_signal_write)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, name: str = Query("unknown")):
    await websocket.accept()
    connected_arduinos[name] = websocket
    logger.info("Arduino '%s' connected. Total: %d", name, len(connected_arduinos))
    try:
        while True:
            data = await websocket.receive_text()
            logger.debug("[%s] received: %s", name, data)
            try:
                raw = json.loads(data)
                if "speed" in raw and (name == "giver" or raw.get("device") == "giver"):
                    processor.process_packet(raw)
                    if raw.get("touch"):
                        asyncio.create_task(run_pipeline(priority=True))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        connected_arduinos.pop(name, None)
        logger.info("Arduino '%s' disconnected. Total: %d", name, len(connected_arduinos))


@app.post("/send_output")
async def send_output():
    output_path = os.path.join(DATA_DIR, "output.json")
    if not os.path.exists(output_path):
        return {"status": "error", "message": "output.json not found"}

    with open(output_path) as f:
        result = json.load(f)

    receiver = connected_arduinos.get("receiver")
    if receiver:
        await receiver.send_text(json.dumps(result))
        return {"status": "sent", "result": result}
    else:
        return {"status": "receiver_not_connected", "result": result}


def _extract_hume_emotions(job_predictions) -> tuple[list[dict], str]:
    """Extract top emotions from Hume job predictions.

    Returns:
        (top_emotions, transcript) where top_emotions is a list of
        {"name": str, "score": float} sorted by score descending.
    """
    top_emotions = []
    transcript = ""

    for source in job_predictions:
        for result in source.results.predictions:
            # Extract prosody emotions
            if result.models.prosody and result.models.prosody.grouped_predictions:
                for group in result.models.prosody.grouped_predictions:
                    for pred in group.predictions:
                        emotions = sorted(
                            [{"name": e.name, "score": round(e.score, 4)} for e in pred.emotions],
                            key=lambda x: x["score"],
                            reverse=True,
                        )
                        if not top_emotions or emotions[0]["score"] > top_emotions[0]["score"]:
                            top_emotions = emotions

            # Extract transcript from language model
            if result.models.language and result.models.language.grouped_predictions:
                for group in result.models.language.grouped_predictions:
                    for pred in group.predictions:
                        if pred.text:
                            transcript = pred.text

    return top_emotions, transcript


# Map Hume's 48 emotion names to our simplified sentiment categories
HUME_TO_SENTIMENT = {
    "Joy": "happy", "Amusement": "happy", "Excitement": "happy",
    "Interest": "happy", "Pride": "happy", "Triumph": "happy",
    "Admiration": "love", "Adoration": "love", "Love": "love",
    "Desire": "love", "Romance": "love",
    "Sadness": "sad", "Disappointment": "sad", "Distress": "sad",
    "Nostalgia": "sad", "Empathic Pain": "sad",
    "Anger": "mad", "Contempt": "mad", "Disgust": "mad",
    "Annoyance": "mad",
    "Anxiety": "anxious", "Fear": "anxious", "Horror": "anxious",
    "Awkwardness": "anxious", "Confusion": "anxious",
    "Calmness": "calm", "Contentment": "calm", "Relief": "calm",
    "Satisfaction": "calm", "Serenity": "calm",
}


def _hume_to_sentiment(emotion_name: str) -> str:
    return HUME_TO_SENTIMENT.get(emotion_name, "neutral")


@app.post("/upload_audio")
async def upload_audio(file: UploadFile = File(...)):
    filename = os.path.join(AUDIO_DIR, f"{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.webm")
    with open(filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    logger.info("saved audio: %s", filename)

    # Analyze with Hume Expression Measurement API (prosody + language)
    try:
        job_id = await asyncio.to_thread(
            lambda: hume_client.expression_measurement.batch.start_inference_job_from_local_file(
                file=[filename],
                json=InferenceBaseRequest(
                    models=Models(prosody=Prosody(), language=Language()),
                ),
            )
        )
        # Poll for completion
        for _ in range(60):  # max 60s
            details = await asyncio.to_thread(
                lambda: hume_client.expression_measurement.batch.get_job_details(job_id)
            )
            if details.state.status == "COMPLETED":
                break
            if details.state.status == "FAILED":
                raise RuntimeError(f"Hume job failed: {details.state}")
            await asyncio.sleep(1)
        else:
            raise RuntimeError("Hume job timed out after 60s")

        predictions = await asyncio.to_thread(
            lambda: hume_client.expression_measurement.batch.get_job_predictions(job_id)
        )
        top_emotions, transcript = _extract_hume_emotions(predictions)
    except Exception as e:
        logger.error("Hume API error: %s", e)
        return {"status": "error", "message": str(e)}

    if not top_emotions:
        logger.warning("no emotions detected in audio")
        return {"status": "error", "message": "no emotions detected"}

    top_emotion = top_emotions[0]
    sentiment = _hume_to_sentiment(top_emotion["name"])
    top_3 = top_emotions[:3]

    logger.info("Hume top emotion: %s (%.3f), sentiment: %s",
                top_emotion["name"], top_emotion["score"], sentiment)
    logger.info("Hume top 3: %s", top_3)

    voice_data = {
        "transcript": transcript,
        "sentiment": sentiment,
        "emotion": top_emotion["name"],
        "emotion_score": top_emotion["score"],
        "top_emotions": top_3,
    }

    with open(voice_path, "w") as f:
        json.dump(voice_data, f, indent=2)

    try:
        with open(INPUT_PATH) as f:
            existing = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        existing = {"speed": 0.0, "temperature": None, "touch": False}

    output = {
        "voice": voice_data,
        "speed": existing.get("speed", 0.0),
        "temperature": existing.get("temperature"),
        "touch": existing.get("touch", False),
    }
    write_input(output)
    logger.info("wrote input_data.json — triggering pipeline (priority)")
    asyncio.create_task(run_pipeline(priority=True))

    return {
        "status": "received",
        "filename": filename,
        "transcript": transcript,
        "emotion": top_emotion["name"],
        "emotion_score": top_emotion["score"],
        "sentiment": sentiment,
        "top_emotions": top_3,
    }
