"""
test_signal_processor.py — Run SignalProcessor against a fake Arduino stream.
Each time a write is triggered, saves a copy to data/test.json.

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
from signal_processor import SignalProcessor, write_input, INPUT_PATH

test_json_path = os.path.join(os.path.dirname(__file__), "..", "data", "test.json")
write_count = 0
test_log = []


def _test_write(output):
    """Write to input_data.json and also append to test.json for inspection."""
    global write_count
    write_input(output)
    with open(INPUT_PATH) as f:
        entry = json.load(f)
    test_log.append(entry)
    os.makedirs(os.path.dirname(test_json_path), exist_ok=True)
    with open(test_json_path, "w") as f:
        json.dump(test_log, f, indent=2)
    write_count += 1
    print(f"  → appended to data/test.json (write #{write_count})\n")


# Phases run as separate streams with processor reset between each.
# Expected: 3 writes total
#   Phase 1: 10 constant packets at ~350 → write speed-constant@350
#   Phase 2: 1 touch=1 packet → write touch
#   Phase 3: 10 constant packets at ~800 → write speed-constant@800
PHASE_STREAMS = [
    # Phase 1: constant speed at ~350 (above SPEED_MIN_MAGNITUDE=300)
    """\
{"touch": 0, "speed": 348.00, "temps": [{"addr": "0x48", "tempC": 22.5}], "device": "giver"}
{"touch": 0, "speed": 351.50, "temps": [{"addr": "0x48", "tempC": 22.6}], "device": "giver"}
{"touch": 0, "speed": 350.10, "temps": [{"addr": "0x48", "tempC": 22.5}], "device": "giver"}
{"touch": 0, "speed": 348.80, "temps": [{"addr": "0x48", "tempC": 22.7}], "device": "giver"}
{"touch": 0, "speed": 352.00, "temps": [{"addr": "0x48", "tempC": 22.5}], "device": "giver"}
{"touch": 0, "speed": 349.20, "temps": [{"addr": "0x48", "tempC": 22.6}], "device": "giver"}
{"touch": 0, "speed": 350.50, "temps": [{"addr": "0x48", "tempC": 22.5}], "device": "giver"}
{"touch": 0, "speed": 348.60, "temps": [{"addr": "0x48", "tempC": 22.6}], "device": "giver"}
{"touch": 0, "speed": 350.00, "temps": [{"addr": "0x48", "tempC": 22.5}], "device": "giver"}
{"touch": 0, "speed": 349.70, "temps": [{"addr": "0x48", "tempC": 22.6}], "device": "giver"}
""",
    # Phase 2: touch=1 (immediate trigger)
    """\
{"touch": 1, "speed": 349.00, "temps": [{"addr": "0x48", "tempC": 22.875}], "device": "giver"}
""",
    # Phase 3: constant speed at ~800 (>20% magnitude shift from ~350)
    """\
{"touch": 0, "speed": 798.00, "temps": [{"addr": "0x48", "tempC": 24.0}], "device": "giver"}
{"touch": 0, "speed": 802.00, "temps": [{"addr": "0x48", "tempC": 24.1}], "device": "giver"}
{"touch": 0, "speed": 800.50, "temps": [{"addr": "0x48", "tempC": 24.0}], "device": "giver"}
{"touch": 0, "speed": 799.00, "temps": [{"addr": "0x48", "tempC": 24.1}], "device": "giver"}
{"touch": 0, "speed": 801.50, "temps": [{"addr": "0x48", "tempC": 24.0}], "device": "giver"}
{"touch": 0, "speed": 798.50, "temps": [{"addr": "0x48", "tempC": 24.1}], "device": "giver"}
{"touch": 0, "speed": 800.00, "temps": [{"addr": "0x48", "tempC": 24.0}], "device": "giver"}
{"touch": 0, "speed": 801.00, "temps": [{"addr": "0x48", "tempC": 24.1}], "device": "giver"}
{"touch": 0, "speed": 799.50, "temps": [{"addr": "0x48", "tempC": 24.0}], "device": "giver"}
{"touch": 0, "speed": 800.50, "temps": [{"addr": "0x48", "tempC": 24.1}], "device": "giver"}
""",
]

print("=" * 55)
print("test_signal_processor: running fake stream")
print("=" * 55 + "\n")

processor = SignalProcessor(write_fn=_test_write, voice_fn=lambda: None)

for i, stream in enumerate(PHASE_STREAMS, 1):
    print(f"--- Phase {i} ---")
    processor.reset()
    processor.process_stream(io.StringIO(stream))

print("\n" + "=" * 55)
print(f"Done. {write_count} write(s) triggered.")
if write_count:
    print(f"data/test.json contents ({write_count} entries):")
    print(json.dumps(test_log, indent=2))
print("=" * 55)
