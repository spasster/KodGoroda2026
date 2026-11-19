import pytest

from app.analyzer.quotes import verify_quote
from app.analyzer.rules import analyze


def labels(text: str, role: str = "intern") -> set[str]:
    return {c.label for c in analyze(text, role, "comment").concerns}


@pytest.mark.parametrize("text, label", [
    ("Наставник постоянно занят и отвечает через день.", "mentor"),
    ("Не хватает обратной связи по коду.", "mentor"),
    ("Обратной связи почти нет, ревью жду неделями.", "mentor"),
    ("Неудобно отвлекать наставника вопросами.", "mentor"),
    ("Созвоны с наставником постоянно переносятся.", "mentor"),
    ("Задач почти нет, сижу без дела полдня.", "tasks_shortage"),
    ("Мне не дают нормальных задач.", "tasks_shortage"),
    ("Неделю ждал доступы к репозиторию.", "tasks_shortage"),
    ("Хотелось бы больше реальных задач.", "tasks_shortage"),
    ("Очень много задач, не успеваю.", "overload"),
    ("Работаю по выходным, устал.", "overload"),
    ("Сложно совмещать стажировку с учёбой.", "overload"),
    ("Нагрузка слишком высокая.", "overload"),
    ("Непонятно, что от меня ждут, ТЗ постоянно меняются.", "clarity"),
    ("Не знаю, с чего начать задачу.", "clarity"),
    ("Задачи скучные, одни мелкие правки.", "motivation"),
    ("Думаю уйти после стажировки.", "motivation"),
    ("Мне не очень интересно.", "motivation"),
    ("Не могу влиться в команду.", "team"),
    ("Чувствую себя лишним на встречах.", "team"),
    ("Ничему новому не учусь, стою на месте.", "growth"),
])
def test_intern_problems(text, label):
    insight = analyze(text, "intern", "comment")
    assert label in {c.label for c in insight.concerns}
    assert insight.sentiment < 0


@pytest.mark.parametrize("text, label", [
    ("Стажёр часто опаздывает со сроками и не выходит на связь.", "mentor"),
    ("Работает формально, не проявляет инициативы.", "motivation"),
    ("Стажёр стал хуже вникать в задачи.", "growth"),
    ("Много ошибок, приходится всё переделывать.", "growth"),
    ("Не общается с командой.", "team"),
])
def test_mentor_problems(text, label):
    assert label in labels(text, "mentor")


@pytest.mark.parametrize("text", [
    "Делал задачи по API, писал тесты, разбирался с CI.",
    "Всё по плану.",
    "Пока сложно сказать.",
    "Работаю над задачей по интеграции с CRM, на следующей неделе демо.",
    "Изучал документацию по Kafka и писал прототип.",
])
def test_neutral_text_has_no_concerns(text):
    insight = analyze(text, "intern", "comment")
    assert insight.concerns == []
    assert insight.sentiment == 0


# Отчёт о сделанной работе в ручной разметке data/scenarios.py стоит на +0,3…+0,5.
@pytest.mark.parametrize("text", [
    "Сделал рефакторинг модуля, переработал код авторизации.",
    "Разрешал merge-конфликты, настроил окружение.",
    "Закончил задачи вовремя, жду ревью.",
    "Провёл две встречи с заказчиком, оформил требования.",
])
def test_done_work_is_mildly_positive(text):
    insight = analyze(text, "intern", "comment")
    assert insight.concerns == []
    assert 0 < insight.sentiment <= 0.6


@pytest.mark.parametrize("text", [
    "Задачи интересные, наставник всегда помогает. Всё нравится.",
    "Проблем с наставником нет, всё отлично.",
    "Ничего не мешает. Помогает команда.",
    "Нагрузка комфортная, не перегружаюсь.",
    "Стажёр хорошо справляется, быстро учится, проявляет инициативу.",
    "Многому научился за месяц, команда дружная.",
])
def test_positive_text(text):
    insight = analyze(text, "intern", "comment")
    assert insight.concerns == []
    assert insight.sentiment > 0
    assert "positive" in insight.topics


def test_negation_flips_positive_words():
    assert "motivation" in labels("Задачи мне не нравятся.")
    assert "mentor" in labels("Наставник мало помогает.")
    assert labels("Не скучно, всё нравится.") == set()


