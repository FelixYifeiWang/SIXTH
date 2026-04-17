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
├── flash.sh                       # Compile + upload sketch.ino via arduino-cli
├── .board.conf.example            # Template for board defaults (SERIAL_PORT, WIFI_TARGET, ...)
├── requirements.txt               # Python deps (pyserial)
├── TODO.md
└── README.md
```

## Setup

### 0. Board defaults (optional but recommended)

`dev.sh` and `flash.sh` read their defaults from `.board.conf` at the repo root. Generate it automatically with the board plugged in:

```bash
pip install -r requirements.txt      # for pyserial (one-time)
python3 firmware/bridge/setup_board.py
```

The script calls `arduino-cli` to detect `SERIAL_PORT` + `FQBN`, then reads the serial monitor for ~15 s to catch the `Listening on <ip>:4040` line and fill in `WIFI_TARGET`. Run it with `--skip-wifi` if the sketch isn't flashed yet, then re-run after flashing to populate the IP.

Manual alternative:

```bash
cp .board.conf.example .board.conf
# edit .board.conf
```

Fields: `SERIAL_PORT`, `WIFI_TARGET` (host:port), `DEFAULT_TRANSPORT` (`serial` or `wifi`), `FQBN`. The file is gitignored so different machines can have different values.

Without this file you can still pass values explicitly, e.g. `./dev.sh --wifi 192.168.1.42:4040` or `./flash.sh --port /dev/tty.usbmodem1101`.

### 1. Mobile app

```bash
cd mobile && npm install
npx expo start
# Scan QR with Expo Go, or press 'i' / 'a' for simulators
```

Swipe horizontally on the dashboard to cycle through scenario presets. Tap the **Daily / Extreme** toggle to switch palettes (some presets lock to one mode).

### 2. Firmware

Board: any ESP32 Feather variant (e.g. *Adafruit HUZZAH32*). Arduino core: **esp32 by Espressif v3.x**.

Fill in `WIFI_SSID` / `WIFI_PASS` in `firmware/sketch/sketch.ino` (2.4 GHz only — ESP32 Feather does not support 5 GHz). Leave the placeholders to run USB-serial only. After a successful boot, the serial monitor prints `WiFi connected. Listening on <ip>:4040`.

**Flash from the terminal** (preferred — uses `arduino-cli`):

```bash
# one-time setup
brew install arduino-cli
arduino-cli config init
arduino-cli config add board_manager.additional_urls \
  https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32

# find your port + fqbn
arduino-cli board list

# compile + upload
./flash.sh                                # uses SERIAL_PORT + FQBN from .board.conf
./flash.sh --port /dev/tty.usbmodem1101   # explicit port
./flash.sh --port ... --fqbn esp32:esp32:adafruit_feather_esp32s3
```

`flash.sh` defaults `--fqbn` to `esp32:esp32:featheresp32` when neither `.board.conf` nor `--fqbn` overrides it. After flashing, monitor serial output with `screen /dev/tty.usbmodem1101 115200` (Ctrl-A then K to quit).

**Flash from the Arduino IDE** (alternative): open `firmware/sketch/sketch.ino`, pick your board, and click Upload.

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
./dev.sh                                 # uses DEFAULT_TRANSPORT from .board.conf
./dev.sh --serial                        # force serial, value from .board.conf
./dev.sh --wifi                          # force wifi, value from .board.conf
./dev.sh --serial /dev/tty.usbmodem1101  # explicit override
./dev.sh --wifi   192.168.1.42:4040      # explicit override
```

Ctrl-C each window independently.

### 5. Verify the board (diagnostic)

`firmware/bridge/diagnose.py` runs a quick smoke test against a connected board: it waits for a sensor report, checks the parsed values are in plausible ranges, and pings each activation key (1-5) + reset (R) to verify the write path. Any failure is flagged with a specific reason.

```bash
python3 firmware/bridge/diagnose.py --serial /dev/tty.usbmodem1101
python3 firmware/bridge/diagnose.py --wifi 192.168.1.42:4040
# optional: raise the sensor-report wait if WiFi is slow to settle
python3 firmware/bridge/diagnose.py --wifi 192.168.1.42:4040 --timeout 10
```

Exits with code 0 when every check passes, 1 otherwise.

Unit tests for the diagnostic's parsing / plausibility logic (hardware-free):

```bash
python3 firmware/bridge/test_diagnose.py
```

## Known gaps

See `TODO.md` — WiFi credentials need filling in, the keyboard trigger is temporary, and `dev.sh` / `controller.py` still require the transport flag every run.
