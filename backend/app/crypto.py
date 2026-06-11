import base64
import hashlib
import json

from cryptography.fernet import Fernet


def _fernet(secret_key: str) -> Fernet:
    digest = hashlib.sha256(secret_key.encode()).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_token_data(secret_key: str, data: dict) -> str:
    payload = json.dumps(data).encode()
    return _fernet(secret_key).encrypt(payload).decode()


def decrypt_token_data(secret_key: str, token: str) -> dict:
    payload = _fernet(secret_key).decrypt(token.encode())
    return json.loads(payload.decode())
