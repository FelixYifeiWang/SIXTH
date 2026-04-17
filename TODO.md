# TODO

## Firmware

- [ ] Replace the temporary keyboard trigger in `firmware/bridge/controller.py`
  - Keys 1–5 / R are a stand-in so we can bench-test the five PWM outputs by hand.
- [ ] Expose an HTTP route on the ESP32 (e.g. `GET /report` returning JSON)
  - The mobile LIVE page can't consume the existing TCP plain-text report — React Native can't open raw sockets without a native module. HTTP unblocks `fetchSensorReport` in `mobile/src/api/sensorApi.ts`.

## Mobile

- [ ] Wire `fetchSensorReport` in `mobile/src/api/sensorApi.ts` to the real HTTP endpoint once the firmware exposes one. Parser already handles the report format.
- [ ] Add a way to configure the board host for the LIVE page (currently hardcoded `null` in `DashboardScreen.tsx`).
- [ ] Map additional sensors to LIVE metrics. Moisture is already parsed into `SensorReport` but not yet bound to a dashboard card; all non-core-temp metrics render `—`.
