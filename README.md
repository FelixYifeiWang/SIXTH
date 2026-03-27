# ConnectQ

A wearable comfort device that senses your emotional state and responds with gentle servo movement.

Sensors (motion, temperature, touch) feed into a Python server that uses GPT-4 to infer emotion and output a servo speed — fast for agitation, slow for calm.

## Architecture

```
SENSOR ARDUINO ──WebSocket──> SERVER (Python) ──WebSocket──> MOTOR ARDUINO
   "giver"                    FastAPI + GPT-4                  "receiver"
```

**The loop:**

1. **Arduino** (`firmware/sketch/sketch.ino`) reads gyroscope (ICM20600), temperature (MAX31875), and touch button every 500ms
2. **Bridge** (`firmware/bridge/sender.py`) forwards sensor packets to the server via WebSocket
3. **Server** (`server/server.py`) receives packets and passes them to signal processing
4. **Signal processor** (`server/signal_processor.py`) buffers readings (10 speed samples, 25 temp samples), characterizes each as a magnitude + pattern (`constant` / `increasing` / `decreasing` / `variable`), and only writes `data/input_data.json` when the pattern or magnitude actually changes (>20% shift). Touch bypasses buffering and triggers immediately.
5. **Emotion inference** (`server/emotion_inference.py`) is called directly by the server with parsed sensor data, prompts GPT-4.1-mini, and returns an emotion label and a microseconds value (500 = fast/intense, 2500 = slow/gentle)
6. **Server** sends the result to the receiver Arduino, which drives the servo

## Project Structure

```
ConnectQ/
├── web/                               # Vercel-deployable frontend (static site)
│   ├── index.html                     # Dashboard UI — set CONNECTQ_API_URL here
│   ├── css/style.css                  # All styles
│   └── js/app.js                      # Client logic + WebSocket + configurable backend
├── vercel.json                        # Vercel deployment config
│
├── server/
│   ├── server.py                      # FastAPI — WebSocket, endpoints, pipeline orchestration
│   ├── signal_processor.py            # Buffers sensor data, detects trends via SignalProcessor class
│   ├── emotion_inference.py           # Importable module — run_inference() calls GPT-4
│   ├── requirements.txt               # Python dependencies
│   ├── static/                        # Local dev frontend (served by FastAPI)
│   │   ├── index.html
│   │   ├── css/style.css
│   │   └── js/app.js
│   ├── tests/
│   │   ├── test_signal_processor.py   # Unit test — fake sensor stream
│   │   └── test_stream.py            # Integration test — fake packets over WebSocket
│   └── data/                          # Runtime artifacts (gitignored)
│
└── firmware/
    ├── sketch/sketch.ino            # Arduino firmware — reads IMU, temp, touch
    ├── sketch/sketch.yaml           # Arduino library dependencies
    ├── bridge/sender.py             # Forwards Arduino packets to server
    ├── bridge/receiver.py           # Receives servo commands from server
    └── app.yaml                     # Arduino App metadata
```

## Setup

```bash
# 1. Install dependencies
cd server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 2. Set API key
echo "OPENAI_API_KEY=sk-your-key" > .env

# 3. Start server
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000

# 4. Connect sensor Arduino (separate terminal)
cd firmware/bridge && python sender.py
```

Flash `firmware/sketch/sketch.ino` to your Arduino (arduino:zephyr platform, libraries in `sketch.yaml`). Open `http://localhost:8000` for the dashboard.

## Deploy Frontend to Vercel

The `web/` directory is a standalone static site that connects to your backend via WebSocket.

```bash
# 1. Set your backend URL in web/index.html
#    Edit the config block: window.CONNECTQ_API_URL = "https://your-ngrok-url.ngrok-free.dev";

# 2. Deploy to Vercel
npm i -g vercel
vercel --prod

# 3. Start your backend with ngrok (separate machine/terminal)
cd server && python -m uvicorn server:app --host 0.0.0.0 --port 8000
ngrok http 8000
```

The frontend auto-connects to the backend via WebSocket and receives live emotion updates. If no backend is available, it shows mock demo data.

## Tests

```bash
cd server
python tests/test_signal_processor.py          # unit test (no server needed)
python tests/test_stream.py --port 8000        # integration test (server must be running)
```
