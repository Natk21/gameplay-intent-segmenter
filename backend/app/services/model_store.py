import os
from pathlib import Path
from typing import Optional, Tuple

import boto3


def _env(name: str) -> str | None:
    value = os.getenv(name)
    return value if value else None


def _model_dir() -> Path:
    return Path(os.getenv("MODEL_LOCAL_DIR", "/tmp/intent_model")).resolve()


def _model_paths() -> Tuple[Path, Path]:
    local_dir = _model_dir()
    return (
        local_dir / "intent_lgbm.txt",
        local_dir / "metadata.json",
    )


def download_model_if_needed() -> Optional[Tuple[Path, Path]]:
    endpoint_url = _env("R2_ENDPOINT") or _env("MODEL_S3_ENDPOINT_URL")
    bucket = _env("R2_BUCKET") or _env("MODEL_S3_BUCKET")
    access_key = _env("R2_ACCESS_KEY_ID") or _env("MODEL_S3_ACCESS_KEY_ID")
    secret_key = _env("R2_SECRET_ACCESS_KEY") or _env("MODEL_S3_SECRET_ACCESS_KEY")
    prefix = _env("MODEL_S3_PREFIX") or ""

    if not bucket or not access_key or not secret_key:
        return None

    model_path, metadata_path = _model_paths()
    model_path.parent.mkdir(parents=True, exist_ok=True)

    if model_path.exists() and metadata_path.exists():
        return model_path, metadata_path

    client = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )

    def key_for(name: str) -> str:
        if prefix and not prefix.endswith("/"):
            return f"{prefix}/{name}"
        return f"{prefix}{name}"

    client.download_file(bucket, key_for("intent_lgbm.txt"), str(model_path))
    client.download_file(bucket, key_for("metadata.json"), str(metadata_path))

    return model_path, metadata_path
