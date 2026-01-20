import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple


@dataclass
class ValidationIssue:
    clip_id: str
    level: str
    message: str


def _load_json(path: Path) -> Dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _validate_segments(
    clip_id: str,
    duration_s: float,
    segments: List[Dict],
    phases: List[str],
    eps: float = 1e-3,
) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []

    if not segments:
        issues.append(
            ValidationIssue(clip_id, "error", "No segments provided.")
        )
        return issues

    for idx, seg in enumerate(segments):
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", 0.0))
        phase = str(seg.get("phase", ""))

        if start < -eps:
            issues.append(
                ValidationIssue(
                    clip_id,
                    "error",
                    f"Segment {idx} start < 0 ({start}).",
                )
            )
        if end + eps < start:
            issues.append(
                ValidationIssue(
                    clip_id,
                    "error",
                    f"Segment {idx} end < start ({start} > {end}).",
                )
            )
        if phase not in phases:
            issues.append(
                ValidationIssue(
                    clip_id,
                    "error",
                    f"Segment {idx} has invalid phase '{phase}'.",
                )
            )

    # Order + coverage checks
    segments_sorted = sorted(segments, key=lambda s: float(s["start"]))
    if segments_sorted != segments:
        issues.append(
            ValidationIssue(clip_id, "error", "Segments not sorted by start.")
        )

    first_start = float(segments_sorted[0]["start"])
    if abs(first_start - 0.0) > eps:
        issues.append(
            ValidationIssue(
                clip_id,
                "error",
                f"First segment starts at {first_start}, expected 0.0.",
            )
        )

    prev_end = float(segments_sorted[0]["end"])
    for idx, seg in enumerate(segments_sorted[1:], start=1):
        start = float(seg["start"])
        if start - prev_end > eps:
            issues.append(
                ValidationIssue(
                    clip_id,
                    "error",
                    f"Gap between segments at index {idx - 1} -> {idx} "
                    f"({prev_end} to {start}).",
                )
            )
        if prev_end - start > eps:
            issues.append(
                ValidationIssue(
                    clip_id,
                    "error",
                    f"Overlap between segments at index {idx - 1} -> {idx} "
                    f"({prev_end} to {start}).",
                )
            )
        prev_end = float(seg["end"])

    if abs(prev_end - duration_s) > eps:
        issues.append(
            ValidationIssue(
                clip_id,
                "error",
                f"Last segment ends at {prev_end}, expected {duration_s}.",
            )
        )

    return issues


def validate_dataset(dataset_path: Path) -> Tuple[List[ValidationIssue], List[ValidationIssue]]:
    dataset = _load_json(dataset_path)
    phases = dataset.get("phases", [])
    items = dataset.get("items", [])

    errors: List[ValidationIssue] = []
    warnings: List[ValidationIssue] = []

    for item in items:
        clip_id = item["clip_id"]
        labels_path = dataset_path.parent / item["labels_path"]
        labels = _load_json(labels_path)

        issues = _validate_segments(
            clip_id=clip_id,
            duration_s=float(labels["duration_s"]),
            segments=labels["segments"],
            phases=phases,
        )
        for issue in issues:
            if issue.level == "error":
                errors.append(issue)
            else:
                warnings.append(issue)

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate intent labels.")
    parser.add_argument(
        "--dataset",
        required=True,
        help="Path to dataset.json",
    )
    args = parser.parse_args()
    dataset_path = Path(args.dataset).resolve()

    errors, warnings = validate_dataset(dataset_path)

    for issue in warnings:
        print(f"[WARN] {issue.clip_id}: {issue.message}")

    for issue in errors:
        print(f"[ERROR] {issue.clip_id}: {issue.message}")

    if errors:
        print(f"Validation failed with {len(errors)} errors.")
        return 1

    print("Validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
