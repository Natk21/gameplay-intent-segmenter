import os
import sys

sys.path.append(
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..")
    )
)

from app.services.intent_segmentation import segment_intent_phases


def test_flat_motion_high_entropy_explore():
    times = [i * 0.2 for i in range(80)]
    motion = [0.1] * 80
    interaction = [0.2] * 80
    entropy = [0.9] * 80
    segments = segment_intent_phases(
        times,
        motion,
        interaction=interaction,
        entropy=entropy,
    )

    assert segments
    explore_ratio = sum(
        1 for seg in segments if seg["phase"] == "Explore"
    ) / len(segments)
    assert explore_ratio >= 0.5


def test_spike_low_interaction_not_execute():
    times = [i * 0.2 for i in range(80)]
    motion = [0.1] * 40 + [0.9] * 5 + [0.1] * 35
    interaction = [0.15] * 80
    entropy = [0.4] * 80
    segments = segment_intent_phases(
        times,
        motion,
        interaction=interaction,
        entropy=entropy,
    )

    assert all(seg["phase"] != "Execute" for seg in segments)


def test_spike_high_interaction_low_entropy_execute():
    times = [i * 0.2 for i in range(80)]
    motion = [0.1] * 40 + [0.9] * 6 + [0.1] * 34
    interaction = [0.7] * 80
    entropy = [0.2] * 80
    segments = segment_intent_phases(
        times,
        motion,
        interaction=interaction,
        entropy=entropy,
    )

    assert any(seg["phase"] == "Execute" for seg in segments)


def test_mid_motion_high_interaction_pursue():
    times = [i * 0.2 for i in range(80)]
    motion = [0.28] * 80
    interaction = [0.6] * 80
    entropy = [0.3] * 80
    segments = segment_intent_phases(
        times,
        motion,
        interaction=interaction,
        entropy=entropy,
    )

    assert any(seg["phase"] == "Pursue" for seg in segments)


def test_execute_then_collapse_outcome():
    times = [i * 0.2 for i in range(100)]
    motion = [0.1] * 30 + [0.9] * 8 + [0.1] * 62
    interaction = [0.7] * 30 + [0.8] * 8 + [0.2] * 62
    entropy = [0.2] * 30 + [0.2] * 8 + [0.2] * 62
    segments = segment_intent_phases(
        times,
        motion,
        interaction=interaction,
        entropy=entropy,
    )

    execute_index = next(
        i for i, seg in enumerate(segments) if seg["phase"] == "Execute"
    )
    assert any(
        seg["phase"] == "Outcome"
        for seg in segments[execute_index + 1 :]
    )


def test_backward_compatibility_motion_only():
    times = [i * 0.2 for i in range(60)]
    motion = [0.1] * 60
    segments = segment_intent_phases(times, motion)
    assert segments