def test_quotes_are_verbatim_parts_of_text():
    text = "Задачи интересные, но иногда задач не хватает и я сижу без дела. Наставник крутой."
    insight = analyze(text, "intern", "comment")
    assert insight.concerns
    for c in insight.concerns:
        assert text[c.start:c.end] == c.quote
        assert verify_quote(c.quote, text) == (c.start, c.end)
    assert insight.concerns[0].quote == "иногда задач не хватает и я сижу без дела"


def test_mixed_comment_keeps_problem_quote():
    insight = analyze("Наставник крутой, но хотелось бы больше обратной связи.", "intern", "comment")
    assert [c.label for c in insight.concerns] == ["mentor"]
    assert insight.concerns[0].quote == "хотелось бы больше обратной связи"


def test_short_sentence_is_quoted_with_neighbour():
    text = "Очень много задач, не успеваю. Устал."
    insight = analyze(text, "intern", "comment")
    for c in insight.concerns:
        assert len(c.quote) >= 12


# Фразы, которых нет в data/: словарь должен ловить похожие жалобы, а не только тексты набора.
@pytest.mark.parametrize("role, text, label", [
    ("intern", "Наставник прочитал сообщение и не ответил.", "mentor"),
    ("intern", "Пишу в чат, отвечает через два дня.", "mentor"),
    ("intern", "Вопросы по проекту висят без ответа.", "mentor"),
    ("intern", "Хочу сменить наставника.", "mentor"),
    ("intern", "Ревью моих пулл-реквестов никто не делает.", "mentor"),
    ("intern", "Спросил про доступ во вторник, ответа так и нет.", "mentor"),
    ("intern", "Своих задач по-прежнему нет.", "tasks_shortage"),
    ("intern", "Реальной работы пока совсем мало.", "tasks_shortage"),
    ("intern", "Хочется уже сделать что-нибудь руками.", "tasks_shortage"),
    ("intern", "Попросил новую задачу, ответили ждать до следующего спринта.", "tasks_shortage"),
    ("intern", "Бывает, за целый день ничего не сделал.", "tasks_shortage"),
    ("mentor", "Опять пришлось переделывать за ним отчёт.", "growth"),
    ("mentor", "Сдал витрину позже срока.", "growth"),
    ("mentor", "Пока не готов брать его в штат.", "growth"),
    ("mentor", "В штат пока не рекомендую.", "growth"),
    ("mentor", "Ждёт, пока скажу, что делать дальше.", "motivation"),
    ("mentor", "Два отчёта вернул на доработку.", "growth"),
])
def test_new_phrases_are_problems(role, text, label):
    insight = analyze(text, role, "comment")
    assert label in {c.label for c in insight.concerns}
    assert insight.sentiment < 0


@pytest.mark.parametrize("role, text", [
    ("intern", "Ревью прошло со второго раза, поправил замечания."),
    ("intern", "Жду ревью по задаче, пока беру следующую."),
    ("intern", "Задачи есть, работы хватает."),
    ("intern", "Разбираюсь сам, если что спрашиваю наставника."),
    ("intern", "Наставник ответил быстро, разобрались вместе."),
    ("intern", "Вернули задачу на доработку, поправил за день."),
    ("intern", "Сказали подождать с релизом до понедельника."),
    ("intern", "Сам выбрал задачу из бэклога."),
    ("intern", "Учусь работать с Airflow, пока медленно, но получается."),
    ("intern", "Неделя ушла на доступы, теперь всё работает."),
    ("mentor", "Сам разобрался с CI, без моей помощи."),
    ("mentor", "Сдал всё в срок, без переделок."),
    ("mentor", "Готов брать в штат."),
    ("mentor", "Отвечает быстро, вопросы по делу."),
    ("mentor", "Работает, задачи закрывает."),
])
def test_no_false_alarms_on_ordinary_text(role, text):
    insight = analyze(text, role, "comment")
    assert insight.concerns == []
    assert insight.sentiment >= 0


def test_role_specific_rules():
    # «Переделываю за ним» пишет наставник. У стажёра та же фраза не про работу стажёра.
    assert labels("Переделываю за ним третий раз.", "mentor") == {"growth"}
    assert labels("Переделываю за ним третий раз.", "intern") == set()
    # «Сам» у наставника значит самостоятельность стажёра.
    assert analyze("Сам собрал стенд.", "mentor", "comment").sentiment > analyze("Сам собрал стенд.", "intern", "comment").sentiment
