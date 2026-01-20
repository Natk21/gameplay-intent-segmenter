import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.ml.sequence.viterbi import (
    merge_short_segments,
    sequence_to_segments,
    viterbi_decode,
)


@dataclass
class ModelBundle:
    model: Any
    phases: List[str]


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _default_paths() -> Tuple[Path, Path]:
    root = _repo_root()
    model_path = root / "datasets/intent_segmentation_v1/models/intent_lgbm.txt"
    metadata_path = root / "datasets/intent_segmentation_v1/processed/metadata.json"
    return model_path, metadata_path


def load_model_bundle(
    model_path: Path,
    metadata_path: Path,
) -> Optional[ModelBundle]:
    if not model_path.exists() or not metadata_path.exists():
        return None

    with metadata_path.open("r", encoding="utf-8") as handle:
        metadata = json.load(handle)
    phases = metadata.get("phases", [])
    if not phases:
        return None

    try:
        import lightgbm as lgb
    except Exception:
        return None

    model = lgb.Booster(model_file=str(model_path))
    return ModelBundle(model=model, phases=phases)


def load_default_model_bundle() -> Optional[ModelBundle]:
    model_path, metadata_path = _default_paths()
    return load_model_bundle(model_path, metadata_path)


def align_signal(
    target_times: List[float],
    source_times: List[float],
    source_values: List[float],
) -> List[float]:
    if not source_times or not source_values:
        return [0.0 for _ in target_times]

    return np.interp(
        np.array(target_times, dtype=float),
        np.array(source_times, dtype=float),
        np.array(source_values, dtype=float),
        left=0.0,
        right=0.0,
    ).astype(float).tolist()


def build_feature_matrix(
    motion: List[float],
    interaction: List[float],
    entropy: List[float],
    audio_energy: List[float],
    audio_flux: List[float],
) -> np.ndarray:
    min_len = min(
        len(motion),
        len(interaction),
        len(entropy),
        len(audio_energy),
        len(audio_flux),
    )
    if min_len <= 0:
        return np.empty((0, 5), dtype=np.float32)

    features = np.stack(
        [
            np.array(motion[:min_len], dtype=np.float32),
            np.array(interaction[:min_len], dtype=np.float32),
            np.array(entropy[:min_len], dtype=np.float32),
            np.array(audio_energy[:min_len], dtype=np.float32),
            np.array(audio_flux[:min_len], dtype=np.float32),
        ],
        axis=1,
    )
    return features


def segment_intent_phases_model(
    times: List[float],
    motion: List[float],
    interaction: List[float],
    entropy: List[float],
    audio_energy: List[float],
    audio_flux: List[float],
    model_bundle: ModelBundle,
    min_durations: Optional[Dict[str, float]] = None,
    penalty_scale: float = 1.0,
) -> List[Dict[str, float | str]]:
    if not times or not motion:
        return []

    features = build_feature_matrix(
        motion,
        interaction,
        entropy,
        audio_energy,
        audio_flux,
    )
    if features.size == 0:
        return []

    used_len = min(len(times), features.shape[0])
    times = times[:used_len]
    features = features[:used_len]

    probs = model_bundle.model.predict(features)
    if probs.ndim == 1:
        probs = np.vstack([1.0 - probs, probs]).T

    log_probs = np.log(np.clip(probs, 1e-9, 1.0))
    phases = model_bundle.phases
    phase_seq = viterbi_decode(log_probs, phases, penalty_scale=penalty_scale)

    segments = sequence_to_segments(times, phase_seq)

    if min_durations is None:
        min_durations = {
            "Explore": 1.6,
            "Pursue": 1.0,
            "Execute": 0.5,
            "Outcome": 0.7,
        }
    segments = merge_short_segments(segments, min_durations)

    for seg in segments:
        seg["why"] = "Model inference with Viterbi smoothing."

    return segments
