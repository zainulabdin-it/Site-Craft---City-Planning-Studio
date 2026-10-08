"""Asset storage boundary. No uploads are exposed in Phase 1."""
from pathlib import Path
from typing import Protocol
import re

def safe_key(key: str) -> str:
    if not re.fullmatch(r'[a-zA-Z0-9_-]+\.(glb|gltf|png|jpg)', key):
        raise ValueError('Invalid asset key or unsupported file extension')
    return key

class AssetStorage(Protocol):
    def put(self, key: str, content: bytes) -> str: ...

class LocalStorage:
    def __init__(self, root: Path): self.root = root.resolve()
    def put(self, key: str, content: bytes) -> str:
        path = self.root / safe_key(key)
        self.root.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return str(path)

class S3Storage:
    def __init__(self, bucket: str, endpoint: str, public_base: str):
        import boto3
        self.client = boto3.client('s3', endpoint_url=endpoint)
        self.bucket, self.public_base = bucket, public_base.rstrip('/')
    def put(self, key: str, content: bytes) -> str:
        key = safe_key(key)
        self.client.put_object(Bucket=self.bucket, Key=key, Body=content)
        return f'{self.public_base}/{key}'
