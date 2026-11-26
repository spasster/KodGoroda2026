"""Две Google Формы на поток, персональные приглашения и синхронизация ответов."""

import asyncio
import hashlib
import hmac
import json
import logging
import re
import secrets
from datetime import timedelta
from urllib.parse import parse_qsl, urlencode, urlsplit

from .. import db
from ..context import Context
from ..importer import iso, parse_datetime
from ..ingest import IngestError, validate
from ..survey import ROLES, Survey, next_unanswered_month
from .google_api import DRIVE_API, FORMS_API, GoogleFormsError

log = logging.getLogger(__name__)
PREFILL_SAMPLE = "MGTS-PREFILL"
FORM_ID = re.compile(r"[A-Za-z0-9_-]{1,256}")
RESPONDER_PATH = re.compile(r"/forms/d/(?:e/)?[A-Za-z0-9_-]+/viewform/?")
ENTRY_PARAM = re.compile(r"entry\.-?\d{1,20}")
SOURCE = "google_forms"


def _template(survey: Survey, role: str) -> dict:
    fields = [{"key": "invitation", "title": "Код приглашения", "type": "string", "required": True}]
    if department := survey.technical_fields.get("department"):
        fields.append({"key": "department", "title": department, "type": "string", "required": True})
    for question in survey.questions(role, include_legacy=False):
        field = {"key": question.id, "title": question.text, "type": question.type,
                 "required": question.type == "scale"}
        if question.type == "scale":
            field["options"] = [
                f"{score} — {question.score_labels[str(score)]}" if str(score) in question.score_labels else str(score)
                for score in range(int(survey.scale_min), int(survey.scale_max) + 1)
            ]
        fields.append(field)
    for field in fields:
        field["id"] = hashlib.sha256(f"{role}:{field['key']}".encode()).hexdigest()[:8]
    return {"title": survey.roles[role]["title"], "fields": fields}


def _new_item(field: dict) -> dict:
    question = {"questionId": field["id"], "required": field["required"]}
    if field["type"] == "scale":
        question["choiceQuestion"] = {"type": "RADIO", "options": [{"value": option} for option in field["options"]]}
    else:
        question["textQuestion"] = {"paragraph": field["type"] == "text"}
    item = {"title": field["title"], "questionItem": {"question": question}}
    if field["key"] == "invitation":
        item["description"] = "Код заполняется по личной ссылке. Оставьте его как есть."
    return item


def _recover_form(api, client, title: str) -> str | None:
    # Имя документа генерируется платформой и содержит только ASCII без кавычек.
    result = api.request(client, "GET", DRIVE_API + "/files", params={
        "q": f"name = '{title}' and mimeType = 'application/vnd.google-apps.form' and trashed = false",
        "fields": "files(id)", "pageSize": 2,
    })
    matches = result.get("files", [])
    if len(matches) > 1:
        raise GoogleFormsError("Google вернул несколько черновиков с одинаковым именем.")
    return matches[0]["id"] if matches else None


def _responder_url(url: str) -> str:
    try:
        parsed = urlsplit(url)
    except ValueError as exc:
        raise IngestError("Ссылка Google Forms повреждена.") from exc
    if parsed.scheme != "https" or parsed.netloc != "docs.google.com" or not RESPONDER_PATH.fullmatch(parsed.path):
        raise IngestError("Ожидается полная ссылка Google Forms на страницу заполнения.")
    return f"https://docs.google.com{parsed.path.rstrip('/')}"


