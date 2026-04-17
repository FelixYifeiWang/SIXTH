# TODO

## Firmware

- [ ] Fill in WiFi credentials in `firmware/sketch/sketch.ino:8-9`
  - `WIFI_SSID` — your 2.4 GHz network name (ESP32 Feather does not support 5 GHz)
  - `WIFI_PASS` — the network password
  - After flashing, the Serial Monitor prints the device IP; connect from your laptop with `nc <ip> 4040`

- [ ] Replace the temporary keyboard trigger in `firmware/bridge/controller.py`
  - Keys 1–5 / R are a stand-in so we can bench-test the five PWM outputs by hand.
