// Расчёты карточки пары поверх API. Экран описан в docs/design/v2.md, раздел
// «Карточка пары».

import type { QuestionRow, Tone } from '../../components'
import type { Cell, CommentItem, Overview, PairDetail, PairStatus, Role, Signal, Survey } from '../../api/types'
import { formatNumber } from '../../lib/format'
import { compareSignals, isOpen, sentenceAround } from '../../lib/rules'

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

// Открытые ситуации: сначала важные, потом свежие.
export function openSignals(signals: readonly Signal[]): Signal[] {
  return signals.filter(isOpen).sort(compareSignals)
}

// Отмеченные и старые сигналы: от свежего к старому.
export function doneSignals(signals: readonly Signal[]): Signal[] {
  return signals.filter((s) => !isOpen(s)).sort((a, b) => b.month - a.month || compareSignals(a, b))
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
  return `${from.month === 2 ? 'Со' : 'С'} ${from.month}-го по ${to.month}-й месяц оценка ${who} снизилась с ${formatNumber(from.value)} до ${formatNumber(to.value)}.`
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

// Оценки пары по вопросам: строки по вопросам шкалы, значения по месяцам программы.
export function questionGroups(survey: Survey, series: PairDetail['series'], months: readonly number[]) {
  return (['intern', 'mentor'] as Role[]).map((role) => ({
    role,
    rows: survey.roles[role].questions
      .filter((q) => q.type === 'scale')
      .map<QuestionRow>((q) => ({
        id: q.id,
        text: q.label ?? q.text,
        values: months.map((m) => series.find((x) => x.month === m)?.[role][q.id] ?? null),
      })),
  }))
}

// Клетка с низкой оценкой: не выше max_score от размаха шкалы, как у сигнала «низкая оценка по вопросу».
export function lowTone(scale: { min: number; max: number }, maxScore: number): (value: number | null) => Tone {
  return (v) => (v == null ? 'none' : (v - scale.min) / (scale.max - scale.min) <= maxScore ? 'low' : 'fine')
}

// Заливка клетки по оценке одной пары: 1–2 критично, 3 зона внимания, 4–5 без заливки.
export function scoreTone(value: number | null): Tone {
  if (value == null) return 'none'
  if (value < 2.5) return 'low'
  if (value < 3.5) return 'mid'
  return 'fine'
}

// Парные вопросы анкеты: стажёр и наставник про одно и то же, рядом по месяцам и разница.
// Разница залита по порогам сигнала расхождения (доля размаха шкалы).
export function pairedGroups(survey: Survey, series: PairDetail['series'], months: readonly number[]) {
  const range = survey.scale.max - survey.scale.min
  const { min_gap, high_gap } = survey.thresholds.gap
  const at = (role: Role, id: string) => months.map((m) => series.find((x) => x.month === m)?.[role][id] ?? null)
  return survey.paired_questions.map((pq) => {
    const intern = at('intern', pq.intern)
    const mentor = at('mentor', pq.mentor)
    const diff = months.map((_, i) => {
      const a = intern[i]
      const b = mentor[i]
      return a == null || b == null ? null : a - b
    })
    const gapTone = (v: number | null): Tone => {
      if (v == null) return 'none'
      const d = Math.abs(v) / range
      return d >= high_gap ? 'low' : d >= min_gap ? 'mid' : 'fine'
    }
    const rows: QuestionRow[] = [
      { id: `${pq.label}:intern`, text: 'Стажёр', values: intern },
      { id: `${pq.label}:mentor`, text: 'Наставник', values: mentor },
      { id: `${pq.label}:gap`, text: 'Разница', values: diff, tone: gapTone, signed: true },
    ]
    return { role: 'intern' as Role, title: pq.label, rows }
  })
}

// Ситуации, которые уже не активны: важность medium и high, от поздних к ранним.
export function pastSignals(signals: readonly Signal[]): Signal[] {
  return signals
    .filter((s) => !s.active && s.severity !== 'low')
    .sort((a, b) => b.month - a.month || compareSignals(a, b))
}

// Заметки из комментариев: ситуации важности low, от поздних к ранним.
export function noteSignals(signals: readonly Signal[]): Signal[] {
  return signals.filter((s) => s.severity === 'low').sort((a, b) => b.month - a.month || compareSignals(a, b))
}

// Месяцы ситуации словами: «3-й месяц» или «месяцы 2–3».
export function monthsLabel(signal: Signal): string {
  const from = Math.min(signal.since_month, ...signal.months)
  const to = Math.max(signal.month, ...signal.months)
  return from === to ? `${to}-й месяц` : `месяцы ${from}–${to}`
}

// Чем кончилась прошлая ситуация: первый месяц после неё со статусом ok, в котором
// индекс роли выше, чем в последнем месяце ситуации. Нет такого месяца: null.
export function recovery(signal: Signal, cells: readonly Cell[]): { month: number; from: number; to: number } | null {
  const key = signal.role === 'mentor' ? 'mentor_index' : 'intern_index'
  const last = cells.find((c) => c.month === signal.month)?.[key]
  if (last == null) return null
  const ok = [...cells].sort((a, b) => a.month - b.month).find((c) => c.month > signal.month && c.status === 'ok')
  const now = ok?.[key]
  if (!ok || now == null || now <= last) return null
  return { month: ok.month, from: last, to: now }
}

// Откуда вывод: формула по оценкам и/или разбор комментария моделью.
export function signalSources(signal: Signal): string[] {
  const out: string[] = []
  if (signal.type !== 'text_vs_score') out.push('Формула по оценкам')
  if (signal.type === 'text_vs_score' || signal.quotes.length > 0) out.push('ИИ: разбор комментария')
  return out
}

// Цифры, на которых стоит вывод: «стажёр, месяц 3: 2,7».
export function valueTags(signal: Signal): string[] {
  return signal.values
    .filter((v) => v.value != null)
    .sort((a, b) => a.role.localeCompare(b.role) || a.month - b.month)
    .map((v) => `${v.role === 'intern' ? 'стажёр' : 'наставник'}, месяц ${v.month}: ${formatNumber(v.value)}`)
}
