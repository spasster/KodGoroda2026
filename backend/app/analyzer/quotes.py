"""Проверка цитат: вывод модели принимается, только если цитата дословно есть в тексте."""

QUOTE_CHARS = set("\"'«»„“”‘’‚‹›`")
DASH_CHARS = set("‐‑‒–—―−")
EDGE_PUNCT = " \t\n\r.,;:!?…"


def _normalize(text: str) -> tuple[str, list[int]]:
    """Нормализованная строка и индекс исходного символа для каждого её символа.

    Регистр не важен, ё = е, кавычки выбрасываются, тире приводятся к дефису,
    любая серия пробелов становится одним пробелом.
    """
    out: list[str] = []
    pos: list[int] = []
    prev_space = True
    for i, ch in enumerate(text):
        if ch in QUOTE_CHARS:
            continue
        if ch.isspace():
            if not prev_space:
                out.append(" ")
                pos.append(i)
            prev_space = True
            continue
        if ch in DASH_CHARS:
            ch = "-"
        low = ch.lower()
        if len(low) != 1:
            low = ch
        if low == "ё":
            low = "е"
        out.append(low)
        pos.append(i)
        prev_space = False
    if out and out[-1] == " ":
        out.pop()
        pos.pop()
    return "".join(out), pos


def verify_quote(quote: str, text: str, min_length: int = 12) -> tuple[int, int] | None:
    """Позиции (start, end) цитаты в исходном тексте или None, если цитаты там нет."""
    if not quote or not text:
        return None
    nq, _ = _normalize(quote.strip(EDGE_PUNCT + "".join(QUOTE_CHARS)))
    nq = nq.strip(EDGE_PUNCT)
    if len(nq) < min_length:
        return None
    nt, pos = _normalize(text)
    at = nt.find(nq)
    if at < 0:
        return None
    return pos[at], pos[at + len(nq) - 1] + 1
