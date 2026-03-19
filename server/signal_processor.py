"""
signal_processor.py — Parse and normalize the giver Arduino stream.

Writes input_data.json only when a trigger condition is met:
  - touch is detected (touch == 1)
  - voice data exists (voice_data.json written by /upload_audio endpoint)
  - speed or temperature signal pattern/magnitude changes meaningfully
    (evaluated after collecting SPEED_SAMPLE_SIZE / TEMP_SAMPLE_SIZE samples
    via softmax characterization)

Usage:
    Pipe the serial/WebSocket stream to stdin:
        python signal_processor.py < raw_stream.txt
    Or live:
        some_reader | python signal_processor.py
"""

import sys
import json
import math
import re
import os
import logging
from collections import deque
from typing import Optional, Callable

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SPEED_SAMPLE_SIZE = 10
TEMP_SAMPLE_SIZE = 25
SPEED_MIN_MAGNITUDE = 300
SPEED_COOLDOWN = 10
TEMP_COOLDOWN = 25
OUTLIER_CONSEC_LIMIT = 3

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
INPUT_PATH = os.path.join(DATA_DIR, "input_data.json")
VOICE_PATH = os.path.join(DATA_DIR, "voice_data.json")


# ---------------------------------------------------------------------------
# Pure helpers (no state)
# ---------------------------------------------------------------------------

def parse_line(line: str) -> Optional[dict]:
    """Extract JSON from '[unknown] received: {...}' or plain JSON lines."""
    match = re.search(r"received:\s*(\{.*\})", line)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            return None
    try:
        return json.loads(line.strip())
    except json.JSONDecodeError:
        return None


def extract_temp(temps: list) -> Optional[float]:
    if temps and isinstance(temps, list) and len(temps) > 0:
        return temps[0].get("tempC")
    return None


