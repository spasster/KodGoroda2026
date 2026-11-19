from app.analyzer.quotes import verify_quote

TEXT = "Задачи интересные, но Наставник  постоянно занят и отвечает через день. Ёлки, «долго» ждать."


def test_exact_quote_positions_point_to_original_text():
    span = verify_quote("Наставник  постоянно занят", TEXT)
    assert span is not None
    assert TEXT[span[0]:span[1]] == "Наставник  постоянно занят"


def test_case_and_spaces_do_not_matter():
    span = verify_quote("наставник постоянно ЗАНЯТ и отвечает", TEXT)
    assert span is not None
    assert TEXT[span[0]:span[1]] == "Наставник  постоянно занят и отвечает"


def test_yo_equals_ye():
    span = verify_quote("елки, долго ждать", TEXT)
    assert span is not None
    assert TEXT[span[0]:span[1]].startswith("Ёлки")


def test_quote_marks_are_ignored():
    assert verify_quote("«Ёлки, \"долго\" ждать»", TEXT) is not None
    assert verify_quote("ёлки, долго ждать", TEXT) is not None


def test_trailing_punctuation_from_model_is_ok():
    span = verify_quote("отвечает через день.", TEXT)
    assert span is not None
    assert TEXT[span[0]:span[1]] == "отвечает через день"


def test_paraphrase_is_rejected():
    assert verify_quote("наставник всё время занят", TEXT) is None
    assert verify_quote("наставник отвечает раз в день", TEXT) is None


def test_short_quote_is_rejected():
    assert verify_quote("занят", TEXT, min_length=12) is None
    assert verify_quote("занят", TEXT, min_length=3) is not None


def test_empty_inputs():
    assert verify_quote("", TEXT) is None
    assert verify_quote("что-нибудь длинное", "") is None


def test_dashes_are_unified():
    text = "Сроки горят — не успеваю ничего"
    assert verify_quote("сроки горят - не успеваю", text) is not None
