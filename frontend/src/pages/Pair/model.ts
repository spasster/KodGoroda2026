// Расчёты карточки пары поверх API. Экран описан в docs/design/v2.md, раздел
// «Карточка пары».

import type { Cell, CommentItem, Overview, PairStatus, Role, Severity, Signal } from '../../api/types'
import { formatNumber, monthsPhrase } from '../../lib/format'
import { compareSignals, isOpen, sentenceAround, SEVERITY_RANK } from '../../lib/rules'

const STATUS_RANK: Record<PairStatus, number> = { risk: 0, watch: 1, ok: 2 }

// Порядок пар как в таблице обзора: статус, потом число открытых сигналов.
export function pairOrder(pairs: Overview['pairs']): string[] {
  return [...pairs]
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.open_signals - a.open_signals ||
        a.pair_id.localeCompare(b.pair_id),
    )
    .map((p) => p.pair_id)
}

// Соседи в этом порядке, без перехода по кругу.
export function neighbours(order: readonly string[], id: string): { prev: string | null; next: string | null } {
  const i = order.indexOf(id)
  if (i < 0) return { prev: null, next: null }
  return { prev: order[i - 1] ?? null, next: order[i + 1] ?? null }
}

// В месяце есть хотя бы одна анкета.
export function hasData(cell: Cell): boolean {
  return !(cell.missing.intern && cell.missing.mentor)
}

// Сигнал в окне активных: последние active_months месяцев пары.
export function inWindow(signal: Signal, lastMonth: number, activeMonths: number): boolean {
  return signal.month > lastMonth - activeMonths
}

// Открытые сигналы одного условия за разные месяцы (тип, роль и заголовок
// совпадают): один разговор, одна карточка, отметка уходит на все.
export interface SignalGroup {
  id: string
  head: Signal
  signals: Signal[]
  severity: Severity
}

export function openGroups(signals: readonly Signal[]): SignalGroup[] {
  const byKey = new Map<string, Signal[]>()
  for (const s of signals.filter(isOpen)) {
    const id = `${s.type}:${s.role}:${s.title}`
    byKey.set(id, [...(byKey.get(id) ?? []), s])
  }
  return [...byKey]
    .map(([id, list]) => {
      const all = [...list].sort((a, b) => b.month - a.month)
      const severity = all.reduce<Severity>((acc, s) => (SEVERITY_RANK[s.severity] < SEVERITY_RANK[acc] ? s.severity : acc), 'low')
      return { id, head: all[0], signals: all, severity }
    })
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || compareSignals(a.head, b.head))
}

// Отмеченные и старые сигналы: от свежего к старому.
export function doneSignals(signals: readonly Signal[]): Signal[] {
  return signals.filter((s) => !isOpen(s)).sort((a, b) => b.month - a.month || compareSignals(a, b))
}

// «5-й месяц», «4–5-й месяцы».
export function groupMonths(group: SignalGroup): string {
  return monthsPhrase(group.signals.map((s) => s.month))
}

// Одна строка объяснения с цифрами: первое предложение текста бэкенда. Если оно
// цепочка «4,4 → 3,8 → 3,0» (спад за три месяца), строку собираем из крайних значений.
export function explanationLine(signal: Signal): string {
  const text = signal.explanation.trim()
  const end = /[.!?](\s|$)/.exec(text)
  const first = end ? text.slice(0, end.index + 1) : text
  if (!first.includes('→')) return first
  const role: Role = signal.role === 'mentor' ? 'mentor' : 'intern'
  const vals = signal.values
    .filter((v): v is { role: Role; month: number; value: number } => v.role === role && v.value != null)
    .sort((a, b) => a.month - b.month)
  const from = vals[0]
  const to = vals[vals.length - 1]
  if (!from || !to || from.month === to.month) return first
  const who = role === 'intern' ? 'стажёра' : 'наставника'
  return `С ${from.month}-го по ${to.month}-й месяц оценка ${who} снизилась с ${formatNumber(from.value)} до ${formatNumber(to.value)}.`
}

export interface Range {
  start: number
  end: number
}

export interface QuoteView {
  role: Role
  text: string
  marks: Range[]
}

// Цитата сигнала: предложение комментария вокруг первого фрагмента, все
// фрагменты сигнала внутри него подсвечены. Комментария нет: сам фрагмент.
export function signalQuote(signal: Signal, comments: readonly CommentItem[]): QuoteView | null {
  const q = signal.quotes[0]
  if (!q) return null
  const c = comments.find((x) => x.role === q.role && x.month === q.month && x.question_id === q.question_id)
  if (!c || c.text.slice(q.start, q.end) !== q.text) return { role: q.role, text: q.text, marks: [] }
  const cut = sentenceAround(c.text, q.start, q.end)
  const from = q.start - cut.start
  const marks = signal.quotes
    .filter((x) => x.role === q.role && x.month === q.month && x.question_id === q.question_id)
    .map((x) => ({ start: x.start - from, end: x.end - from }))
    .filter((m) => m.start >= 0 && m.end <= cut.text.length)
  return { role: q.role, text: cut.text, marks }
}

// Подсветка не нужна, если фрагмент и есть вся цитата.
export function marksWorthShowing(text: string, marks: readonly Range[]): Range[] {
  const core = text.replace(/[\s.!?…]+$/, '').length
  return marks.some((m) => m.start <= 0 && m.end >= core) ? [] : [...marks]
}
