// Типы API из docs/contract.md. Меняется контракт, меняется этот файл.

export type Role = 'intern' | 'mentor'
export type SignalType = 'decline' | 'gap_intern_low' | 'gap_mentor_low' | 'low_question' | 'text_vs_score' | 'silence'
export type Severity = 'high' | 'medium' | 'low'
export type PairStatus = 'risk' | 'watch' | 'ok'
export type ReviewStatus = 'open' | 'confirmed' | 'rejected'

export interface Quote { role: Role; month: number; question_id: string; text: string; start: number; end: number }
export interface Signal {
  // Ситуация: все месячные срабатывания одного типа у одной пары и роли. Ключ без месяца.
  key: string; type: SignalType; pair_id: string; role: Role | 'both'
  month: number; months: number[]; since_month: number; severity: Severity
  title: string; explanation: string; action: string
  values: { role: Role; month: number; value: number | null }[]
  quotes: Quote[]
  active: boolean
  review: {
    status: ReviewStatus; note: string | null; updated_at: string | null
    month: number | null; previous: { status: ReviewStatus; month: number } | null
  }
  outcome: { review_month: number; last_month: number; repeated: boolean; text: string } | null
  // Только у text_vs_score: кто нашёл жалобу и нашёл бы её словарь.
  text_check?: { by: 'model' | 'rules'; rules_found: boolean } | null
}
export interface Cell {
  month: number; intern_index: number | null; mentor_index: number | null; gap: number | null
  status: PairStatus; signal_keys: string[]; missing: { intern: boolean; mentor: boolean }
  /** Средняя стажёра или наставника за месяц ниже порога baseline.index_below: одно из оснований цвета клетки. */
  low_index?: boolean
}
export interface PairSummary {
  pair_id: string; intern_id: string; mentor_id: string; intern_name?: string | null; mentor_name?: string | null
  status: PairStatus; last_month: number
  intern_index_last: number | null; mentor_index_last: number | null
  trend: 'up' | 'down' | 'flat'; open_signals: number; cells: Cell[]
}
export interface Overview {
  updated_at: string; months: number[]; scale: { min: number; max: number }
  totals: { pairs: number; risk: number; watch: number; ok: number; open_signals: number; confirmed: number; rejected: number; responses: number }
  pairs: PairSummary[]
  recent: { at: string; pair_id: string; role: Role; person_id: string; person_name?: string | null; month: number; source: string }[]
}
export interface CommentItem {
  role: Role; month: number; question_id: string; question_text: string; text: string
  sentiment: number | null; topics: string[]; highlights: { start: number; end: number; signal_key: string }[]
}
export interface PairDetail extends PairSummary {
  series: { month: number; intern_index: number | null; mentor_index: number | null
            intern: Record<string, number | null>; mentor: Record<string, number | null> }[]
  comments: CommentItem[]
  signals: Signal[]
}

export type RecentItem = Overview['recent'][number]
export type SeriesPoint = PairDetail['series'][number]

// Ниже то, что контракт описывает словами, а не типами.

// GET /api/health
export interface Health { ok: boolean; pairs: number; responses: number; analyzer: string }

// GET /api/survey: содержимое survey/survey.json.
// label — короткое название показателя из структуры анкеты МГТС («Понятность задач»), text — формулировка вопроса,
// score_labels — расшифровка шкалы из ТЗ.
export interface Question { id: string; type: 'scale' | 'text' | 'choice'; text: string; label?: string; options?: string[]; score_labels?: Record<string, string> }
export interface SurveyRole { title: string; person_label: string; questions: Question[] }
// Пороги из survey/signals.json, которые нужны фронту. Бэкенд отдаёт их целиком.
export interface Thresholds {
  active_months: number
  gap: { min_gap: number; high_gap: number }
  low_question: { max_score: number }
}
export interface Survey {
  title: string
  months: number
  scale: { min: number; max: number; min_label: string; max_label: string }
  roles: Record<Role, SurveyRole>
  technical_fields?: { department?: string; month?: string }
  paired_questions: { intern: string; mentor: string; label: string }[]
  thresholds: Thresholds
}

