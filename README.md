# SIXTH

A wearable biosignal companion for high-altitude expeditions and everyday life. Sensors feed a Python server that infers emotional/physiological state via GPT and drives a servo "hug" response on a paired device. The mobile app visualizes live metrics, alerts, and expedition progress.

## Architecture

```
SENSOR ARDUINO ──WebSocket──> SERVER (Python) ──WebSocket──> MOTOR ARDUINO
   "giver"                  FastAPI + GPT                    "receiver"
                                    │
                                    └──> MOBILE (React Native / Expo)
```

**The loop:**

1. **Arduino** (`firmware/sketch/sketch.ino`) reads gyroscope (ICM20600), temperature (MAX31875), and touch button every 500ms
2. **Bridge** (`firmware/bridge/sender.py`) forwards sensor packets to the server via WebSocket
3. **Server** (`server/server.py`) receives packets and passes them to signal processing
4. **Signal processor** (`server/signal_processor.py`) buffers readings, characterizes them as magnitude + pattern (`constant` / `increasing` / `decreasing` / `variable`), and only writes `data/input_data.json` when the pattern or magnitude shifts meaningfully. Touch bypasses buffering.
5. **Emotion inference** (`server/emotion_inference.py`) prompts GPT-4.1-mini with parsed sensor data and returns an emotion label plus a microseconds value (500 = fast/intense, 2500 = slow/gentle)
6. **Hug trigger** (`server/hug_trigger.py`) applies a time-window frequency check over sustained emotional signals before firing
7. **Receiver Arduino** drives the servo with the returned microseconds value

## Mobile app

The Expo app (`mobile/`) is a dashboard for the wearable. It runs fully on simulated data out of the box — no server required.

Features:
- **SIXTH branding** with two palettes — **Daily** (cool blue) and **Extreme** (warm amber) — toggled via the mode switch, with a loading transition when entering Extreme
- **Scenario presets** — swipe left/right to cycle through expedition and training scenarios (Mt. Rainier summit, Island Peak, etc.), onboarding, journey map, session feedback, and stamp-wall interstitials
- **Live simulation** — metric values and sparklines tick over time, seeded from the active preset
- **Body map** heat visualization for applicable scenarios
- **Alert cards** — sensor-accurate codes (E1–E4 extreme, D1–D4 daily) driven by metric thresholds
- **Expedition hero** — altitude, weather, sun times, and progress toward summit in Extreme mode

## Project Structure

```
ConnectQ/
├── mobile/                                 # React Native Expo app
│   ├── App.tsx                             # Root — renders DashboardScreen
│   ├── src/
│   │   ├── screens/
│   │   │   └── DashboardScreen.tsx         # Dashboard, mode toggle, scenario swipe, interstitials
│   │   ├── components/
│   │   │   ├── MetricCard.tsx              # Metric tile with sparkline
│   │   │   ├── AlertCard.tsx               # E1–E4 / D1–D4 alert row
│   │   │   ├── ExpeditionHero.tsx          # Summit progress banner (Extreme)
│   │   │   ├── BodyMap.tsx                 # Body heat map
│   │   │   ├── JourneyMap.tsx              # Stage-based journey interstitial
│   │   │   ├── Onboarding.tsx              # Onboarding interstitial
│   │   │   ├── SessionFeedback.tsx         # Post-session feedback interstitial
│   │   │   ├── StampWall.tsx               # Summit stamps interstitial
│   │   │   └── SectionHeader.tsx           # Section divider
│   │   ├── hooks/
│   │   │   ├── useScenarioSwipe.ts         # Swipe-to-cycle scenario navigation
│   │   │   └── useSimulatedData.ts         # Live metric/alert/expedition simulator
│   │   └── data/
│   │       ├── mockData.ts                 # Metric/alert/expedition types and base data
│   │       └── scenarioPresets.ts          # Scenario definitions + interstitials
│   ├── app.json · package.json · tsconfig.json · babel.config.js
│
├── server/
│   ├── server.py                           # FastAPI — WebSocket, endpoints, orchestration
│   ├── signal_processor.py                 # Buffers sensor data, detects trends
│   ├── emotion_inference.py                # run_inference() — calls GPT-4.1-mini
│   ├── hug_trigger.py                      # Sustained-signal trigger logic
│   ├── requirements.txt
│   ├── tests/
│   │   ├── test_signal_processor.py        # Unit test — fake sensor stream
│   │   └── test_stream.py                  # Integration test — fake packets over WebSocket
│   └── data/                               # Runtime artifacts (gitignored)
│
└── firmware/
    ├── sketch/sketch.ino                   # Arduino firmware — IMU, temp, touch
    ├── sketch/sketch.yaml                  # Arduino library dependencies
    ├── bridge/sender.py                    # Forwards Arduino packets to server
    ├── bridge/receiver.py                  # Receives servo commands from server
    └── app.yaml                            # Arduino App metadata
```

## Setup

```bash
# 1. Install mobile app dependencies
cd mobile && npm install

# 2. Start Expo dev server
npx expo start

# 3. Scan QR with Expo Go (iOS/Android) or press 'i' / 'a' for simulators
```

Swipe horizontally on the dashboard to cycle through scenario presets. Tap the **Daily / Extreme** toggle to switch palettes (some presets lock to one mode).

## Backend (optional)

Needed only when connecting real hardware and GPT inference.

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

Flash `firmware/sketch/sketch.ino` to your Arduino (arduino:zephyr platform, libraries in `sketch.yaml`).

## Tests

```bash
cd server
python tests/test_signal_processor.py          # unit test (no server needed)
python tests/test_stream.py --port 8000        # integration test (server must be running)
```
