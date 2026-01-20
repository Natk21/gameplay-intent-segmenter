import os
import sys

sys.path.append(
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..")
    )
)

import numpy as np

from app.services.learned_intent_segmentation import (
    ModelBundle,
    align_signal,
    build_feature_matrix,
    segment_intent_phases_model,
)


class DummyModel:
    def __init__(self, probs):
        self.probs = np.array(probs, dtype=float)

    def predict(self, X):
        rows = X.shape[0]
        return self.probs[:rows]


def test_align_signal_interpolates():
    target_times = [0.0, 1.0, 2.0]
    source_times = [0.0, 2.0]
    source_values = [0.0, 2.0]
    aligned = align_signal(target_times, source_times, source_values)
    assert aligned == [0.0, 1.0, 2.0]


def test_build_feature_matrix_uses_min_length():
    features = build_feature_matrix(
        motion=[0.1, 0.2, 0.3],
        interaction=[0.2, 0.3],
        entropy=[0.5, 0.6, 0.7],
        audio_energy=[0.0, 0.1, 0.2],
        audio_flux=[0.2, 0.3, 0.4],
    )
    assert features.shape == (2, 5)


def test_segment_intent_phases_model_outputs_segments():
    times = [0.0, 1.0, 2.0, 3.0, 4.0, 5.0]
    motion = [0.1] * len(times)
    interaction = [0.2] * len(times)
    entropy = [0.3] * len(times)
    audio_energy = [0.1] * len(times)
    audio_flux = [0.1] * len(times)

    probs = [
        [0.9, 0.05, 0.03, 0.02],
        [0.9, 0.05, 0.03, 0.02],
        [0.05, 0.05, 0.85, 0.05],
        [0.05, 0.05, 0.85, 0.05],
        [0.05, 0.05, 0.05, 0.85],
        [0.05, 0.05, 0.05, 0.85],
    ]
    bundle = ModelBundle(model=DummyModel(probs), phases=[
        "Explore",
        "Pursue",
        "Execute",
        "Outcome",
    ])

    segments = segment_intent_phases_model(
        times,
        motion,
        interaction,
        entropy,
        audio_energy,
        audio_flux,
        bundle,
        min_durations={
            "Explore": 0.0,
            "Pursue": 0.0,
            "Execute": 0.0,
            "Outcome": 0.0,
        },
    )

    assert segments[0]["phase"] == "Explore"
    assert segments[-1]["phase"] == "Outcome"
    assert segments[0]["start"] == 0.0
    assert segments[-1]["end"] == 5.0
