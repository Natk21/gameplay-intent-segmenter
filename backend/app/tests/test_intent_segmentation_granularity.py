import os
import sys

sys.path.append(
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..")
    )
)

from app.services.intent_segmentation import segment_intent_phases


def test_granularity_presets_affect_segment_count(monkeypatch):
    times = [i * 0.2 for i in range(150)]
    motion = (
        [0.1] * 20
        + [0.3] * 30
        + [0.8] * 10
        + [0.2] * 30
        + [0.7] * 10
        + [0.15] * 50
    )
    motion = motion[: len(times)]

    monkeypatch.setenv("INTENT_GRANULARITY", "coarse")
    coarse = segment_intent_phases(times, motion)

    monkeypatch.setenv("INTENT_GRANULARITY", "fine")
    fine = segment_intent_phases(times, motion)

    assert len(fine) >= len(coarse)
