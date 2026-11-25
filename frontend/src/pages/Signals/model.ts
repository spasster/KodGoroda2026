// Логика экрана сигналов без React: сегменты и порядок строк.
// Вид и тексты: docs/design/v2.md, раздел «Сигналы».

import type { Signal } from '../../api/types'
import { compareSignals } from '../../lib/rules'

export type Segment = 'open' | 'done' | 'all'

// Открытые: активные и не отмеченные, то же число, что open_signals в обзоре.
// Разобранные: HR отметил. Все: вся история.
export function inSegment(s: Signal, seg: Segment): boolean {
  if (seg === 'open') return s.active && s.review.status === 'open'
  if (seg === 'done') return s.review.status !== 'open'
  return true
}

// Сначала высокая важность, потом свежие.
export function segmentRows(all: readonly Signal[], seg: Segment): Signal[] {
  return all
    .filter((s) => inSegment(s, seg))
    .sort((a, b) => compareSignals(a, b) || (a.pair_id < b.pair_id ? -1 : a.pair_id > b.pair_id ? 1 : 0))
}

// ---------- Фильтры ----------

export type Kind = 'gap' | 'decline' | 'low_question' | 'text' | 'silence'

export const KIND_LABEL: Record<Kind, string> = {
  gap: 'Расхождение',
  decline: 'Спад оценок',
  low_question: 'Низкая оценка по вопросу',
  text: 'Жалоба при высоких оценках',
  silence: 'Нет ответа',
}

export function kindOf(s: Signal): Kind {
  if (s.type === 'gap_intern_low' || s.type === 'gap_mentor_low') return 'gap'
  if (s.type === 'text_vs_score') return 'text'
  return s.type
}

export interface Filters {
  person: string | null
  kind: Kind | null
  severity: Signal['severity'] | null
  month: number | null
}

export const NO_FILTERS: Filters = { person: null, kind: null, severity: null, month: null }

export function matches(s: Signal, f: Filters, skip?: keyof Filters): boolean {
  return (
    (skip === 'person' || !f.person || s.pair_id === f.person) &&
    (skip === 'kind' || !f.kind || kindOf(s) === f.kind) &&
    (skip === 'severity' || !f.severity || s.severity === f.severity) &&
    (skip === 'month' || f.month == null || s.months.includes(f.month))
  )
}

/** Сколько сигналов останется, если выбрать значение в этой группе (остальные фильтры учтены). */
export function facet<K extends keyof Filters>(rows: readonly Signal[], f: Filters, group: K, value: (s: Signal) => NonNullable<Filters[K]> | readonly NonNullable<Filters[K]>[]) {
  const counts = new Map<NonNullable<Filters[K]>, number>()
  for (const s of rows) {
    if (!matches(s, f, group)) continue
    const v = value(s)
    for (const x of Array.isArray(v) ? v : [v]) counts.set(x, (counts.get(x) ?? 0) + 1)
  }
  return counts
}
