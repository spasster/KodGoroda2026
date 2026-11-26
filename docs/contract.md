# Контракт платформы

Единый источник правды для бэкенда, фронтенда и генератора данных. Если код расходится с этим файлом, прав файл. Менять контракт можно, но тогда в том же изменении правятся все стороны.

## Структура репозитория

```
survey/survey.json      анкета: роли, вопросы, шкала, парные вопросы
survey/signals.json     пороги сигналов
survey/import_map.json  соответствие колонок Excel полям (создаёт бэкенд для формата data/sample)
data/generate.py        генератор тестового набора
data/sample/            interns.xlsx, mentors.xlsx, truth.json
backend/                FastAPI, SQLite, импорт, сигналы, приём анкет
frontend/               React + TypeScript + Vite
docs/design/            дизайн-система
docker-compose.yml, Makefile, .env.example
```

На финале МГТС выдаст свою анкету и свои таблицы. Тогда правятся `survey/survey.json`, `survey/import_map.json` и при необходимости `survey/signals.json`. Код под их данные меняться не должен.

## Анкета (`survey/survey.json`)

- `roles.intern` и `roles.mentor`: заголовок, подпись поля ID, список вопросов.
- Вопрос: `id`, `type` (`scale` или `text`), `text`.
- `scale`: общая шкала для всех вопросов типа `scale` (`min`, `max`, подписи краёв).
- `paired_questions`: какие вопросы стажёра и наставника сравниваются напрямую.
- `technical_fields`: подписи служебных полей периода и подразделения. `score_labels` у вопроса задаёт расшифровку баллов. `legacy_questions` сохраняют чтение прежних анкет.
- `months`: длительность программы.

## Формат Excel (`data/sample`, имитация выгрузки из Tabs)

Два файла, лист `Ответы`, одна строка на одну заполненную анкету.

`interns.xlsx`, колонки по порядку:

| Заголовок | Содержимое |
|---|---|
| `Отметка времени` | дата и время заполнения |
| `ID стажёра` | `S-01` … |
| `ID наставника` | `M-01` … |
| `Месяц стажировки` | 1…6 |
| текст каждого вопроса стажёра из `survey.json` дословно | число по шкале или текст |

`mentors.xlsx` такой же, но первыми идут `ID наставника`, `ID стажёра`, `Месяц стажировки`, дальше вопросы наставника.

Пропущенная анкета значит, что строки за этот месяц нет. Пустой комментарий значит пустую ячейку.

Импорт находит колонки так: сначала по `survey/import_map.json`, потом по совпадению заголовка с текстом вопроса (без учёта регистра, пробелов, пунктуации, `ё`/`е`). Нераспознанные колонки попадают в отчёт импорта, импорт не падает. Поддерживаются `.xlsx` и `.csv`.

## Хранение (SQLite)

- `pairs(pair_id, intern_id, mentor_id)`. `pair_id` строится из ID стажёра: `S-03` → `P-03`. Пара один к одному.
- `responses(id, pair_id, role, person_id, month, source, submitted_at, created_at)`. `source`: `excel`, `form`, `google_forms`, `gsheet`. Уникальность по `(pair_id, role, month)`, повторная анкета заменяет прежнюю.
- `answers(response_id, question_id, score, text)`.
- `reviews(signal_key, status, note, updated_at)`.
- `text_cache(text_hash, analyzer, result_json)`.

Сигналы не хранятся: данных мало, они пересчитываются при каждом запросе. Кэшируется только разбор текста.

## Индексы

- Индекс роли за месяц — среднее всех ответов типа `scale` этой роли. Нет анкеты, значит `null`.
- Нормированный индекс: `(index - min) / (max - min)`, от 0 до 1. Пороги в `signals.json` заданы в долях размаха шкалы.
- Разрыв за месяц: `gap = mentor_index - intern_index` в баллах шкалы. Положительный — стажёру хуже, чем видит наставник.
- Пороги сигналов считаются по точным индексам. В ответах API (`Cell.gap`, тексты сигналов) разрыв равен разнице уже округлённых индексов: оценки 4,4 и 4,8 дают разрыв 0,4, даже если точная разница 0,35.

## Разбор текста

Интерфейс в `backend/app/analyzer/`:

```python
def analyze(text: str, role: str, question_id: str) -> TextInsight
# TextInsight: sentiment: float (-1..1), topics: list[str], concerns: list[{label, quote}], summary: str | None
```

