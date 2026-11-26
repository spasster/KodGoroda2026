"""OAuth и HTTP для Google Forms API и Drive API."""

import threading
import time

import httpx

from ..config import Settings

FORMS_API = "https://forms.googleapis.com/v1"
DRIVE_API = "https://www.googleapis.com/drive/v3"
TOKEN_URL = "https://oauth2.googleapis.com/token"


class GoogleFormsError(Exception):
    """Ошибка доступа или вызова Google API."""


class GoogleFormsAPI:
    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None):
        self.settings = settings
        self.transport = transport
        self._token = ""
        self._expires_at = 0.0
        self._lock = threading.Lock()

    @property
    def configured(self) -> bool:
        s = self.settings
        return bool(s.google_forms_client_id and s.google_forms_client_secret and s.google_forms_refresh_token)

    def _access_token(self, client: httpx.Client) -> str:
        s = self.settings
        if not self.configured:
            raise GoogleFormsError("Настройте OAuth для Google Forms API в окружении сервера.")
        with self._lock:
            if time.monotonic() < self._expires_at:
                return self._token
            data = self._request(client, "POST", TOKEN_URL, data={
                "grant_type": "refresh_token",
                "client_id": s.google_forms_client_id,
                "client_secret": s.google_forms_client_secret,
                "refresh_token": s.google_forms_refresh_token,
            })
            token, expires_in = data.get("access_token"), data.get("expires_in")
            if not isinstance(token, str) or not token or not isinstance(expires_in, int) or expires_in <= 0:
                raise GoogleFormsError("Google не вернул действующий access token.")
            self._token = token
            self._expires_at = time.monotonic() + max(0, expires_in - 60)
            return token

    def client(self) -> httpx.Client:
        try:
            return httpx.Client(timeout=12, transport=self.transport)
        except (ImportError, ValueError) as exc:
            raise GoogleFormsError("Сервер не смог настроить HTTP-прокси для Google.") from exc

    def request(self, client: httpx.Client, method: str, url: str, **kwargs) -> dict:
        token = self._access_token(client)
        return self._request(client, method, url, headers={"Authorization": f"Bearer {token}"}, **kwargs)

    @staticmethod
    def _request(client: httpx.Client, method: str, url: str, **kwargs) -> dict:
        try:
            response = client.request(method, url, **kwargs)
            response.raise_for_status()
            result = response.json()
            if isinstance(result, dict):
                return result
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if url == TOKEN_URL and status in (400, 401, 403):
                raise GoogleFormsError("Google отклонил OAuth. Проверьте данные клиента и refresh token.") from exc
            if status in (401, 403):
                raise GoogleFormsError("Google отклонил запрос. Проверьте права drive.file и доступ к форме.") from exc
            raise GoogleFormsError(f"Google Forms API вернул HTTP {status}.") from exc
        except httpx.RequestError as exc:
            raise GoogleFormsError("Сервер не получил ответ от Google.") from exc
        except ValueError as exc:
            raise GoogleFormsError("Google API вернул неизвестный формат.") from exc
        raise GoogleFormsError("Google API вернул неизвестный формат.")
