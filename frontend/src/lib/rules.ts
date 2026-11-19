// Правила поверх API, которые нужны нескольким экранам сразу.

import type { Overview, People, Severity, Signal, SignalType, Thresholds } from '../api/types'

// Пороги приходят из /api/survey (survey/signals.json). Эти числа нужны, только
// пока анкета не загрузилась: те же значения, что в backend/app/signals.py.
export const DEFAULT_THRESHOLDS: Thresholds = {
  active_months: 2,
  gap: { min_gap: 0.25, high_gap: 0.4 },
}

export type Scale = Overview['scale']

export const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

// Порядок типов при равной важности и месяце.
const TYPE_RANK: Record<SignalType, number> = {
  decline: 0,
  gap_intern_low: 1,
  text_vs_score: 2,
  gap_mentor_low: 3,
  silence: 4,
}

// Активный: в последних active_months месяцах пары и не «ложная тревога» (считает бэкенд).
export function isActive(s: Signal): boolean {
  return s.active
}

// Открытый: активный и HR его ещё не отметил.
export function isOpen(s: Signal): boolean {
  return s.active && s.review.status === 'open'
}

// Важность, потом свежий месяц, потом тип.
export function compareSignals(a: Signal, b: Signal): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    b.month - a.month ||
    TYPE_RANK[a.type] - TYPE_RANK[b.type]
  )
}

// Месяц сбора: наибольший next_month из /api/people, но не больше survey.months.
// null, если все анкеты программы уже есть.
export function collectMonth(people: People | undefined, months: number): number | null {
  if (!people) return null
  const next = [...people.interns, ...people.mentors].map((p) => p.next_month).filter((m): m is number => m != null)
  if (next.length === 0) return null
  return Math.min(Math.max(...next), months)
}

const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long' })

// Календарный месяц программы по датам анкет: «ноябрь» для 6-го месяца на
// тестовых данных. Опора: анкета за самый поздний месяц программы, из них самая
// ранняя. Поздняя анкета за прошлый месяц подпись не сдвигает. null, если анкет нет.
export function calendarMonthName(month: number, recent: Overview['recent']): string | null {
  const latest = recent.reduce<Overview['recent'][number] | null>(
    (acc, r) => (!acc || r.month > acc.month || (r.month === acc.month && r.at < acc.at) ? r : acc),
    null,
  )
  if (!latest) return null
  const at = new Date(latest.at)
  if (Number.isNaN(at.getTime())) return null
  return monthName.format(new Date(at.getFullYear(), at.getMonth() + month - latest.month, 1))
}

// Предложение вокруг цитаты сигнала. start и end цитаты считаются
// от начала предложения.
export function sentenceAround(text: string, start: number, end: number): { text: string; start: number; end: number } {
  let from = 0
  for (const stop of ['. ', '! ', '? ']) {
    const i = text.lastIndexOf(stop, start - 1)
    if (i >= 0 && i + 2 > from && i + 2 <= start) from = i + 2
  }
  const tail = /[.!?](\s|$)/g
  tail.lastIndex = end
  const m = tail.exec(text)
  const to = m ? m.index + 1 : text.length
  return { text: text.slice(from, to), start: start - from, end: end - from }
}
