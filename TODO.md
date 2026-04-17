# TODO

## Firmware

- [ ] Replace the temporary keyboard trigger in `firmware/bridge/controller.py`
  - Keys 1–5 / R are a stand-in so we can bench-test the five PWM outputs by hand.

## Mobile

- [ ] Map additional sensors to LIVE metrics. Moisture is already parsed into `SensorReport` but not yet bound to a dashboard card; all non-core-temp metrics render `—`.
