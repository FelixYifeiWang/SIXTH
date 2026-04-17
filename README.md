# SIXTH

A wearable biosignal prototype. An ESP32 Feather reads a thermistor + moisture sensor, drives five PWM outputs (four haptics and a ventilation channel), and streams a sensor report to a laptop over USB-serial and/or WiFi. A small Python script on the laptop captures keystrokes and sends activation commands back to the board. A separate Expo app visualizes simulated metrics — it does not currently talk to the board.

## Architecture

```
                      ┌─────────────────────────┐
                      │  ESP32 Feather          │
  thermistor / moist ─┤  firmware/sketch/*.ino  │── PWM ─▶ 4 haptics + vent
                      │                         │
                      │  Serial  115200 baud   ◀┼──▶ laptop (USB cable)
                      │  TCP     :4040         ◀┼──▶ laptop (WiFi)
                      └─────────────────────────┘
                                    ▲
                                    │ "1"–"5" activate, "R" reset
                                    │
                      ┌─────────────────────────┐
                      │ firmware/bridge/        │
                      │   controller.py         │  (stdin keystrokes)
                      └─────────────────────────┘

                      ┌─────────────────────────┐
                      │ mobile/  (Expo)         │  simulated metrics; standalone
                      └─────────────────────────┘
```

## Firmware (`firmware/sketch/sketch.ino`)

Single ESP32 sketch. On boot it:

- Initializes a motor on **GPIO 21** (toggles 1 s on / 1 s off — existing test pattern).
- Reads a thermistor on **GPIO 34 / A2** and a resistive moisture sensor on **GPIO 39 / A3** (12-bit ADC, 11 dB attenuation, 16-sample average).
- Attaches five servo-style PWM outputs (50 Hz, 16-bit) on **GPIO 12 / 13 / 27 / 32 / 33**, parked at 1500 µs.
- Connects to WiFi if credentials are filled in (`WIFI_SSID`, `WIFI_PASS`). Falls back to serial-only if WiFi is unreachable.
- Starts a TCP server on port **4040** for one WiFi client at a time.

Every second it prints a sensor report to both the USB serial monitor and the connected WiFi client. It also reads single-character commands from either stream:

| Key   | Action                                           |
| ----- | ------------------------------------------------ |
| `1`   | activate **right top haptic**    (GPIO 12, 2000 µs) |
| `2`   | activate **right bottom haptic** (GPIO 13, 2000 µs) |
| `3`   | activate **left bottom haptic**  (GPIO 27, 2000 µs) |
| `4`   | activate **ventilation**         (GPIO 32, 2000 µs) |
| `5`   | activate **left top haptic**     (GPIO 33, 2000 µs) |
| `R`/`r` | reset all five outputs to 1500 µs              |

## Laptop controller (`firmware/bridge/controller.py`)

Captures single keystrokes in the terminal (raw `tty` mode) and forwards matching ones to the board over USB serial or a TCP connection. Invalid keys are ignored; each command's ack line from the Arduino is echoed back to the terminal.

```bash
python3 firmware/bridge/controller.py --serial /dev/tty.usbmodem1101
python3 firmware/bridge/controller.py --wifi   192.168.1.42:4040
```

Needs `pyserial` when using `--serial` (see `requirements.txt`).

## Mobile app (`mobile/`)

An Expo dashboard for the wearable. Runs fully on simulated data — no server or board required.

Features:
- **SIXTH branding** with two palettes — **Daily** (cool blue) and **Extreme** (warm amber) — toggled via the mode switch, with a loading transition when entering Extreme.
- **Scenario presets** — swipe left/right to cycle through expedition and training scenarios (Mt. Rainier summit, Island Peak, etc.), onboarding, journey map, session feedback, and stamp-wall interstitials.
- **Live simulation** — metric values and sparklines tick over time, seeded from the active preset.
- **Body map** heat visualization for applicable scenarios.
- **Alert cards** — sensor-accurate codes (E1–E4 extreme, D1–D4 daily) driven by metric thresholds.
- **Expedition hero** — altitude, weather, sun times, and progress toward summit in Extreme mode.

## Project structure

```
SIXTH/
├── firmware/
│   └── sketch/sketch.ino          # ESP32 sketch: sensors + PWM outputs + WiFi/Serial I/O
│   └── bridge/controller.py       # Laptop keystroke forwarder
├── mobile/                        # Expo app (standalone simulator)
│   ├── App.tsx
│   └── src/
│       ├── screens/DashboardScreen.tsx
│       ├── components/            # MetricCard, AlertCard, ExpeditionHero, BodyMap, ...
│       ├── hooks/                 # useScenarioSwipe, useSimulatedData
│       └── data/                  # mockData.ts, scenarioPresets.ts
├── dev.sh                         # macOS: start Expo + controller together
├── requirements.txt               # Python deps (pyserial + legacy placeholders)
├── TODO.md
└── README.md
```

## Setup

### 1. Mobile app

```bash
cd mobile && npm install
npx expo start
# Scan QR with Expo Go, or press 'i' / 'a' for simulators
```

Swipe horizontally on the dashboard to cycle through scenario presets. Tap the **Daily / Extreme** toggle to switch palettes (some presets lock to one mode).

### 2. Firmware

1. Open `firmware/sketch/sketch.ino` in the Arduino IDE.
2. Board: any ESP32 Feather variant (e.g. *Adafruit HUZZAH32*). Arduino core: **esp32 by Espressif v3.x**.
3. Fill in `WIFI_SSID` / `WIFI_PASS` (2.4 GHz only — ESP32 Feather does not support 5 GHz) or leave the placeholders to run USB-serial only.
4. Flash. The serial monitor prints `WiFi connected. Listening on <ip>:4040` when the network is up.

### 3. Laptop controller

```bash
pip install -r requirements.txt   # for pyserial
python3 firmware/bridge/controller.py --serial /dev/tty.usbmodem1101
# or
python3 firmware/bridge/controller.py --wifi 192.168.1.42:4040
```

### 4. Expo + controller together (macOS)

`dev.sh` starts Expo in the current terminal and opens the controller in a new Terminal.app window:

```bash
./dev.sh --serial /dev/tty.usbmodem1101
./dev.sh --wifi   192.168.1.42:4040
```

Ctrl-C each window independently.

## Known gaps

See `TODO.md` — WiFi credentials need filling in, the keyboard trigger is temporary, and `dev.sh` / `controller.py` still require the transport flag every run.
