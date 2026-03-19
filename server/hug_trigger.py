"""
hug_trigger.py — Emotion-based hug trigger for ConnectQ.

Determines when to trigger a hug based on sustained emotional signals
using a time-window frequency approach. Pure logic — no I/O dependencies.

Usage:
    trigger = HugTrigger()
    result = trigger.check(top_emotions)  # list of {"name": str, "score": float}
    if result:
        print(f"Trigger: {result.category} hug for {result.emotion} ({result.microseconds}μs)")
"""

import time
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class TriggerEvent:
    emotion: str
    category: str       # "comfort", "soothe", or "celebrate"
    microseconds: int   # servo speed: 500 (fast/tight) to 2500 (slow/gentle)
    confidence: float   # average score that triggered this


# (threshold, required_hits, window_chunks, category)
TRIGGER_CONFIG = {
    # COMFORT — strong hug (servo 500-1000μs)
    "Sadness":       (0.15, 3, 5, "comfort"),
    "Distress":      (0.15, 3, 5, "comfort"),
    "Fear":          (0.15, 3, 5, "comfort"),
    "Empathic Pain": (0.12, 3, 5, "comfort"),
    "Shame":         (0.12, 3, 5, "comfort"),
    "Guilt":         (0.12, 3, 5, "comfort"),
    "Pain":          (0.15, 3, 5, "comfort"),

    # SOOTHE — gentle hug (servo 1000-1500μs)
    "Anxiety":        (0.15, 4, 6, "soothe"),
    "Disappointment": (0.15, 3, 5, "soothe"),
    "Nostalgia":      (0.18, 3, 5, "soothe"),
    "Tiredness":      (0.12, 4, 6, "soothe"),
    "Awkwardness":    (0.15, 3, 5, "soothe"),
    "Confusion":      (0.15, 3, 5, "soothe"),

    # CELEBRATE — quick squeeze (servo 800-1200μs)
    "Joy":        (0.22, 3, 5, "celebrate"),
    "Love":       (0.20, 3, 5, "celebrate"),
    "Ecstasy":    (0.20, 2, 4, "celebrate"),
    "Triumph":    (0.22, 3, 5, "celebrate"),
    "Pride":      (0.18, 4, 6, "celebrate"),
    "Excitement": (0.22, 3, 5, "celebrate"),
}

# Chunk duration in seconds (must match frontend CHUNK_DURATION)
CHUNK_SECONDS = 1.5

COOLDOWN_SECONDS = 15.0


def _compute_microseconds(category: str, confidence: float) -> int:
    """Map emotion category + confidence to servo microseconds."""
    if category == "comfort":
        # 500 (high confidence = tight) to 1000 (low confidence = lighter)
        us = int(500 + (1 - confidence) * 500)
    elif category == "soothe":
        # 1000 (high) to 1500 (low)
        us = int(1000 + (1 - confidence) * 500)
    elif category == "celebrate":
        # 800 (high) to 1200 (low)
        us = int(800 + (1 - confidence) * 400)
    else:
        us = 1500
    return max(500, min(2500, us))


class HugTrigger:
    """Detects sustained emotions and triggers hug events.

    Maintains a timestamped buffer of recent emotion readings.
    Fires when a trigger emotion appears frequently enough within
    its time window, then enters cooldown to prevent rapid re-firing.
    """

    def __init__(self, cooldown: float = COOLDOWN_SECONDS):
        self._buffer: list[tuple[float, str, float]] = []  # (time, emotion, score)
        self._cooldown = cooldown
        self._last_trigger_time: float = 0.0

    def check(self, top_emotions: list[dict]) -> Optional[TriggerEvent]:
        """Check if current emotions should trigger a hug.

        Args:
            top_emotions: Sorted list of {"name": str, "score": float}
                          from Hume (highest score first).

        Returns:
            TriggerEvent if triggered, None otherwise.
        """
        now = time.time()

        # Record top-2 emotions into the buffer
        for e in top_emotions[:2]:
            self._buffer.append((now, e["name"], e["score"]))

        # Check cooldown
        if now - self._last_trigger_time < self._cooldown:
            return None

        # Check each trigger emotion
        best_trigger = None
        best_score = 0.0

        for emotion, (threshold, required, window_chunks, category) in TRIGGER_CONFIG.items():
            window_seconds = window_chunks * CHUNK_SECONDS
            cutoff = now - window_seconds

            # Count hits in window
            hits = []
            for t, name, score in self._buffer:
                if t >= cutoff and name == emotion and score >= threshold:
                    hits.append(score)

            if len(hits) >= required:
                avg_score = sum(hits) / len(hits)
                if avg_score > best_score:
                    best_score = avg_score
                    best_trigger = (emotion, category, avg_score)

        if best_trigger:
            emotion, category, avg = best_trigger
            us = _compute_microseconds(category, avg)
            self._last_trigger_time = now
            self._prune(now)

            logger.info("HUG TRIGGERED: %s (%s) — %.2f confidence → %dμs",
                        emotion, category, avg, us)

            return TriggerEvent(
                emotion=emotion,
                category=category,
                microseconds=us,
                confidence=round(avg, 4),
            )

        # Prune old entries periodically
        self._prune(now)
        return None

    def _prune(self, now: float) -> None:
        """Remove buffer entries older than the largest window."""
        max_window = max(w * CHUNK_SECONDS for _, _, w, _ in TRIGGER_CONFIG.values())
        cutoff = now - max_window - 2  # small padding
        self._buffer = [(t, n, s) for t, n, s in self._buffer if t >= cutoff]