def _publish(ctx: Context, client, row) -> None:
    api = ctx.google_forms_api
    template = json.loads(row["template"])
    form_id = row["form_id"]
    if not form_id:
        form_id = _recover_form(api, client, row["document_title"])
        if not form_id:
            created = api.request(client, "POST", FORMS_API + "/forms", params={"unpublished": "true"}, json={
                "info": {"title": f"{template['title']} · {row['cohort']}", "documentTitle": row["document_title"]},
            })
            form_id = created.get("formId")
        if not isinstance(form_id, str) or not FORM_ID.fullmatch(form_id):
            raise GoogleFormsError("Google не вернул ID формы.")
        with ctx.connect() as conn:
            conn.execute("UPDATE google_forms SET form_id = ? WHERE role = ?", (form_id, row["role"]))

    url = f"{FORMS_API}/forms/{form_id}"
    form = api.request(client, "GET", url)
    items = form.get("items") or []
    existing = {item.get("questionItem", {}).get("question", {}).get("questionId") for item in items}
    missing = [field for field in template["fields"] if field["id"] not in existing]
    if missing:
        request = {"requests": [
            {"createItem": {"item": _new_item(field), "location": {"index": len(items) + i}}}
            for i, field in enumerate(missing)
        ]}
        if revision := form.get("revisionId"):
            request["writeControl"] = {"requiredRevisionId": revision}
        api.request(client, "POST", url + ":batchUpdate", json=request)
    if form.get("publishSettings", {}).get("publishState") != {"isPublished": True, "isAcceptingResponses": True}:
        api.request(client, "POST", url + ":setPublishSettings", json={
            "publishSettings": {"publishState": {"isPublished": True, "isAcceptingResponses": True}},
        })
    form = api.request(client, "GET", url)
    try:
        responder_url = _responder_url(form.get("responderUri") or "")
    except (IngestError, TypeError, AttributeError) as exc:
        raise GoogleFormsError("Google не вернул ссылку для респондентов.") from exc
    with ctx.connect() as conn:
        conn.execute("UPDATE google_forms SET responder_url = ? WHERE role = ?", (responder_url, row["role"]))


def create_forms(ctx: Context, cohort: str) -> None:
    api = ctx.google_forms_api
    if not api.configured or not ctx.settings.google_forms_link_secret:
        raise GoogleFormsError("Настройте Google OAuth и секрет личных ссылок на сервере.")
    with ctx.google_forms_lock:
        with ctx.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            rows = list(conn.execute("SELECT * FROM google_forms"))
            if rows and rows[0]["cohort"] != cohort:
                raise IngestError(f"В этой базе уже настроен поток «{rows[0]['cohort']}».")
            for role in ROLES:
                if any(row["role"] == role for row in rows):
                    continue
                conn.execute(
                    "INSERT INTO google_forms (role, cohort, document_title, template) VALUES (?, ?, ?, ?)",
                    (role, cohort, f"MGTS {role} {secrets.token_hex(8)}",
                     json.dumps(_template(ctx.survey, role), ensure_ascii=False)),
                )
            drafts = list(conn.execute("SELECT * FROM google_forms WHERE responder_url IS NULL ORDER BY role"))
        with api.client() as client:
            for draft in drafts:
                _publish(ctx, client, draft)


def save_prefill(ctx: Context, role: str, url: str) -> None:
    if not ctx.settings.google_forms_link_secret:
        raise IngestError("Администратору нужно настроить секрет личных ссылок.")
    link = _responder_url(url)
    params = parse_qsl(urlsplit(url).query)
    entries = [key for key, value in params if ENTRY_PARAM.fullmatch(key) and value == PREFILL_SAMPLE]
    if len(entries) != 1 or sum(bool(ENTRY_PARAM.fullmatch(key)) for key, _ in params) != 1:
        raise IngestError(f"Заполните только поле «Код приглашения» значением {PREFILL_SAMPLE} и скопируйте ссылку.")
    with ctx.connect() as conn:
        result = conn.execute("UPDATE google_forms SET entry_param = ? WHERE role = ? AND responder_url = ?",
                              (entries[0], role, link))
        if not result.rowcount:
            raise IngestError("Ссылка должна вести на Google Форму выбранной роли.")


def forms_status(ctx: Context) -> dict:
    forms = []
    with ctx.connect() as conn:
        for row in conn.execute("SELECT * FROM google_forms ORDER BY role"):
            form_id = row["form_id"]
            item = {"role": row["role"], "cohort": row["cohort"], "title": json.loads(row["template"])["title"],
                    "form_id": form_id, "published": bool(row["responder_url"]), "ready": bool(row["entry_param"]),
                    "edit_url": f"https://docs.google.com/forms/d/{form_id}/edit" if form_id else None,
                    "synced_at": row["synced_at"], "sync_error": row["sync_error"], "last_delivery": None}
            if form_id:
                last = conn.execute(
                    "SELECT d.external_id, d.pair_id, d.month, d.received_at, d.analyzed_at, d.rejection"
                    " FROM google_form_deliveries d LEFT JOIN responses r ON r.id = d.response_id"
                    " WHERE d.form_id = ? AND (r.id IS NOT NULL OR d.rejection IS NOT NULL)"
                    " ORDER BY d.received_at DESC, d.rowid DESC LIMIT 1", (form_id,)
                ).fetchone()
                item["last_delivery"] = dict(last) if last else None
            forms.append(item)
    return {"forms": forms, "prefill_sample": PREFILL_SAMPLE}