- `rules` (по умолчанию): словарь русских ключевых слов и основ. Работает без сети и модели.
- `openai`: OpenAI-совместимый клиент (Ollama с Qwen локально или внешний API), включается `LLM_PROVIDER=openai`. Промпт и схема ответа лежат в `backend/app/analyzer/llm.py`, их дорабатывает ML.
- Каждая цитата проверяется функцией `verify_quote(quote, text)`: точное вхождение после нормализации (регистр, пробелы, `ё`/`е`, кавычки), длина не меньше `quote_min_length`. Не прошла проверку — цитата и основанный на ней вывод отбрасываются. Позиции `start`/`end` считаются по исходному тексту, в ответах API в кодовых единицах UTF-16, как `String.prototype.slice` в JS: эмодзи перед цитатой не сдвигают подчёркивание.

Темы (`topics`): `tasks_shortage` нехватка задач, `overload` перегрузка, `mentor` отношения с наставником, `clarity` непонятные задачи, `motivation` мотивация и интерес, `team` команда, `growth` рост и обучение, `positive` хорошее.

## Сигналы

Тип, условие, важность. Пороги из `survey/signals.json`.

| `type` | Условие | `role` | Важность |
|---|---|---|---|
| `decline` | нормированный индекс роли упал на `two_month_drop` и больше два месяца подряд или на `single_drop` за месяц | `intern` или `mentor` | `high` за резкий спад, иначе `medium` |
| `gap_intern_low` | `gap / размах >= min_gap`: стажёру хуже, чем видит наставник | `both` | `high`, если `>= high_gap` или разрыв растёт второй месяц, иначе `medium` |
| `gap_mentor_low` | `-gap / размах >= min_gap`: наставник недоволен, а стажёр оценивает всё высоко | `both` | `medium`, `high` при `>= high_gap` |
| `text_vs_score` | нормированный индекс роли `>= min_index`, а комментарий той же анкеты с `sentiment <= max_sentiment` или с темой из `tasks_shortage`, `overload`, `mentor` | `intern` или `mentor` | `medium`, `high` для темы `mentor` |
| `silence` | (а) нет анкеты за месяц, хотя у второй стороны пары она есть или месяц уже прошёл для остальных пар; (б) комментарий пуст, хотя в прошлые месяцы был; (в) длина комментария упала на `length_drop` против среднего прошлых при среднем `>= min_prev_length`; (г) все оценки анкеты одинаковые три месяца подряд | `intern` или `mentor` | (а) `medium`, остальное `low` |

Сигнал фиксируется на месяц, в котором условие выполнилось. Одинаковое условие в соседние месяцы даёт отдельные сигналы.

Как читать условия. Бэкенд и эталон `data/expected.py` считают одинаково:
- Спад за два месяца: индекс падал в каждом из двух месяцев, а в сумме упал на `two_month_drop` и больше. Ряд 4,6 → 4,4 → 3,8 даёт сигнал, ряд 4,4 → 4,2 → 4,0 не даёт.
- Пропущенная анкета ряд не рвёт. Спад считается от прошлой анкеты той же роли, рост разрыва от прошлого месяца, где ответили обе стороны.
- «Разрыв растёт второй месяц»: разрыв больше прошлого, а прошлый больше позапрошлого. Прошлые разрывы могут быть ниже `min_gap`.
- Молчание (а): месяц прошёл, если по нему есть хотя бы одна анкета у каждой из остальных пар.
- Молчание (в): средняя длина считается только по непустым прошлым комментариям.
- Молчание (г): в каждой из трёх анкет подряд все оценки одинаковые. От анкеты к анкете оценка может меняться.
- Текст против оценки: хватает одного комментария с проверенной цитатой и тональностью не выше `max_sentiment` или с темой из списка. Пометка спорной разметки `sure: false` в `data/scenarios.py` сигнал не отменяет.
- Активные месяцы отсчитываются от последнего месяца, по которому у пары есть анкета.

Ключ сигнала стабилен: `{type}:{pair_id}:{role}:{month}`. Отметки HR привязаны к ключу.

Активный сигнал: месяц сигнала входит в последние `active_months` месяцев пары и статус не `rejected`.

Статус пары: `risk`, если есть активный `high` или два и больше активных сигнала; `watch`, если есть один активный; иначе `ok`. Статус ячейки месяца считается так же по сигналам этого месяца без учёта `active_months`.

