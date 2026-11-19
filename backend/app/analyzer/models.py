from pydantic import BaseModel, Field

TOPICS: dict[str, str] = {
    "tasks_shortage": "нехватка задач",
    "overload": "перегрузка",
    "mentor": "отношения с наставником",
    "clarity": "непонятные задачи",
    "motivation": "мотивация и интерес",
    "team": "команда",
    "growth": "рост и обучение",
    "positive": "хорошее",
}


class Concern(BaseModel):
    label: str
    quote: str
    # Позиции цитаты в исходном тексте, их ставит verify_quote.
    start: int = 0
    end: int = 0


class TextInsight(BaseModel):
    sentiment: float = Field(0.0, ge=-1, le=1)
    topics: list[str] = []
    concerns: list[Concern] = []
    summary: str | None = None
