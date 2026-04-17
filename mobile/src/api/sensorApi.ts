// Typed wrapper around the ESP32 sensor report.
//
// The firmware currently emits a multi-line plain-text report over TCP:4040.
// React Native can't open raw sockets without a native module, so the
// firmware will need an HTTP route (e.g. GET /report) before `fetchSensorReport`
// can become real. Until then, the fetch stub returns null so the LIVE page
// renders its "disconnected" state and the rest of the app works board-free.

export type SensorReport = {
  thermistorC: number;
  moisturePct: number;
  receivedAt: number;
};

const TEMP_C_RE = /Temp:\s*([-\d.]+)\s*°C/;
const MOIST_RE = /Moisture:\s*([-\d.]+)\s*%/;

export function parseSensorReport(text: string): SensorReport | null {
  const tempMatch = TEMP_C_RE.exec(text);
  const moistMatch = MOIST_RE.exec(text);
  if (!tempMatch || !moistMatch) return null;

  const thermistorC = Number.parseFloat(tempMatch[1]);
  const moisturePct = Number.parseFloat(moistMatch[1]);
  if (!Number.isFinite(thermistorC) || !Number.isFinite(moisturePct)) return null;

  return { thermistorC, moisturePct, receivedAt: Date.now() };
}

// TODO: wire real transport. When firmware exposes HTTP, replace this body
// with `fetch(\`http://${host}/report\`).then(r => r.text()).then(parseSensorReport)`.
export async function fetchSensorReport(_host: string | null): Promise<SensorReport | null> {
  return null;
}