Каждый сигнал содержит понятный HR текст на русском:
- `title`: что произошло, коротко. Пример: «Стажёр оценивает стажировку всё ниже».
- `explanation`: одно-два предложения с цифрами. Пример: «Оценка стажёра за три месяца: 4,6 → 3,8 → 3,0».
- `action`: что сделать HR. Пример: «Поговорить со стажёром один на один: что изменилось с 3-го месяца».

Месяц в текстах пишется цифрой, как в таблице дашборда: «в 5-м месяце», «с 3-го месяца». Число между стажёром и наставником везде называется «разрыв».

## API

Префикс `/api`, JSON, время в ISO 8601 UTC. Числа индексов округляются до одного знака.

Типы (TypeScript, фронт держит их в `src/api/types.ts`):

```ts
type Role = 'intern' | 'mentor'
type SignalType = 'decline' | 'gap_intern_low' | 'gap_mentor_low' | 'text_vs_score' | 'silence'
type Severity = 'high' | 'medium' | 'low'
type PairStatus = 'risk' | 'watch' | 'ok'
type ReviewStatus = 'open' | 'confirmed' | 'rejected'

interface Quote { role: Role; month: number; question_id: string; text: string; start: number; end: number }
interface Signal {
  key: string; type: SignalType; pair_id: string; role: Role | 'both'; month: number; severity: Severity
  title: string; explanation: string; action: string
  values: { role: Role; month: number; value: number | null }[]
  quotes: Quote[]
  active: boolean
  review: { status: ReviewStatus; note: string | null; updated_at: string | null }
}
interface Cell {
  month: number; intern_index: number | null; mentor_index: number | null; gap: number | null
  status: PairStatus; signal_keys: string[]; missing: { intern: boolean; mentor: boolean }
}
interface PairSummary {
  pair_id: string; intern_id: string; mentor_id: string; status: PairStatus; last_month: number
  intern_index_last: number | null; mentor_index_last: number | null
  trend: 'up' | 'down' | 'flat'; open_signals: number; cells: Cell[]
}
interface Overview {
  updated_at: string; months: number[]; scale: { min: number; max: number }
  totals: { pairs: number; risk: number; watch: number; ok: number; open_signals: number; confirmed: number; rejected: number; responses: number }
  pairs: PairSummary[]
  recent: { at: string; pair_id: string; role: Role; person_id: string; month: number; source: string }[]
}
interface CommentItem {
  role: Role; month: number; question_id: string; question_text: string; text: string
  sentiment: number | null; topics: string[]; highlights: { start: number; end: number; signal_key: string }[]
}
interface PairDetail extends PairSummary {
  series: { month: number; intern_index: number | null; mentor_index: number | null
            intern: Record<string, number | null>; mentor: Record<string, number | null> }[]
  comments: CommentItem[]
  signals: Signal[]
}
```

Эндпоинты:

| Метод и путь | Что делает |
|---|---|
| `GET /api/health` | `{ok, pairs, responses, analyzer}` |
| `GET /api/survey` | содержимое `survey.json` и `thresholds`: пороги из `signals.json` вместе со значениями по умолчанию. Фронт берёт из них окно активных сигналов и порог высокой важности разрыва |
| `GET /api/people` | `{interns: [{id, mentor_id, pair_id, next_month}], mentors: [...]}` для выбора в форме; `next_month` — первый месяц без анкеты |
| `GET /api/overview` | `Overview` |
| `GET /api/pairs/{pair_id}` | `PairDetail`, 404 если нет |
| `GET /api/signals?status=open\|confirmed\|rejected\|all&active=true` | `Signal[]`, сначала `high`, потом свежие |
| `POST /api/signals/{key}/review` | тело `{status, note?}`, ответ — обновлённый `Signal` |
| `POST /api/ingest` | приём анкеты, см. ниже |
| `GET /api/hr/google-forms` | две формы и статус последней доставки по каждой роли |
| `POST /api/hr/google-forms` | создать или продолжить публикацию двух форм. Тело `{"cohort": "Название потока"}` |
| `POST /api/hr/google-forms/prefill` | сохранить ссылку-заготовку. Тело `{"role": "intern", "url": "https://docs.google.com/forms/..."}` |
| `POST /api/hr/google-forms/sync` | вручную синхронизировать ответы и получить состояние подключения |
| `POST /api/hr/google-forms/link` | выдать подписанную ссылку на первый незаполненный период. Тело `{"pair_id": "P-01", "role": "intern"}` |
| `POST /api/sync/gsheet` | забрать новые строки из опубликованных CSV Google Таблиц (`GSHEET_CSV_URL_INTERN`, `GSHEET_CSV_URL_MENTOR`) |
| `POST /api/import/excel` | multipart: `interns`, `mentors` (любой из двух), `replace=true\|false`; ответ — отчёт импорта. Файл до 5 МБ, лист до 5000 строк и 200 колонок. `replace=true` с файлом без единой распознанной анкеты отвечает 422 и базу не трогает |
| `POST /api/admin/reset` | очистить базу и загрузить `data/sample` |
| `GET /api/events` | Server-Sent Events, см. ниже |

