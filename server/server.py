"""
server.py — FastAPI application for ConnectQ emotion-sensing comfort device.

Receives sensor data from the giver Arduino via WebSocket, processes it through
signal_processor and emotion_inference, and sends servo commands to the receiver.
Streams audio to Hume AI for real-time voice emotion detection.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from openai import OpenAI
from hume import AsyncHumeClient
from hume.expression_measurement.stream.stream.types import Config
import asyncio
import json
import os
import time
import logging

from signal_processor import SignalProcessor, write_input, INPUT_PATH
from emotion_inference import run_inference

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
hume_client = AsyncHumeClient(api_key=os.getenv("HUME_API_KEY"))

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
STATIC_DIR = os.path.join(BASE_DIR, "static")

os.makedirs(DATA_DIR, exist_ok=True)

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
PIPELINE_COOLDOWN = 2.0


async def run_pipeline(priority: bool = False) -> None:
    """Run emotion inference and send result to the receiver Arduino."""
    global _last_pipeline_time
    now = time.time()
    if not priority and now - _last_pipeline_time < PIPELINE_COOLDOWN:
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


def _on_signal_write(output: dict) -> None:
    """Callback from SignalProcessor — write file and schedule pipeline."""
    write_input(output)
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(run_pipeline())
    except RuntimeError:
        pass


processor = SignalProcessor(write_fn=_on_signal_write)


# Map Hume's emotion names to simplified sentiment categories
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


@app.websocket("/ws/voice")
async def voice_stream(websocket: WebSocket):
    """Real-time voice emotion streaming.

    Browser sends base64-encoded audio chunks via WebSocket.
    Server proxies to Hume's streaming API and sends back emotion results.
    """
    await websocket.accept()
    logger.info("Voice stream connected")

    try:
        async with hume_client.expression_measurement.stream.connect(
            config=Config(prosody={})
        ) as hume_socket:
            logger.info("Connected to Hume streaming API")

            async def receive_from_browser():
                """Receive audio chunks from browser and forward to Hume."""
                try:
                    while True:
                        data = await websocket.receive_text()
                        msg = json.loads(data)

                        if msg.get("type") == "audio":
                            # Forward base64 audio to Hume (SDK accepts b64 strings directly)
                            result = await hume_socket.send_file(
                                file_=msg["data"],
                                config=Config(prosody={}),
                            )

                            # Extract top emotions from result
                            if hasattr(result, "prosody") and result.prosody:
                                predictions = result.prosody.predictions
                                if predictions:
                                    emotions = sorted(
                                        [{"name": e.name, "score": round(e.score, 4)}
                                         for e in predictions[0].emotions],
                                        key=lambda x: x["score"],
                                        reverse=True,
                                    )
                                    top_3 = emotions[:3]
                                    top = emotions[0]
                                    sentiment = HUME_TO_SENTIMENT.get(top["name"], "neutral")

                                    await websocket.send_text(json.dumps({
                                        "type": "emotion",
                                        "emotion": top["name"],
                                        "score": top["score"],
                                        "sentiment": sentiment,
                                        "top_emotions": top_3,
                                    }))

                        elif msg.get("type") == "stop":
                            break
                except WebSocketDisconnect:
                    pass

            await receive_from_browser()

    except Exception as e:
        logger.error("Voice stream error: %s", e)
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass

    logger.info("Voice stream disconnected")


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