def _next_month(conn, ctx: Context, pair_id: str, role: str) -> int | None:
    rows = conn.execute("SELECT month FROM responses WHERE pair_id = ? AND role = ?", (pair_id, role))
    return next_unanswered_month(ctx.survey.months, (row["month"] for row in rows))


def _code_hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def personal_link(ctx: Context, pair_id: str, role: str) -> dict:
    with ctx.connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        form = conn.execute("SELECT * FROM google_forms WHERE role = ? AND entry_param IS NOT NULL", (role,)).fetchone()
        secret = ctx.settings.google_forms_link_secret
        if not form or not secret:
            raise IngestError("Сначала подключите предзаполнение Google Формы в разделе «Опросы».")
        pair = conn.execute("SELECT * FROM pairs WHERE pair_id = ?", (pair_id,)).fetchone()
        if not pair:
            raise IngestError("Пара не найдена.")
        month = _next_month(conn, ctx, pair_id, role)
        if month is None:
            raise IngestError("Все анкеты уже получены.")
        person = pair[f"{role}_id"]
        code = _invite_code(secret, form["form_id"], role, pair["intern_id"], person, month)
        conn.execute(
            "INSERT INTO google_form_invites (code_hash, form_id, pair_id, person_id, month) VALUES (?, ?, ?, ?, ?)"
            " ON CONFLICT(code_hash) DO NOTHING",
            (_code_hash(code), form["form_id"], pair_id, person, month),
        )
        query = urlencode({"usp": "pp_url", form["entry_param"]: code})
        return {"url": f"{form['responder_url']}?{query}", "month": month}


def _invite_code(secret: str, form_id: str, role: str, intern_id: str, person_id: str, month: int) -> str:
    message = json.dumps([form_id, role, intern_id, person_id, month], ensure_ascii=False)
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


def _form_values(response: dict, template: dict) -> dict:
    answers = response.get("answers") or {}
    values = {}
    for field in template["fields"]:
        options = answers.get(field["id"], {}).get("textAnswers", {}).get("answers") or []
        if len(options) == 1:
            values[field["key"]] = options[0].get("value")
    return values


def _save_response(conn, ctx: Context, form, template: dict, response: dict) -> tuple[int, str, int]:
    values = _form_values(response, template)
    code = values.pop("invitation", None)
    if not isinstance(code, str) or not re.fullmatch(r"[a-f0-9]{64}", code):
        raise IngestError("В ответе нет действующего кода приглашения.")
    invite = conn.execute(
        "SELECT i.*, p.intern_id, p.mentor_id FROM google_form_invites i JOIN pairs p USING(pair_id)"
        " WHERE i.code_hash = ? AND i.form_id = ?", (_code_hash(code), form["form_id"]),
    ).fetchone()
    role = form["role"]
    if not invite or invite["person_id"] != invite[f"{role}_id"] or not hmac.compare_digest(
        code, _invite_code(ctx.settings.google_forms_link_secret, form["form_id"], role, invite["intern_id"],
                           invite["person_id"], invite["month"]),
    ):
        raise IngestError("Код приглашения не относится к этой форме или назначению.")
    pair_id, month = invite["pair_id"], invite["month"]
    if _next_month(conn, ctx, pair_id, role) != month:
        raise IngestError("По приглашению уже ответили или период изменился.")
    department = values.pop("department", None)
    for field in template["fields"]:
        value = values.get(field["key"])
        if field["type"] == "scale" and value not in field["options"]:
            raise IngestError("В ответе отсутствует оценка или изменена шкала Google Формы.")
        if field["key"] == "department" and (not isinstance(department, str) or not department.strip()):
            raise IngestError("В ответе не указано подразделение.")
    data = validate(ctx.survey, {
        "role": role, "person_id": invite["person_id"], "month": month, "answers": values,
        "submitted_at": response.get("lastSubmittedTime") or response.get("createTime"), "department": department,
    })
    response_id, _, _ = db.upsert_response(
        conn, pair_id=pair_id, role=role, person_id=invite["person_id"], month=month, source=SOURCE,
        submitted_at=data["submitted_at"], answers=data["answers"], department=data["department"],
    )
    return response_id, pair_id, month


