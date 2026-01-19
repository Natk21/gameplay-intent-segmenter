import os
import sys

sys.path.append(
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..")
    )
)

from app.services.intent_segmentation import segment_intent_phases


MIN_REQUIRED = {
    "Explore": 2.0,
    "Pursue": 1.5,
    "Execute": 0.5,
    "Outcome": 1.5,
}


def segment_durations(segments):
    return [
        (segment["phase"], segment["end"] - segment["start"])
        for segment in segments
    ]


def test_empty_inputs_return_empty():
    assert segment_intent_phases([], []) == []
    assert segment_intent_phases([0.0], []) == []


def test_short_clip_returns_empty():
    times = [0.0, 0.5, 1.0]
    motion = [0.1, 0.1, 0.1]
    assert segment_intent_phases(times, motion) == []


def test_no_segment_shorter_than_minimums():
    times = [i * 0.5 for i in range(30)]
    motion = (
        [0.12] * 6
        + [0.28, 0.31, 0.33, 0.35]
        + [0.45, 0.48, 0.5, 0.46]
        + [0.25, 0.22, 0.2, 0.18]
        + [0.3, 0.32, 0.35, 0.4]
        + [0.2] * 6
    )
    motion = motion[: len(times)]

    segments = segment_intent_phases(times, motion)
    for phase, duration in segment_durations(segments):
        assert duration >= MIN_REQUIRED[phase] - 1e-6


def test_execute_and_outcome_respect_minimums():
    times = [i * 0.25 for i in range(60)]
    motion = (
        [0.12] * 12
        + [0.3] * 10
        + [0.5] * 10
        + [0.2] * 28
    )
    motion = motion[: len(times)]

    segments = segment_intent_phases(times, motion)
    for phase, duration in segment_durations(segments):
        if phase in ("Execute", "Outcome"):
            assert duration >= MIN_REQUIRED[phase] - 1e-6