// GET /api/people. next_month: первый месяц без анкеты, null, если заполнены все.
export interface People {
  interns: { id: string; name?: string | null; mentor_id: string; pair_id: string; next_month: number | null; token?: string }[]
  mentors: { id: string; name?: string | null; intern_id: string; pair_id: string; next_month: number | null; token?: string }[]
}

// GET /api/signals
export interface SignalsQuery { status?: ReviewStatus | 'all'; active?: boolean }

// POST /api/signals/{key}/review
export interface ReviewInput { status: ReviewStatus; note?: string | null }

// POST /api/ingest
export interface IngestRequest {
  role: Role
  person_id: string
  month: number
  answers: Record<string, number | string | null>
  source?: string
  intern_id?: string
  mentor_id?: string
  department?: string
  submitted_at?: string
  // Подпись личной ссылки (people[].token). Нет токена: открытая форма.
  token?: string
}
export interface IngestResult { response_id: number; pair_id: string; replaced: boolean; new_signals: Signal[] }

export interface GoogleForm {
  role: Role
  title: string
  cohort: string
  form_id: string | null
  published: boolean
  ready: boolean
  edit_url: string | null
  synced_at: string | null
  sync_error: string | null
  last_delivery: {
    external_id: string
    pair_id: string | null
    month: number | null
    received_at: string
    analyzed_at: string | null
    rejection: string | null
  } | null
}
export interface GoogleFormsStatus { forms: GoogleForm[]; prefill_sample: string }

// Отчёт импорта: POST /api/import/excel, /api/sync/gsheet, /api/admin/reset.
export interface ImportFileReport {
  file: string; role: Role; sheet: string | null
  rows: number; imported: number; replaced: number; unchanged: number
  columns: { header: string; field: string | null; by: string }[]
  unrecognized: string[]; missing_questions: string[]
  errors: { row: number; message: string }[]; warnings: string[]
}
export interface ImportReport {
  files: ImportFileReport[]; imported: number; pairs: number; responses: number
  new_signal_keys: string[]; warning?: string
}

// GET /api/events
export interface ResponseEvent { pair_id: string; role: Role; person_id: string; month: number; source: string; new_signal_keys: string[] }
export interface ReviewEvent { key: string; status: ReviewStatus }

// ---------- Аналитика, подготовка к разговору, методика ----------

export interface Analytics {
  months: number[]
  scale: { min: number; max: number }
  pairs: number
  program: { month: number; intern: number | null; mentor: number | null; responses: number; expected: number }[]
  questions: { role: Role; question_id: string; text: string; values: (number | null)[]; delta: number | null }[]
  topics: { topic: string; label: string; intern: number; mentor: number }[]
  early: {
    pair_id: string; intern_id: string; intern_name: string | null; first_signal_month: number; risk_month: number | null
    baseline_month: number | null; lead_months: number | null
  }[]
  effect: {
    pairs_with_signals: number; earlier: number; same_or_later: number; invisible: number; avg_lead: number | null; baseline_score: number
    /** Средняя ниже порога в том же месяце, что и сигнал, и раньше него. */
    same_month?: number; later?: number
    /** Готовый вывод по данным: что средняя оценка не показывает. */
    conclusion?: string
  }
}

export interface Brief {
  summary: string
  /** Что делать дальше: 1–3 строки, для выправившейся пары — действия на закрепление. */
  next_steps?: string[]
  questions: { to: Role; text: string }[]
  notes: { id: number; text: string; at: string }[]
}

// GET /api/method
export interface MethodCounts { found: number; missed: number; false_alarms: number }
export interface QualitySet { id: string; name: string; comments: number; problems: number; model: MethodCounts; rules: MethodCounts }
export interface Quality { updated: string; model: string; seconds_per_comment: number; sets: QualitySet[]; errors: string[] }
export interface MethodSignal {
  type: SignalType; name: string; how: string; why: string[]; action: string; limit: string; source: string | null
  open: number; confirmed: number; rejected: number
}
export interface Method { principles: string[]; signals: MethodSignal[]; baseline: string; quality: Quality | null }
