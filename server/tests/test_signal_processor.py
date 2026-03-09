"""
test_signal_processor.py — Run signal_processor.py against a fake Arduino stream.
Each time a write is triggered, also saves a copy to data/test.json.

Usage:
    cd server && python -m tests.test_signal_processor
    # or from project root:
    cd server && python tests/test_signal_processor.py
"""

import json
import os
import io
import sys

# Allow running from server/ directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import signal_processor

# Override write_input to also copy to test.json
_original_write = signal_processor.write_input
test_json_path = os.path.join(os.path.dirname(__file__), "..", "data", "test.json")
write_count = 0
test_log = []

def _patched_write(output):
    global write_count
    _original_write(output)
    with open(signal_processor.input_path) as f:
        entry = json.load(f)
    test_log.append(entry)
    os.makedirs(os.path.dirname(test_json_path), exist_ok=True)
    with open(test_json_path, "w") as f:
        json.dump(test_log, f, indent=2)
    write_count += 1
    print(f"  → appended to data/test.json (write #{write_count})\n")

signal_processor.write_input = _patched_write

# Fake stream:
#   - 10 constant-speed packets (speed ~120, no touch) to fill the sample buffer
#   - 1 touch=1 packet (immediate trigger regardless of buffer)
#   - 10 high-speed packets (speed ~800, increasing) to trigger a speed pattern change
FAKE_STREAM = """\
{"touch": 0, "speed": 118.00, "temps": [{"addr": "0x48", "tempC": 22.5}], "device": "giver"}
{"touch": 0, "speed": 119.50, "temps": [{"addr": "0x48", "tempC": 22.6}], "device": "giver"}
{"touch": 0, "speed": 120.10, "temps": [{"addr": "0x48", "tempC": 22.5}], "device": "giver"}
{"touch": 0, "speed": 118.80, "temps": [{"addr": "0x48", "tempC": 22.7}], "device": "giver"}
{"touch": 0, "speed": 121.00, "temps": [{"addr": "0x48", "tempC": 22.5}], "device": "giver"}
{"touch": 0, "speed": 119.20, "temps": [{"addr": "0x48", "tempC": 22.6}], "device": "giver"}
{"touch": 0, "speed": 120.50, "temps": [{"addr": "0x48", "tempC": 22.5}], "device": "giver"}
{"touch": 0, "speed": 118.60, "temps": [{"addr": "0x48", "tempC": 22.6}], "device": "giver"}
{"touch": 0, "speed": 120.00, "temps": [{"addr": "0x48", "tempC": 22.5}], "device": "giver"}
{"touch": 0, "speed": 119.70, "temps": [{"addr": "0x48", "tempC": 22.6}], "device": "giver"}
{"touch": 1, "speed": 118.95, "temps": [{"addr": "0x48", "tempC": 22.875}], "device": "giver"}
{"touch": 0, "speed": 500.00, "temps": [{"addr": "0x48", "tempC": 23.0}], "device": "giver"}
{"touch": 0, "speed": 580.00, "temps": [{"addr": "0x48", "tempC": 23.2}], "device": "giver"}
{"touch": 0, "speed": 650.00, "temps": [{"addr": "0x48", "tempC": 23.5}], "device": "giver"}
{"touch": 0, "speed": 700.00, "temps": [{"addr": "0x48", "tempC": 23.8}], "device": "giver"}
{"touch": 0, "speed": 730.00, "temps": [{"addr": "0x48", "tempC": 24.0}], "device": "giver"}
{"touch": 0, "speed": 760.00, "temps": [{"addr": "0x48", "tempC": 24.1}], "device": "giver"}
{"touch": 0, "speed": 780.00, "temps": [{"addr": "0x48", "tempC": 24.2}], "device": "giver"}
{"touch": 0, "speed": 800.00, "temps": [{"addr": "0x48", "tempC": 24.3}], "device": "giver"}
{"touch": 0, "speed": 810.00, "temps": [{"addr": "0x48", "tempC": 24.4}], "device": "giver"}
{"touch": 0, "speed": 820.00, "temps": [{"addr": "0x48", "tempC": 24.5}], "device": "giver"}
"""

# Simulate voice_data.json being present for one window of readings
# (uncomment to test voice trigger)
# with open(os.path.join(os.path.dirname(__file__), "..", "data", "voice_data.json"), "w") as f:
#     json.dump({"transcript": "I feel really anxious right now.", "sentiment": "anxious"}, f)

print("=" * 55)
print("test_signal_processor: running fake stream")
print("=" * 55 + "\n")

signal_processor.process_stream(io.StringIO(FAKE_STREAM))

print("\n" + "=" * 55)
print(f"Done. {write_count} write(s) triggered.")
if write_count:
    print(f"data/test.json contents ({write_count} entries):")
    print(json.dumps(test_log, indent=2))
print("=" * 55)
