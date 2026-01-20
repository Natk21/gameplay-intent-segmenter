import argparse
import json
from pathlib import Path
from typing import Dict, List, Tuple

import lightgbm as lgb
import numpy as np

from app.ml.sequence.viterbi import (
    merge_short_segments,
    sequence_to_segments,
    segments_to_frame_labels,
    viterbi_decode,
)


def _load_dataset(dataset_path: Path) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    data = np.load(dataset_path)
    return data["X"], data["y"], data["t"], data["clip_ids"]


def _load_metadata(metadata_path: Path) -> Dict:
    with metadata_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _train_model(X: np.ndarray, y: np.ndarray, num_classes: int) -> lgb.Booster:
    dataset = lgb.Dataset(X, label=y)
    params = {
        "objective": "multiclass",
        "num_class": num_classes,
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_data_in_leaf": 10,
        "feature_fraction": 0.9,
        "bagging_fraction": 0.8,
        "bagging_freq": 1,
        "metric": "multi_logloss",
        "verbose": -1,
    }
    return lgb.train(params, dataset, num_boost_round=200)


def _frame_accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    if y_true.size == 0:
        return 0.0
    return float(np.mean(y_true == y_pred))


def _boundaries_from_labels(times: np.ndarray, labels: List[str]) -> List[float]:
    boundaries = []
    if not labels:
        return boundaries
    last = labels[0]
    for idx, label in enumerate(labels[1:], start=1):
        if label != last:
            boundaries.append(float(times[idx]))
            last = label
    return boundaries


def _boundary_error(
    gold: List[float],
    pred: List[float],
) -> float:
    if not gold or not pred:
        return 0.0
    errors = []
    for g in gold:
        closest = min(pred, key=lambda p: abs(p - g))
        errors.append(abs(closest - g))
    return float(np.mean(errors)) if errors else 0.0


def _illegal_transitions(labels: List[str]) -> int:
    allowed = {
        ("Explore", "Pursue"),
        ("Pursue", "Execute"),
        ("Execute", "Outcome"),
        ("Outcome", "Explore"),
        ("Explore", "Execute"),
        ("Outcome", "Pursue"),
    }
    count = 0
    for prev, curr in zip(labels, labels[1:]):
        if prev == curr:
            continue
        if (prev, curr) not in allowed:
            count += 1
    return count


def _apply_smoothing(
    times: np.ndarray,
    probs: np.ndarray,
    phases: List[str],
) -> List[str]:
    log_probs = np.log(np.clip(probs, 1e-9, 1.0))
    phase_seq = viterbi_decode(log_probs, phases)

    segments = sequence_to_segments(times.tolist(), phase_seq)
    min_durations = {
        "Explore": 1.6,
        "Pursue": 1.0,
        "Execute": 0.5,
        "Outcome": 0.7,
    }
    segments = merge_short_segments(segments, min_durations)
    return segments_to_frame_labels(times.tolist(), segments)


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate model with LOOCV.")
    parser.add_argument(
        "--dataset",
        required=True,
        help="Path to dataset.npz",
    )
    parser.add_argument(
        "--metadata",
        required=True,
        help="Path to metadata.json",
    )
    args = parser.parse_args()

    dataset_path = Path(args.dataset).resolve()
    metadata_path = Path(args.metadata).resolve()

    X, y, t, clip_ids = _load_dataset(dataset_path)
    metadata = _load_metadata(metadata_path)
    phases = metadata["phases"]

    unique_clips = np.unique(clip_ids)
    acc_scores = []
    boundary_scores = []
    illegal_counts = []

    for clip_id in unique_clips:
        mask = clip_ids == clip_id
        X_train, y_train = X[~mask], y[~mask]
        X_test, y_test = X[mask], y[mask]
        t_test = t[mask]

        model = _train_model(X_train, y_train, num_classes=len(phases))
        probs = model.predict(X_test)
        if probs.ndim == 1:
            probs = np.vstack([1.0 - probs, probs]).T

        phase_labels = [phases[idx] for idx in y_test.tolist()]
        pred_labels = _apply_smoothing(t_test, probs, phases)
        pred_indices = np.array([phases.index(p) for p in pred_labels], dtype=int)

        acc = _frame_accuracy(y_test, pred_indices)
        acc_scores.append(acc)

        gold_boundaries = _boundaries_from_labels(t_test, phase_labels)
        pred_boundaries = _boundaries_from_labels(t_test, pred_labels)
        boundary_scores.append(_boundary_error(gold_boundaries, pred_boundaries))

        illegal_counts.append(_illegal_transitions(pred_labels))

        print(
            f"[{clip_id}] acc={acc:.3f} "
            f"boundary_err={boundary_scores[-1]:.3f}s "
            f"illegal={illegal_counts[-1]}"
        )

    if acc_scores:
        print(f"Mean acc: {np.mean(acc_scores):.3f}")
        print(f"Mean boundary error: {np.mean(boundary_scores):.3f}s")
        print(f"Mean illegal transitions: {np.mean(illegal_counts):.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
