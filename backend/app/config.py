"""Пути и переменные окружения. Относительные пути считаются от папки backend/."""

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILES = (BACKEND_DIR.parent / ".env", BACKEND_DIR / ".env")


def load_env_files(files: tuple[Path, ...] = ENV_FILES) -> None:
    """Строки KEY=VALUE из .env. Переменные окружения главнее файла."""
    for f in files:
        if not f.is_file():
            continue
        for line in f.read_text(encoding="utf-8").splitlines():
            key, sep, value = line.strip().partition("=")
            if not sep or key.startswith("#"):
                continue
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            os.environ.setdefault(key.strip(), value)


def _path(name: str, default: str) -> Path:
    raw = os.environ.get(name) or default
    p = Path(raw).expanduser()
    return p if p.is_absolute() else (BACKEND_DIR / p).resolve()


@dataclass(frozen=True)
class Settings:
    db_path: Path
    survey_dir: Path
    sample_dir: Path
    llm_provider: str
    llm_base_url: str
    llm_model: str
    llm_api_key: str
    gsheet_csv_url_intern: str
    gsheet_csv_url_mentor: str
    gsheet_poll_seconds: int
    # Подпись личных ссылок на анкету. Пусто: ключ создаётся в папке с базой.
    form_secret: str = ""
    google_forms_client_id: str = ""
    google_forms_client_secret: str = ""
    google_forms_refresh_token: str = ""
    google_forms_hr_key: str = ""
    google_forms_link_secret: str = ""
    google_forms_poll_seconds: int = 15

    @classmethod
    def from_env(cls) -> "Settings":
        load_env_files()
        return cls(
            db_path=_path("DB_PATH", "var/app.sqlite"),
            survey_dir=_path("SURVEY_DIR", "../survey"),
            sample_dir=_path("SAMPLE_DIR", "../data/mgts"),
            llm_provider=(os.environ.get("LLM_PROVIDER") or "rules").strip().lower(),
            llm_base_url=(os.environ.get("LLM_BASE_URL") or "http://localhost:11434/v1").rstrip("/"),
            llm_model=os.environ.get("LLM_MODEL") or "qwen3:8b",
            llm_api_key=os.environ.get("LLM_API_KEY") or "",
            gsheet_csv_url_intern=os.environ.get("GSHEET_CSV_URL_INTERN") or "",
            gsheet_csv_url_mentor=os.environ.get("GSHEET_CSV_URL_MENTOR") or "",
            gsheet_poll_seconds=int(os.environ.get("GSHEET_POLL_SECONDS") or 0),
            form_secret=(os.environ.get("FORM_SECRET") or "").strip(),
            google_forms_client_id=os.environ.get("GOOGLE_FORMS_CLIENT_ID", "").strip(),
            google_forms_client_secret=os.environ.get("GOOGLE_FORMS_CLIENT_SECRET", "").strip(),
            google_forms_refresh_token=os.environ.get("GOOGLE_FORMS_REFRESH_TOKEN", "").strip(),
            google_forms_hr_key=os.environ.get("GOOGLE_FORMS_HR_KEY", "").strip(),
            google_forms_link_secret=os.environ.get("GOOGLE_FORMS_LINK_SECRET", "").strip(),
            google_forms_poll_seconds=int(os.environ.get("GOOGLE_FORMS_POLL_SECONDS") or 15),
        )
