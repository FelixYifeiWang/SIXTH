// Typed wrapper around the ESP32 sensor report.
// Firmware exposes `GET http://<board-ip>/report` returning the plain-text
// format below. `host` can be `"<ip>"` or `"<ip>:<port>"`; callers pass null
// to force the LIVE page into its "disconnected" state.

export type SensorReport = {
  thermistorC: number;
  moisturePct: number;
  receivedAt: number;
};

const TEMP_C_RE = /Temp:\s*([-\d.]+)\s*°C/;
const MOIST_RE = /Moisture:\s*([-\d.]+)\s*%/;
const FETCH_TIMEOUT_MS = 2500;

export function parseSensorReport(text: string): SensorReport | null {
  const tempMatch = TEMP_C_RE.exec(text);
  const moistMatch = MOIST_RE.exec(text);
  if (!tempMatch || !moistMatch) return null;

  const thermistorC = Number.parseFloat(tempMatch[1]);
  const moisturePct = Number.parseFloat(moistMatch[1]);
  if (!Number.isFinite(thermistorC) || !Number.isFinite(moisturePct)) return null;

  return { thermistorC, moisturePct, receivedAt: Date.now() };
}

export async function fetchSensorReport(host: string | null): Promise<SensorReport | null> {
  if (!host) return null;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`http://${host}/report`, { signal: ctl.signal });
    if (!res.ok) return null;
    return parseSensorReport(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
