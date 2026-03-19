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


@app.post("/upload_audio")
async def upload_audio(file: UploadFile = File(...)):
    filename = os.path.join(AUDIO_DIR, f"{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.webm")
    with open(filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    logger.info("saved audio: %s", filename)

    with open(filename, "rb") as audio_file:
        transcription = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
        )
    transcript = transcription.text
    logger.info("transcript: %s", transcript)

    sentiment_response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": f"Classify the sentiment of this text into exactly one word from this list: happy, sad, mad, love, anxious, neutral. Reply with only the one word.\n\nText: \"{transcript}\""}],
        temperature=0,
    )
    sentiment = sentiment_response.choices[0].message.content.strip().lower()
    logger.info("sentiment: %s", sentiment)

    with open(voice_path, "w") as f:
        json.dump({"transcript": transcript, "sentiment": sentiment}, f, indent=2)

    try:
        with open(INPUT_PATH) as f:
            existing = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        existing = {"speed": 0.0, "temperature": None, "touch": False}

    output = {
        "voice": {"transcript": transcript, "sentiment": sentiment},
        "speed": existing.get("speed", 0.0),
        "temperature": existing.get("temperature"),
        "touch": existing.get("touch", False),
    }
    write_input(output)
    logger.info("wrote input_data.json — triggering pipeline (priority)")
    asyncio.create_task(run_pipeline(priority=True))

    return {"status": "received", "filename": filename, "transcript": transcript, "sentiment": sentiment}