def load_voice(voice_path: str = VOICE_PATH) -> Optional[dict]:
    """Read voice_data.json if it exists (written by /upload_audio in server.py)."""
    try:
        with open(voice_path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def softmax(values: list) -> list:
    """Numerically stable softmax over a list of floats."""
    if not values:
        return []
    max_v = max(values)
    exps = [math.exp(v - max_v) for v in values]
    total = sum(exps)
    return [e / total for e in exps]


def analyze_signal(samples: deque) -> dict:
    """
    Characterize a signal buffer using softmax-weighted statistics.

    Returns:
        magnitude  — trimmed-mean of the raw samples
        pattern    — "constant" | "increasing" | "decreasing" | "variable"
    """
    values = list(samples)
    if len(values) == 1:
        return {"magnitude": round(values[0], 2), "pattern": "unknown"}

    sorted_v = sorted(values)
    trimmed = sorted_v[1:-1] if len(sorted_v) > 2 else sorted_v
    mean = sum(trimmed) / len(trimmed)

    variance = sum((v - mean) ** 2 for v in trimmed) / len(trimmed)
    std = math.sqrt(variance) if variance > 0 else 0.0
    relative_std = std / (abs(mean) + 1e-6)

    first, last = values[0], values[-1]
    relative_change = abs(last - first) / (abs(first) + 1e-6)

    if relative_std < 0.05:
        pattern = "constant"
    elif last > first and relative_change > 0.50:
        pattern = "increasing"
    elif last < first and relative_change > 0.50:
        pattern = "decreasing"
    else:
        pattern = "variable"

    return {"magnitude": round(mean, 2), "pattern": pattern}


def signal_changed(prev: Optional[dict], curr: Optional[dict]) -> bool:
    """True if the pattern changed or magnitude shifted by more than 20%."""
    if prev is None or curr is None:
        return True
    if prev["pattern"] != curr["pattern"]:
        return True
    prev_mag, curr_mag = prev["magnitude"], curr["magnitude"]
    if prev_mag == 0 and curr_mag == 0:
        return False
    return abs(curr_mag - prev_mag) / (abs(prev_mag) + 1e-6) > 0.20


def write_input(output: dict, path: str = INPUT_PATH) -> None:
    """Write processed signal data to input_data.json."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(output, f, indent=2)


# ---------------------------------------------------------------------------
# SignalProcessor — encapsulates all mutable state
# ---------------------------------------------------------------------------

class SignalProcessor:
    """Buffers sensor data, detects meaningful changes, and triggers writes.

    Args:
        write_fn: Called with a dict when a trigger fires.
                  Defaults to writing input_data.json.
        voice_fn: Called with no args to load current voice data.
                  Defaults to reading voice_data.json.
    """

    def __init__(
        self,
        write_fn: Optional[Callable[[dict], None]] = None,
        voice_fn: Optional[Callable[[], Optional[dict]]] = None,
    ):
        self._write_fn = write_fn or write_input
        self._voice_fn = voice_fn or load_voice

        self.speed_samples: deque = deque(maxlen=SPEED_SAMPLE_SIZE)
        self.temp_samples: deque = deque(maxlen=TEMP_SAMPLE_SIZE)

        self._speed_consec_outliers: int = 0
        self._speed_cooldown: int = 0
        self._temp_cooldown: int = 0
        self._last_speed_char: Optional[dict] = None
        self._last_temp_char: Optional[dict] = None

    def reset(self, clear_history: bool = False) -> None:
        """Clear sample buffers. Optionally clear cached characterizations."""
        self.speed_samples.clear()
        self.temp_samples.clear()
        self._speed_consec_outliers = 0
        self._speed_cooldown = 0
        self._temp_cooldown = 0
        if clear_history:
            self._last_speed_char = None
            self._last_temp_char = None

    def process_packet(self, raw: dict) -> None:
        """Process a single already-parsed packet.

        Triggers a write when:
          - touch == 1  (immediate)
          - voice data present  (immediate)
          - speed buffer full AND characterization changed
          - temp buffer full AND characterization changed
        """
        if raw.get("type") == "hello" or "speed" not in raw:
            return

        touch = bool(raw.get("touch", 0))
        voice = self._voice_fn()
        has_voice = bool(voice and (voice.get("transcript") or voice.get("sentiment")))

        # Touch fires immediately
        if touch:
            self._write_fn({
                "voice": voice if voice else {"transcript": "", "sentiment": ""},
                "speed": None,
                "temperature": None,
                "touch": True,
            })
            logger.info("WRITE — triggers=['touch']")
            return

        raw_speed = raw.get("speed", 0.0)
        raw_temp = extract_temp(raw.get("temps", []))

        # Outlier rejection for speed
        if self.speed_samples:
            sorted_s = sorted(self.speed_samples)
            median_s = sorted_s[len(sorted_s) // 2]
            if median_s > 0 and raw_speed > median_s * 5:
                self._speed_consec_outliers += 1
                if self._speed_consec_outliers >= OUTLIER_CONSEC_LIMIT:
                    logger.info(
                        "regime shift detected: %d consecutive rejections, "
                        "clearing speed buffer (median was %.1f)",
                        self._speed_consec_outliers, median_s,
                    )
                    self.speed_samples.clear()
                    self._speed_consec_outliers = 0
                else:
                    logger.debug("outlier rejected: speed=%.1f (median=%.1f)", raw_speed, median_s)
                    raw_speed = None
            else:
                self._speed_consec_outliers = 0

        if raw_speed is not None:
            self.speed_samples.append(raw_speed)
        if raw_temp is not None:
            self.temp_samples.append(raw_temp)

        speed_char = analyze_signal(self.speed_samples) if self.speed_samples else None
        temp_char = analyze_signal(self.temp_samples) if self.temp_samples else None

        # Tick down cooldowns
        if self._speed_cooldown > 0:
            self._speed_cooldown -= 1
        if self._temp_cooldown > 0:
            self._temp_cooldown -= 1

        speed_ready = len(self.speed_samples) >= SPEED_SAMPLE_SIZE
        temp_ready = len(self.temp_samples) >= TEMP_SAMPLE_SIZE
        speed_above_min = speed_char is not None and speed_char["magnitude"] >= SPEED_MIN_MAGNITUDE
        speed_trigger = (speed_ready and speed_above_min
                         and self._speed_cooldown == 0
                         and signal_changed(self._last_speed_char, speed_char))
        temp_trigger = (temp_ready
                        and self._temp_cooldown == 0
                        and signal_changed(self._last_temp_char, temp_char))

        if not has_voice and not speed_trigger and not temp_trigger:
            return

        if speed_trigger:
            self._last_speed_char = speed_char
            self._speed_cooldown = SPEED_COOLDOWN
        if temp_trigger:
            self._last_temp_char = temp_char
            self._temp_cooldown = TEMP_COOLDOWN

        output = {
            "voice": voice if voice else {"transcript": "", "sentiment": ""},
            "speed": speed_char,
            "temperature": temp_char,
            "touch": touch,
        }
        self._write_fn(output)

        reasons = []
        if has_voice:
            reasons.append("voice")
        if speed_trigger:
            reasons.append(f"speed-{speed_char['pattern']}@{speed_char['magnitude']:.0f}")
        if temp_trigger and temp_char:
            reasons.append(f"temp-{temp_char['pattern']}@{temp_char['magnitude']:.1f}C")
        logger.info("WRITE — triggers=%s", reasons)

    def process_stream(self, stream) -> None:
        """Process a text stream of JSON lines (used by tests and CLI)."""
        for line in stream:
            line = line.strip()
            if not line:
                continue
            raw = parse_line(line)
            if raw is None:
                continue
            if raw.get("type") == "hello" or "speed" not in raw:
                continue
            self.process_packet(raw)


# ---------------------------------------------------------------------------
# Module-level default instance (backward compatibility with server.py)
# ---------------------------------------------------------------------------

_default = SignalProcessor()

process_packet = _default.process_packet
process_stream = _default.process_stream
reset = _default.reset


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
    logger.info("reading giver stream from stdin → data/input_data.json")
    process_stream(sys.stdin)
