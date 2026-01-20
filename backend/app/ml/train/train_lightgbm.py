import argparse
import json
from pathlib import Path
from typing import Dict, Tuple

import lightgbm as lgb
import numpy as np


def _load_dataset(dataset_path: Path) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    data = np.load(dataset_path)
    return data["X"], data["y"], data["clip_ids"]


def _load_metadata(metadata_path: Path) -> Dict:
    with metadata_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def train_model(X: np.ndarray, y: np.ndarray, num_classes: int) -> lgb.Booster:
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
    model = lgb.train(
        params,
        dataset,
        num_boost_round=200,
    )
    return model


def main() -> int:
    parser = argparse.ArgumentParser(description="Train LightGBM model.")
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
    parser.add_argument(
        "--output",
        required=True,
        help="Output model file path.",
    )
    args = parser.parse_args()

    dataset_path = Path(args.dataset).resolve()
    metadata_path = Path(args.metadata).resolve()
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    X, y, _ = _load_dataset(dataset_path)
    metadata = _load_metadata(metadata_path)
    phases = metadata["phases"]

    model = train_model(X, y, num_classes=len(phases))
    model.save_model(str(output_path))
    print(f"[model] Saved {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