def _list_responses(api, client, form) -> list[dict]:
    params = {"pageSize": 200}
    if cursor := parse_datetime(form["cursor"]):
        # Небольшое перекрытие защищает от задержки появления ответов в выдаче.
        params["filter"] = f"timestamp >= {iso(cursor - timedelta(minutes=5))}"
    url = f"{FORMS_API}/forms/{form['form_id']}/responses"
    responses = []
    tokens = set()
    while True:
        result = api.request(client, "GET", url, params=params)
        responses.extend(result.get("responses") or [])
        token = result.get("nextPageToken")
        if not token:
            return sorted(responses, key=lambda answer: (answer.get("createTime") or "", answer.get("responseId") or ""))
        if token in tokens:
            raise GoogleFormsError("Google повторил страницу ответов.")
        tokens.add(token)
        params["pageToken"] = token


def _sync_form(ctx: Context, client, form) -> None:
    responses = _list_responses(ctx.google_forms_api, client, form)
    template = json.loads(form["template"])
    latest = parse_datetime(form["cursor"])
    with ctx.write_lock, ctx.connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        for response in responses:
            external_id = response.get("responseId")
            if not isinstance(external_id, str) or not external_id:
                raise GoogleFormsError("Ответ Google Forms не содержит responseId.")
            stamp = parse_datetime(response.get("lastSubmittedTime") or response.get("createTime"))
            if stamp and (latest is None or stamp > latest):
                latest = stamp
            key = (form["form_id"], external_id)
            if conn.execute("SELECT 1 FROM google_form_deliveries WHERE form_id = ? AND external_id = ?", key).fetchone():
                continue
            response_id = pair_id = month = rejection = None
            try:
                response_id, pair_id, month = _save_response(conn, ctx, form, template, response)
            except IngestError as exc:
                rejection = str(exc)
            conn.execute(
                "INSERT INTO google_form_deliveries"
                " (form_id, external_id, response_id, pair_id, month, received_at, rejection)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (*key, response_id, pair_id, month, db.now_iso(), rejection),
            )
        conn.execute("UPDATE google_forms SET cursor = ?, synced_at = ?, sync_error = NULL WHERE role = ?",
                     (iso(latest), db.now_iso(), form["role"]))


def _finish_analysis(ctx: Context) -> None:
    with ctx.connect() as conn:
        pending = conn.execute(
            "SELECT d.response_id, r.pair_id, r.person_id, r.role, r.month"
            " FROM google_form_deliveries d JOIN responses r ON r.id = d.response_id"
            " WHERE d.analyzed_at IS NULL"
        ).fetchall()
    if not pending:
        return
    snapshot = ctx.snapshot()
    with ctx.connect() as conn:
        conn.executemany("UPDATE google_form_deliveries SET analyzed_at = ? WHERE response_id = ?",
                         [(db.now_iso(), row["response_id"]) for row in pending])
    for row in pending:
        ctx.bus.publish("response", {
            **{key: row[key] for key in ("pair_id", "person_id", "role", "month")},
            "source": SOURCE,
            "new_signal_keys": [s.key for s in snapshot.pair_signals(row["pair_id"]) if s.month == row["month"]],
        })


def sync_forms(ctx: Context) -> None:
    api = ctx.google_forms_api
    if not api.configured or not ctx.settings.google_forms_link_secret:
        raise GoogleFormsError("Настройте Google OAuth и секрет личных ссылок на сервере.")
    with ctx.google_sync_lock:
        with ctx.connect() as conn:
            forms = conn.execute("SELECT * FROM google_forms WHERE entry_param IS NOT NULL").fetchall()
        if forms:
            with api.client() as client:
                for form in forms:
                    try:
                        _sync_form(ctx, client, form)
                    except GoogleFormsError as exc:
                        with ctx.connect() as conn:
                            conn.execute("UPDATE google_forms SET sync_error = ? WHERE role = ?", (str(exc), form["role"]))
        _finish_analysis(ctx)


async def poll_google_forms(ctx: Context) -> None:
    interval = ctx.settings.google_forms_poll_seconds
    while True:
        try:
            await asyncio.to_thread(sync_forms, ctx)
        except Exception:
            log.exception("Не удалось обновить ответы Google Форм.")
        await asyncio.sleep(interval)
