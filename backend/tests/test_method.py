"""GET /api/method: тексты методики, пороги подставляются из signals.json и шкалы анкеты."""

import json
import os
import time


def method(client) -> dict:
    r = client.get("/api/method")
    assert r.status_code == 200, r.text
    return r.json()


def by_type(m: dict) -> dict:
    return {s["type"]: s for s in m["signals"]}


def test_method_texts_on_default_scale(client):
    m = method(client)
    assert set(m) == {"principles", "signals", "baseline", "quality"}
    assert m["principles"][0] == "Оценки считают формулы. Модель читает только комментарии."
    assert len(m["principles"]) == 3
    assert [s["type"] for s in m["signals"]] == ["decline", "gap_intern_low", "gap_mentor_low", "low_question",
                                                 "text_vs_score", "silence"]
    s = by_type(m)
    assert s["decline"]["name"] == "Спад"
    assert s["decline"]["how"] == ("Средняя оценка анкеты упала на 1,0 балла за месяц или падает два месяца подряд "
                                   "и потеряла за них 0,5 балла и больше.")
    assert s["gap_intern_low"]["how"] == ("Средняя оценка наставника выше средней оценки стажёра на 1,0 балла и больше. "
                                          "Важность высокая от 1,6 балла или если разрыв растёт второй месяц.")
    assert s["gap_mentor_low"]["how"] == ("Средняя оценка стажёра выше средней оценки наставника на 1,0 балла и больше. "
                                          "Важность высокая от 1,6 балла.")
    assert s["low_question"]["how"] == "По любому вопросу анкеты поставлено 2 или ниже."
    assert s["text_vs_score"]["how"].startswith("Средняя оценка анкеты 3,6 и выше, а в комментарии той же анкеты жалоба")
    assert "стал короче прошлых на 60% и больше" in s["silence"]["how"]
    assert m["baseline"] == ("Сравниваем с тем, как это видно без дашборда: HR смотрит среднюю оценку за один месяц "
                             "и реагирует, когда она ниже 3,5.")
    for item in m["signals"]:
        assert len(item["why"]) == 3 and item["action"] and item["limit"]
    assert s["low_question"]["source"] is None and s["text_vs_score"]["source"] is None
    assert s["decline"]["source"].startswith("Chen et al., 2011")
    assert s["gap_mentor_low"]["source"] == s["gap_intern_low"]["source"]


def test_method_thresholds_follow_signals_json_and_scale(client, survey_dir):
    survey = json.loads((survey_dir / "survey.json").read_text(encoding="utf-8"))
    survey["scale"]["max"] = 10
    (survey_dir / "survey.json").write_text(json.dumps(survey), encoding="utf-8")
    th = json.loads((survey_dir / "signals.json").read_text(encoding="utf-8"))
    th["low_question"] = {"max_score": 0.3}
    (survey_dir / "signals.json").write_text(json.dumps(th), encoding="utf-8")
    later = time.time() + 5
    for name in ("survey.json", "signals.json"):
        os.utime(survey_dir / name, (later, later))
    s = by_type(method(client))
    # Размах 9: 0,25 · 9 = 2,25 → 2,3; 0,12 · 9 = 1,08 → 1,1; 0,4 · 9 = 3,6; шкала начинается с 1.
    assert "упала на 2,3 балла" in s["decline"]["how"] and "потеряла за них 1,1 балла" in s["decline"]["how"]
    assert "от 3,6 балла" in s["gap_intern_low"]["how"]
    assert s["low_question"]["how"] == "По любому вопросу анкеты поставлено 3,7 или ниже."  # 1 + 0,3 · 9
    assert "оценка анкеты 6,9 и выше" in s["text_vs_score"]["how"]  # 1 + 0,65 · 9 = 6,85
    assert "ниже 6,6." in method(client)["baseline"]  # 1 + 0,625 · 9 = 6,625


def test_method_counts_situations_by_review_status(client, post):
    post.pair("01", 1, 3.4, 4.4)
    post.pair("02", 1, 2.8, 4.4)
    post.pair("02", 2, 2.8, 4.4)
    post.pair("03", 1, 3.4, 4.4)
    client.post("/api/signals/gap_intern_low:P-02:both/review", json={"status": "confirmed"})
    client.post("/api/signals/gap_intern_low:P-03:both/review", json={"status": "rejected"})
    gap = by_type(method(client))["gap_intern_low"]
    assert (gap["open"], gap["confirmed"], gap["rejected"]) == (1, 1, 1)  # три ситуации, не пять месячных
    assert (by_type(method(client))["decline"]["open"]) == 0


def test_method_quality_is_file_as_is(client, survey_dir):
    assert method(client)["quality"] is None
    quality = {"updated": "2026-11-25", "model": "qwen2.5:7b-instruct", "seconds_per_comment": 1.8,
               "sets": [{"id": "sample12", "name": "Тест", "comments": 10, "problems": 3,
                         "model": {"found": 3, "missed": 0, "false_alarms": 1},
                         "rules": {"found": 2, "missed": 1, "false_alarms": 0}}],
               "errors": ["«…» — модель не увидела иронию"]}
    (survey_dir / "quality.json").write_text(json.dumps(quality, ensure_ascii=False), encoding="utf-8")
    assert method(client)["quality"] == quality