Приём анкеты `POST /api/ingest`:

```json
{ "role": "mentor", "person_id": "M-03", "month": 6,
  "answers": { "overall": 3, "speed": 2, "independence": 3, "engagement": 3, "comment": "..." },
  "source": "form" }
```

- Пара находится по `person_id`. Для нового стажёра можно передать `intern_id` и `mentor_id`, тогда пара создаётся.
- Оценки проверяются по шкале, лишние ключи игнорируются, неизвестный вопрос в ответе не ошибка.
- Ответ: `{ response_id, pair_id, replaced: bool, new_signals: Signal[] }`, где `new_signals` — сигналы, которых не было до этой анкеты.
- Ошибки: 422 с `{detail}` на русском.

Для маршрутов `/api/hr/google-forms` используйте `Authorization: Bearer <GOOGLE_FORMS_HR_KEY>`.

Ответы Google Forms API привязываются по коду приглашения к роли, паре и первому незаполненному месяцу. Уникальность входящего события определяется парой formId и responseId. После анализа сервер публикует событие в `/api/events`.

События `GET /api/events` (SSE), каждые 15 секунд комментарий `: ping`:
- `event: response`, `data: {pair_id, role, person_id, month, source, new_signal_keys}`
- `event: review`, `data: {key, status}`
- `event: reset`, `data: {}`

## Порты и запуск

- Бэкенд `:8000`, фронт в разработке `:5173` с прокси `/api` на бэкенд.
- Docker: `web` на `:8080` (nginx отдаёт сборку фронта и проксирует `/api` в `api:8000`, включая SSE без буферизации), `api` внутри сети.
- `make dev`, `make test`, `make data`, `make reset`, `make up`, `make tunnel` (cloudflared на `:8081`). На `:8081` Nginx пропускает только маршруты демоформы. Дашборд и административные маршруты доступны через основной порт.

Переменные окружения (`.env.example`): `DB_PATH`, `SURVEY_DIR`, `SAMPLE_DIR`, `LLM_PROVIDER` (`rules`|`openai`), `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `GSHEET_CSV_URL_INTERN`, `GSHEET_CSV_URL_MENTOR`, `GSHEET_POLL_SECONDS` (0 — не опрашивать).

## Экраны фронта

Интерфейс один, для HR, на русском. Светлая и тёмная тема, переключатель запоминается.

- `/` Обзор: итоги, таблица «пара × месяц», активные сигналы, последние поступления.
- `/pairs/:id` Карточка пары: две линии индексов, ответы по вопросам, комментарии с подсвеченными цитатами, сигналы с действием и отметкой.
- `/signals` Сигналы: очередь «с кем поговорить», фильтры по статусу и важности, отметка «подтвердилось» или «ложная тревога».
- `/form` Форма для стажёра и наставника: собирается из `/api/survey`, удобна с телефона, без навигации дашборда.

Новый ответ, пришедший через SSE, виден без перезагрузки: обновляются данные и показывается уведомление.

## Дополнения: аналитика, подготовка к разговору, кабинеты

| Метод и путь | Что делает |
|---|---|
| `GET /api/analytics` | общая аналитика программы: средние по месяцам, вопросы по месяцам, темы комментариев, месяц первого сигнала по парам |
| `GET /api/pairs/{pair_id}/brief` | сводка по паре, вопросы для разговора (`to`: кому задавать), заметки HR. Собирается правилами из сигналов и тем |
| `POST /api/pairs/{pair_id}/notes` | тело `{text}`: добавить заметку HR, ответ как у `brief` |
| `GET /api/cabinet/{intern\|mentor}/{person_id}` | личный кабинет: только свои ответы по месяцам, ответы второй стороны пары не отдаются |

Имена людей берутся из `survey/people.json` (ID → имя). Нет записи — интерфейс показывает ID.
Кабинеты открываются переключателем роли в шапке, входа по паролю нет: это демонстрация.
