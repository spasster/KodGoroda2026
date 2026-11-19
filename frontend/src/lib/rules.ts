// Правила поверх API, которые нужны нескольким экранам сразу.
// Источник: docs/design/system.md, раздел «Правила, которые фронт считает сам».

import type { Cell, Overview, People, Role, Severity, Signal, SignalType, Thresholds } from '../api/types'

// Пороги приходят из /api/survey (survey/signals.json). Эти числа нужны, только
// пока анкета не загрузилась: те же значения, что в backend/app/signals.py.
export const DEFAULT_THRESHOLDS: Thresholds = {
  active_months: 2,
  gap: { min_gap: 0.25, high_gap: 0.4 },
}

export type Scale = Overview['scale']

export const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

// Порядок типов для главного сигнала пары.
export const TYPE_RANK: Record<SignalType, number> = {
  decline: 0,
  gap_intern_low: 1,
  text_vs_score: 2,
  gap_mentor_low: 3,
  silence: 4,
}

// Сигнал на разборе текста; остальные считает формула.
export function isTextSignal(type: SignalType): boolean {
  return type === 'text_vs_score'
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

// Главный сигнал пары: его title идёт строкой-причиной под ID пары.
export function mainSignal(signals: Signal[]): Signal | undefined {
  return signals.filter(isActive).sort(compareSignals)[0]
}

// Порядок пар в плашках итогов, в очереди и на экране сигналов: больше активных
// high, потом больше активных всего, потом свежее последний сигнал, потом ID.
export function sortPairsByPriority(pairIds: string[], signals: Signal[]): string[] {
  const key = (id: string) => {
    const act = signals.filter((s) => s.pair_id === id && isActive(s))
    return [-act.filter((s) => s.severity === 'high').length, -act.length, -Math.max(0, ...act.map((s) => s.month))]
  }
  const keys = new Map(pairIds.map((id) => [id, key(id)]))
  return [...pairIds].sort((x, y) => {
    const a = keys.get(x)!
    const b = keys.get(y)!
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
    return x < y ? -1 : x > y ? 1 : 0
  })
}

// Повторы одного условия в паре: одинаковые pair_id, type и role. head свежий,
// repeats старше, от нового к старому. Группы идут в порядке compareSignals.
export interface SignalCluster {
  head: Signal
  repeats: Signal[]
}

export function clusterRepeats(signals: Signal[]): SignalCluster[] {
  const groups = new Map<string, Signal[]>()
  for (const s of signals) {
    const k = `${s.pair_id}:${s.type}:${s.role}`
    const list = groups.get(k)
    if (list) list.push(s)
    else groups.set(k, [s])
  }
  return [...groups.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => b.month - a.month)
      return { head: sorted[0], repeats: sorted.slice(1) }
    })
    .sort((a, b) => compareSignals(a.head, b.head))
}

// Месяц сбора: наибольший next_month из /api/people, но не больше survey.months.
// null, если все анкеты программы уже есть.
export function collectMonth(people: People | undefined, months: number): number | null {
  if (!people) return null
  const next = [...people.interns, ...people.mentors].map((p) => p.next_month).filter((m): m is number => m != null)
  if (next.length === 0) return null
  return Math.min(Math.max(...next), months)
}

// Порог высокой важности в баллах: high_gap × размах. На шкале 1–5 это 1,6.
export function highGapPoints(scale: Scale, th: Thresholds): number {
  return th.gap.high_gap * (scale.max - scale.min)
}

// Чья оценка ниже по сигналу разрыва за месяц. Порог бэкенд сверяет с точным
// разрывом, а Cell.gap округлён: 3,8 и 4,75 дают на экране 1,0, хотя точно 0,95
// и сигнала нет. Поэтому фронт порог не пересчитывает, а смотрит на сигналы.
export function gapLowSide(cell: Cell | undefined): Role | null {
  if (!cell) return null
  if (cell.signal_keys.some((k) => k.startsWith('gap_intern_low:'))) return 'intern'
  if (cell.signal_keys.some((k) => k.startsWith('gap_mentor_low:'))) return 'mentor'
  return null
}

// Разрыв за месяц дошёл до сигнала в любую сторону.
export function isGapNotable(cell: Cell): boolean {
  return gapLowSide(cell) != null
}

// Направление для колонки «Сейчас» по клетке последнего месяца пары.
export function gapDirection(cell: Cell | undefined): string | null {
  if (!cell) return null
  if (cell.missing.intern && !cell.missing.mentor) return 'нет анкеты стажёра'
  if (cell.missing.mentor && !cell.missing.intern) return 'нет анкеты наставника'
  const side = gapLowSide(cell)
  return side === 'intern' ? 'стажёру хуже' : side === 'mentor' ? 'наставник недоволен' : null
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

// Предложение вокруг цитаты, для очереди на обзоре. start и end цитаты считаются
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
