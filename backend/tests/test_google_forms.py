import json
import re
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit

import httpx
from fastapi.testclient import TestClient

from app import db
from app.adapters.google_api import GoogleFormsAPI
from app.main import create_app

SURVEY = Path(__file__).resolve().parents[2] / "survey"
HR = {"Authorization": "Bearer test-hr"}
MANAGE = "/api/hr/google-forms"


class GoogleAPI:
    def __init__(self):
        self.forms = {}
        self.responses = {}
        self.drop_create_response = True
        self.refreshes = 0

    def __call__(self, request):
        path = request.url.path
        if request.url.host == "oauth2.googleapis.com":
            assert parse_qs(request.content.decode())["refresh_token"] == ["test-refresh"]
            self.refreshes += 1
            return httpx.Response(200, json={"access_token": "access", "expires_in": 3600})
        assert request.headers["Authorization"] == "Bearer access"
        if path == "/drive/v3/files":
            name = re.search(r"name = '([^']+)'", request.url.params["q"])[1]
            return httpx.Response(200, json={"files": [
                {"id": fid} for fid, form in self.forms.items() if form["info"]["documentTitle"] == name
            ]})
        if path == "/v1/forms":
            assert request.url.params["unpublished"] == "true"
            fid = f"test-{len(self.forms) + 1}"
            self.forms[fid] = {"formId": fid, "info": json.loads(request.content)["info"], "items": [],
                               "responderUri": f"https://docs.google.com/forms/d/e/{fid}/viewform"}
            self.responses[fid] = []
            if self.drop_create_response:
                self.drop_create_response = False
                raise httpx.ReadTimeout("provider committed but response was lost")
            return httpx.Response(200, json={"formId": fid})
        fid, action = re.fullmatch(r"/v1/forms/([^:/]+)(.*)", path).groups()
        form = self.forms[fid]
        if action == ":batchUpdate":
            assert not form["items"]
            form["items"] = [op["createItem"]["item"] for op in json.loads(request.content)["requests"]]
            return httpx.Response(200, json={})
        if action == ":setPublishSettings":
            form.update(json.loads(request.content))
            return httpx.Response(200, json={})
        if action == "/responses":
            rows = self.responses[fid]
            if len(rows) > 1 and "pageToken" not in request.url.params:
                return httpx.Response(200, json={"responses": rows[:1], "nextPageToken": "next"})
            return httpx.Response(200, json={"responses": rows[1:] if "pageToken" in request.url.params else rows})
        assert request.method == "GET" and not action
        return httpx.Response(200, json=form)

    def submit(self, fid, external_id, code):
        def answer(item):
            question = item["questionItem"]["question"]
            if item["title"] == "Код приглашения":
                return code
            if question.get("choiceQuestion"):
                return question["choiceQuestion"]["options"][3]["value"]
            return "IT" if "Подразделение" in item["title"] else "Работаю над задачей."
        self.responses[fid].append({
            "responseId": external_id, "createTime": "2026-11-26T09:00:00Z",
            "answers": {item["questionItem"]["question"]["questionId"]: {
                "textAnswers": {"answers": [{"value": answer(item)}]},
            } for item in self.forms[fid]["items"]},
        })


def test_google_forms_creation_and_sync(settings_factory):
    provider = GoogleAPI()
    settings = settings_factory(
        survey_dir=SURVEY, google_forms_client_id="client", google_forms_client_secret="secret",
        google_forms_refresh_token="test-refresh", google_forms_hr_key="test-hr",
        google_forms_link_secret="test-link-secret", google_forms_poll_seconds=0,
    )
    app = create_app(settings)
    ctx = app.state.ctx
    ctx.google_forms_api = GoogleFormsAPI(settings, httpx.MockTransport(provider))
    with TestClient(app) as client:
        with ctx.connect() as conn:
            db.create_pair(conn, "СТ-001", "Н-001")
            db.create_pair(conn, "СТ-002", "Н-001")
        assert client.get(MANAGE).status_code == 401
        body = {"cohort": "Тестовый поток"}
        assert client.post(MANAGE, json=body, headers=HR).status_code == 502
        created = client.post(MANAGE, json=body, headers=HR)
        assert created.status_code == 200, created.text
        assert client.post(MANAGE, json=body, headers=HR).json() == created.json()
        assert len(provider.forms) == 2
        assert provider.refreshes == 1

        def link(role, intern_id="СТ-001"):
            return client.post(MANAGE + "/link", headers=HR, json={"role": role, "pair_id": db.pair_id_for(intern_id)})

        def token(reply):
            assert reply.status_code == 200, reply.text
            params = parse_qs(urlsplit(reply.json()["url"]).query)
            assert list(params) == ["usp", "entry.123456"]
            return params["entry.123456"][0]

        assert link("intern").status_code == 422
        published = {form["role"]: form for form in created.json()["forms"]}
        for role, scales in (("intern", 7), ("mentor", 6)):
            fid = published[role]["form_id"]
            remote = provider.forms[fid]
            questions = [item["questionItem"]["question"] for item in remote["items"]]
            assert sum("choiceQuestion" in q for q in questions) == scales
            assert sum(q.get("textQuestion", {}).get("paragraph", False) for q in questions) == 2
            url = remote["responderUri"] + "?" + urlencode({"entry.123456": created.json()["prefill_sample"]})
            opposite = "mentor" if role == "intern" else "intern"
            assert client.post(MANAGE + "/prefill", headers=HR, json={"role": opposite, "url": url}).status_code == 422
            assert client.post(MANAGE + "/prefill", headers=HR, json={"role": role, "url": url}).status_code == 200

        intern = published["intern"]["form_id"]
        mentor = published["mentor"]["form_id"]
        intern_code = token(link("intern"))
        mentor_code = token(link("mentor"))
        assert mentor_code != token(link("mentor", "СТ-002"))
        provider.submit(intern, "1", intern_code)
        provider.submit(intern, "2", intern_code)
        provider.submit(mentor, "1", intern_code)
        provider.submit(mentor, "2", mentor_code)

        synced = client.post(MANAGE + "/sync", headers=HR)
        assert synced.status_code == 200, synced.text
        assert client.get("/api/health").json()["responses"] == 2
        assert link("intern").json()["month"] == link("mentor").json()["month"] == 2
        assert link("mentor", "СТ-002").json()["month"] == 1
        assert token(link("intern")) != intern_code
        assert client.post(MANAGE + "/sync", headers=HR).status_code == 200
        with ctx.connect() as conn:
            assert conn.execute("SELECT count(*) FROM google_form_deliveries").fetchone()[0] == 4
            assert conn.execute("SELECT count(*) FROM google_form_deliveries WHERE analyzed_at IS NOT NULL").fetchone()[0] == 2
            assert {tuple(row) for row in conn.execute("SELECT source, department FROM responses")} == {("google_forms", "IT")}
