"""Подпись личных ссылок на анкету: token = base64url(HMAC-SHA256(secret, "роль:ID"))[:16]."""

import base64
import hashlib
import hmac
import os
import secrets
from pathlib import Path

SECRET_FILE = "form_secret"


def make_token(secret: str, role: str, person_id: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), f"{role}:{person_id}".encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")[:16]


def valid_token(secret: str, role: str, person_id: str, token: str) -> bool:
    return hmac.compare_digest(make_token(secret, role, person_id), token)


def load_secret(configured: str, var_dir: Path) -> str:
    """FORM_SECRET из окружения, иначе случайный ключ в папке с базой: ссылки переживают перезапуск."""
    if configured:
        return configured
    path = var_dir / SECRET_FILE
    try:
        return path.read_text(encoding="utf-8").strip() or _create(path)
    except FileNotFoundError:
        return _create(path)


def _create(path: Path) -> str:
    value = secrets.token_urlsafe(32)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Права 600 с первого байта, и не затираем ключ, который успел создать другой процесс.
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return path.read_text(encoding="utf-8").strip()
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(value)
    return value
