import os
from typing import Optional

import boto3
from botocore.config import Config


R2_BUCKET = os.getenv("R2_BUCKET")
R2_ENDPOINT = os.getenv("R2_ENDPOINT")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL")


def r2_enabled() -> bool:
    return all([R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY])


def _get_client():
    if not r2_enabled():
        raise RuntimeError("R2 storage is not configured.")
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def upload_bytes(key: str, data: bytes, content_type: Optional[str] = None) -> None:
    client = _get_client()
    extra = {"ContentType": content_type} if content_type else {}
    client.put_object(Bucket=R2_BUCKET, Key=key, Body=data, **extra)


def download_to_path(key: str, destination: str) -> None:
    client = _get_client()
    client.download_file(R2_BUCKET, key, destination)


def get_public_url(key: str) -> Optional[str]:
    if not R2_PUBLIC_URL:
        return None
    return f"{R2_PUBLIC_URL.rstrip('/')}/{key.lstrip('/')}"
