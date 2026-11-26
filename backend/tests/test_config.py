import os
from pathlib import Path

from app.config import BACKEND_DIR, Settings, load_env_files

REPO = BACKEND_DIR.parent


def test_env_file_does_not_override_environment(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text('# комментарий\nLLM_PROVIDER=openai\nLLM_MODEL="qwen2.5:7b"\nGSHEET_POLL_SECONDS=30\nпусто\n', encoding="utf-8")
    environ = {k: v for k, v in os.environ.items() if k not in ("LLM_MODEL", "GSHEET_POLL_SECONDS")}
    monkeypatch.setattr(os, "environ", {**environ, "LLM_PROVIDER": "rules"})  # файл пишет сюда, а не в настоящее окружение
    load_env_files((env,))
    s = Settings.from_env()
    assert s.llm_provider == "rules"  # окружение главнее файла
    assert s.llm_model == "qwen2.5:7b"
    assert s.gsheet_poll_seconds == 30


def test_env_example_lists_every_setting():
    names = {line.split("=", 1)[0] for line in (REPO / ".env.example").read_text(encoding="utf-8").splitlines()
             if "=" in line and not line.startswith("#")}
    assert names == {"DB_PATH", "SURVEY_DIR", "SAMPLE_DIR", "LLM_PROVIDER", "LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY",
                     "GSHEET_CSV_URL_INTERN", "GSHEET_CSV_URL_MENTOR", "GSHEET_POLL_SECONDS", "GOOGLE_FORMS_CLIENT_ID",
                     "GOOGLE_FORMS_CLIENT_SECRET", "GOOGLE_FORMS_REFRESH_TOKEN", "GOOGLE_FORMS_HR_KEY",
                     "GOOGLE_FORMS_LINK_SECRET", "GOOGLE_FORMS_POLL_SECONDS", "FORM_SECRET"}


def test_relative_paths_are_from_backend(monkeypatch):
    monkeypatch.setenv("SURVEY_DIR", "../survey")
    assert Settings.from_env().survey_dir == (REPO / "survey").resolve()
    assert Path(Settings.from_env().db_path).is_absolute()
