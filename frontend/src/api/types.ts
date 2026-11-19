// Типы API из docs/contract.md. Меняется контракт, меняется этот файл.

export type Role = 'intern' | 'mentor'
export type SignalType = 'decline' | 'gap_intern_low' | 'gap_mentor_low' | 'text_vs_score' | 'silence'
export type Severity = 'high' | 'medium' | 'low'
export type PairStatus = 'risk' | 'watch' | 'ok'
export type ReviewStatus = 'open' | 'confirmed' | 'rejected'

export interface Quote { role: Role; month: number; question_id: string; text: string; start: number; end: number }
export interface Signal {
  key: string; type: SignalType; pair_id: string; role: Role | 'both'; month: number; severity: Severity
  title: string; explanation: string; action: string
  values: { role: Role; month: number; value: number | null }[]
  quotes: Quote[]
  active: boolean
  review: { status: ReviewStatus; note: string | null; updated_at: string | null }
}
export interface Cell {
  month: number; intern_index: number | null; mentor_index: number | null; gap: number | null
  status: PairStatus; signal_keys: string[]; missing: { intern: boolean; mentor: boolean }
}
export interface PairSummary {
  pair_id: string; intern_id: string; mentor_id: string; status: PairStatus; last_month: number
  intern_index_last: number | null; mentor_index_last: number | null
  trend: 'up' | 'down' | 'flat'; open_signals: number; cells: Cell[]
}
export interface Overview {
  updated_at: string; months: number[]; scale: { min: number; max: number }
  totals: { pairs: number; risk: number; watch: number; ok: number; open_signals: number; confirmed: number; rejected: number; responses: number }
  pairs: PairSummary[]
  recent: { at: string; pair_id: string; role: Role; person_id: string; month: number; source: string }[]
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
export interface Question { id: string; type: 'scale' | 'text'; text: string }
export interface SurveyRole { title: string; person_label: string; questions: Question[] }
// Пороги из survey/signals.json, которые нужны фронту. Бэкенд отдаёт их целиком.
export interface Thresholds {
  active_months: number
  gap: { min_gap: number; high_gap: number }
}
export interface Survey {
  title: string
  months: number
  scale: { min: number; max: number; min_label: string; max_label: string }
  roles: Record<Role, SurveyRole>
  paired_questions: { intern: string; mentor: string; label: string }[]
  thresholds: Thresholds
}

// GET /api/people. next_month: первый месяц без анкеты, null, если заполнены все.
export interface People {
  interns: { id: string; mentor_id: string; pair_id: string; next_month: number | null }[]
  mentors: { id: string; intern_id: string; pair_id: string; next_month: number | null }[]
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
  submitted_at?: string
}
export interface IngestResult { response_id: number; pair_id: string; replaced: boolean; new_signals: Signal[] }

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
