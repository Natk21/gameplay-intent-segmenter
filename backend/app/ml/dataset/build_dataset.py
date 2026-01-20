import argparse
import json
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np


def _load_json(path: Path) -> Dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _segments_to_frame_labels(
    times: List[float],
    segments: List[Dict],
) -> List[str]:
    labels: List[str] = []
    seg_idx = 0
    segments_sorted = sorted(segments, key=lambda s: float(s["start"]))

    for t in times:
        while seg_idx < len(segments_sorted) - 1 and t >= float(
            segments_sorted[seg_idx]["end"]
        ):
            seg_idx += 1

        labels.append(segments_sorted[seg_idx]["phase"])

    return labels


def _load_signals(signals_path: Path) -> Dict[str, np.ndarray]:
    data = np.load(signals_path)
    return {key: data[key] for key in data.files}


def build_dataset(
    dataset_path: Path,
    signals_dir: Path,
    output_dir: Path,
) -> Tuple[Path, Path]:
    dataset = _load_json(dataset_path)
    phases = dataset.get("phases", [])
    phase_to_index = {phase: idx for idx, phase in enumerate(phases)}

    X_rows: List[np.ndarray] = []
    y_rows: List[np.ndarray] = []
    t_rows: List[np.ndarray] = []
    clip_rows: List[np.ndarray] = []

    items = dataset.get("items", [])
    for item in items:
        clip_id = item["clip_id"]
        labels_path = dataset_path.parent / item["labels_path"]
        label_data = _load_json(labels_path)
        segments = label_data["segments"]

        signals_path = signals_dir / f"{clip_id}.npz"
        signals = _load_signals(signals_path)

        times = signals["t"].astype(float).tolist()
        labels = _segments_to_frame_labels(times, segments)

        motion = signals["motion"].astype(float)
        interaction = signals["interaction"].astype(float)
        entropy = signals["entropy"].astype(float)
        audio_energy = signals.get("audio_energy", np.zeros_like(motion)).astype(float)
        audio_flux = signals.get("audio_flux", np.zeros_like(motion)).astype(float)

        min_len = min(
            len(times),
            len(motion),
            len(interaction),
            len(entropy),
            len(audio_energy),
            len(audio_flux),
            len(labels),
        )

        features = np.stack(
            [
                motion[:min_len],
                interaction[:min_len],
                entropy[:min_len],
                audio_energy[:min_len],
                audio_flux[:min_len],
            ],
            axis=1,
        )

        label_indices = np.array(
            [phase_to_index[label] for label in labels[:min_len]],
            dtype=np.int32,
        )

        X_rows.append(features)
        y_rows.append(label_indices)
        t_rows.append(np.array(times[:min_len], dtype=np.float32))
        clip_rows.append(
            np.array([clip_id] * min_len, dtype="<U16")
        )

    X = np.concatenate(X_rows, axis=0)
    y = np.concatenate(y_rows, axis=0)
    t = np.concatenate(t_rows, axis=0)
    clip_ids = np.concatenate(clip_rows, axis=0)

    output_dir.mkdir(parents=True, exist_ok=True)
    dataset_out = output_dir / "dataset.npz"
    metadata_out = output_dir / "metadata.json"

    np.savez_compressed(
        dataset_out,
        X=X.astype(np.float32),
        y=y.astype(np.int32),
        t=t.astype(np.float32),
        clip_ids=clip_ids,
    )

    with metadata_out.open("w", encoding="utf-8") as handle:
        json.dump(
            {
                "phases": phases,
                "phase_to_index": phase_to_index,
                "features": [
                    "motion",
                    "interaction",
                    "entropy",
                    "audio_energy",
                    "audio_flux",
                ],
            },
            handle,
            indent=2,
        )

    return dataset_out, metadata_out


def main() -> int:
    parser = argparse.ArgumentParser(description="Build frame-level dataset.")
    parser.add_argument(
        "--dataset",
        required=True,
        help="Path to dataset.json",
    )
    parser.add_argument(
        "--signals-dir",
        default=None,
        help="Directory containing signal npz files.",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Output directory for processed dataset.",
    )
    args = parser.parse_args()

    dataset_path = Path(args.dataset).resolve()
    signals_dir = (
        Path(args.signals_dir).resolve()
        if args.signals_dir
        else dataset_path.parent / "signals"
    )
    output_dir = (
        Path(args.output_dir).resolve()
        if args.output_dir
        else dataset_path.parent / "processed"
    )

    dataset_out, metadata_out = build_dataset(
        dataset_path=dataset_path,
        signals_dir=signals_dir,
        output_dir=output_dir,
    )

    print(f"[dataset] Saved {dataset_out}")
    print(f"[dataset] Saved {metadata_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
