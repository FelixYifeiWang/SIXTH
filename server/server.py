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
from hug_trigger import HugTrigger

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
    allow_origin_regex=r".*",
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
hug_trigger = HugTrigger()


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


def _extract_emotions(model_result):
    """Extract (name, score) pairs from a Hume model result."""
    if not model_result:
        return []
    preds = getattr(model_result, "predictions", None)
    if not preds or len(preds) == 0:
        return []
    emo_list = getattr(preds[0], "emotions", None)
    if not emo_list:
        return []
    return [(e.name, e.score) for e in emo_list]


@app.websocket("/ws/voice")
async def voice_stream(websocket: WebSocket):
    """Real-time voice emotion streaming.

    Browser sends base64-encoded webm audio chunks via WebSocket.
    Server sends to Hume streaming API and returns emotion results.
    Auto-reconnects to Hume if the connection drops.
    """
    import base64
    import tempfile

    logger.info("Voice stream from origin: %s", websocket.headers.get("origin", "unknown"))
    await websocket.accept()

    hume_ctx = None
    hume_socket = None

    async def connect_hume():
        nonlocal hume_ctx, hume_socket
        try:
            hume_ctx = hume_client.expression_measurement.stream.connect()
            hume_socket = await hume_ctx.__aenter__()
            logger.info("Connected to Hume streaming API")
        except Exception as e:
            logger.error("Failed to connect to Hume: %s", e)
            hume_socket = None

    async def close_hume():
        nonlocal hume_ctx, hume_socket
        if hume_ctx:
            try:
                await hume_ctx.__aexit__(None, None, None)
            except Exception:
                pass
        hume_ctx = None
        hume_socket = None

    await connect_hume()

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "stop":
                break

            if msg.get("type") != "audio":
                continue

            # Decode and save audio chunk
            audio_bytes = base64.b64decode(msg["data"])
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            try:
                # Reconnect if needed
                if hume_socket is None:
                    await connect_hume()
                if hume_socket is None:
                    continue

                # Send to Hume
                try:
                    result = await hume_socket.send_file(
                        file_=tmp_path,
                        config=Config(prosody={}, burst={}),
                    )
                except Exception as e:
                    logger.warning("Hume send failed, will reconnect: %s", e)
                    await close_hume()
                    continue

                # Check for error
                if hasattr(result, "error") and result.error:
                    logger.warning("Hume error: %s", result.error)
                    continue

                # Fuse emotions from prosody + burst
                fused = {}
                sources = []

                for name, score in _extract_emotions(getattr(result, "prosody", None)):
                    sources.append("prosody") if "prosody" not in sources else None
                    fused[name] = fused.get(name, 0) + score * 0.9

                for name, score in _extract_emotions(getattr(result, "burst", None)):
                    sources.append("burst") if "burst" not in sources else None
                    fused[name] = fused.get(name, 0) + score * 0.1

                if not fused:
                    continue

                emotions = sorted(
                    [{"name": k, "score": round(v, 4)} for k, v in fused.items()],
                    key=lambda x: x["score"],
                    reverse=True,
                )
                top = emotions[0]
                sentiment = HUME_TO_SENTIMENT.get(top["name"], "neutral")

                logger.info("Emotion: %s (%.3f) [%s]",
                            top["name"], top["score"], "+".join(sources))

                # Send emotion to browser
                await websocket.send_text(json.dumps({
                    "type": "emotion",
                    "emotion": top["name"],
                    "score": top["score"],
                    "sentiment": sentiment,
                    "top_emotions": emotions[:3],
                    "sources": sources,
                }))

                # Check hug trigger
                trigger_event = hug_trigger.check(emotions)
                if trigger_event:
                    await websocket.send_text(json.dumps({
                        "type": "trigger",
                        "emotion": trigger_event.emotion,
                        "category": trigger_event.category,
                        "microseconds": trigger_event.microseconds,
                        "confidence": trigger_event.confidence,
                    }))
                    receiver = connected_arduinos.get("receiver")
                    if receiver:
                        await receiver.send_text(json.dumps({
                            "microseconds": trigger_event.microseconds,
                            "emotion": trigger_event.emotion,
                        }))

            finally:
                os.unlink(tmp_path)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("Voice stream error: %s", e)
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass

    await close_hume()
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
