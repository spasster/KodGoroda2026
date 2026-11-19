// Расчёты карточки пары поверх API: строка статуса, блок разрыва, вопросы,
// которые сильнее всего изменились, старые сигналы, повторы, соседние пары.
// Правила и тексты: docs/design/system.md, раздел «Карточка пары».

import type { Cell, PairDetail, Question, Role, Signal, Survey, Thresholds } from '../../api/types'
import { formatCount, formatNumber, monthsPhrase, plural, SEVERITY_LABEL, windowWord, WORDS, type Forms } from '../../lib/format'
import { clusterRepeats, compareSignals, gapLowSide, highGapPoints, type Scale } from '../../lib/rules'

// В месяце есть хотя бы одна анкета. Бэкенд отдаёт клетки и для месяцев, где
// пара молчит целиком.
export function hasData(cell: Cell): boolean {
  return !(cell.missing.intern && cell.missing.mentor)
}

// Окно активных сигналов: последние active_months месяцев пары, считая от её
// последней анкеты. Как в backend/app/signals.py, но без учёта отметки: сигнал с
// «ложной тревогой» остаётся на своём месте в свёрнутом виде.
export function inWindow(signal: Signal, lastMonth: number, activeMonths: number): boolean {
  return signal.month > lastMonth - activeMonths
}

const ACTIVE_SIGNAL: Forms = ['активный сигнал', 'активных сигнала', 'активных сигналов']

// «2 активных сигнала, оба высокой важности».
export function statusLine(signals: readonly Signal[]): string {
  const act = signals.filter((s) => s.active)
  if (act.length === 0) return 'Активных сигналов нет'
  if (act.length === 1) return `1 активный сигнал, ${SEVERITY_LABEL[act[0].severity]} важность`
  const head = formatCount(act.length, ACTIVE_SIGNAL)
  const high = act.filter((s) => s.severity === 'high').length
  if (high === act.length) return `${head}, ${act.length === 2 ? 'оба' : 'все'} высокой важности`
  if (high > 0) return `${head}, ${high} высокой важности`
  return head
}

export interface GapPoint {
  month: number
  gap: number
}

export interface GapSummary {
  // Разрывы по месяцам, где ответили обе стороны, от старого к свежему.
  gaps: GapPoint[]
  last: GapPoint | null
  // Пояснение под крупной цифрой.
  lead: string
}

// Точный разрыв за месяц: среднее оценок наставника минус среднее оценок стажёра,
// как в backend/app/indices.py. Оценки в series целые, поэтому среднее точное, а
// Cell.gap собран из округлённых индексов. С порогами сверяем только точный.
const EPS = 1e-9

export function exactGap(point: PairDetail['series'][number] | undefined): number | null {
  if (!point) return null
  const mean = (r: Record<string, number | null>) => {
    const v = Object.values(r).filter((x): x is number => x != null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  const i = mean(point.intern)
  const m = mean(point.mentor)
  return i == null || m == null ? null : m - i
}

// Пояснение к разрыву: месяц, направление, порог, с какого месяца выше порога и
// чья анкета за последний месяц ещё не пришла. Направление берётся из сигнала
// разрыва за месяц, порог высокой важности сверяется с точным разрывом.
export function gapSummary(
  pair: Pick<PairDetail, 'cells' | 'last_month' | 'series'>,
  scale: Scale,
  collect: number | null,
  th: Thresholds,
): GapSummary {
  const gaps = pair.cells
    .filter((c): c is Cell & { gap: number } => c.gap != null)
    .map((c) => ({ month: c.month, gap: c.gap }))
    .sort((a, b) => a.month - b.month)
  const last = gaps[gaps.length - 1] ?? null
  if (!last) {
    return { gaps, last, lead: 'Разрыв появится, когда обе стороны пришлют анкеты за один месяц.' }
  }

  const side = gapLowSide(pair.cells.find((c) => c.month === last.month))
  const direction =
    side === 'intern'
      ? 'Стажёру хуже, чем видит наставник.'
      : side === 'mentor'
        ? 'Наставник ставит ниже, чем стажёр.'
        : `Оценки близкие: разрыв меньше\u00a0${formatNumber(th.gap.min_gap * (scale.max - scale.min))} балла.`

  const high = highGapPoints(scale, th)
  const exact = (month: number) => exactGap(pair.series.find((p) => p.month === month))
  let since: number | null = null
  for (let i = gaps.length - 1; i >= 0; i--) {
    const g = exact(gaps[i].month)
    if (g == null || Math.abs(g) < high - EPS) break
    since = gaps[i].month
  }
  const above =
    since == null ? '' : ` Разрыв выше порога ${since === last.month ? `в\u00a0${since}-м месяце` : `с\u00a0${since}-го месяца`}.`

  let waiting = ''
  const lastCell = pair.cells.find((c) => c.month === pair.last_month)
  if (lastCell && pair.last_month !== last.month && hasData(lastCell)) {
    const who = lastCell.missing.mentor ? 'наставник' : 'стажёр'
    waiting = ` За\u00a0${pair.last_month}-й месяц ${who} анкету ${pair.last_month === collect ? 'ещё ' : ''}не прислал.`
  }

  return {
    gaps,
    last,
    lead: `Разрыв в\u00a0${last.month}-м месяце. ${direction} Порог высокой важности ${formatNumber(high)}\u00a0балла.${above}${waiting}`,
  }
}

export interface QuestionChange {
  role: Role
  question: Question
  from: number
  to: number
  fromMonth: number
  toMonth: number
}

// Вопросы, которые сильнее всего изменились с первой анкеты роли до последней.
// Сначала самые большие изменения, при равных сначала падения и более низкие оценки.
export function biggestChanges(series: PairDetail['series'], survey: Survey, limit = 3): QuestionChange[] {
  const out: QuestionChange[] = []
  for (const role of ['intern', 'mentor'] as const) {
    const answered = series
      .filter((p) => (role === 'intern' ? p.intern_index : p.mentor_index) != null)
      .sort((a, b) => a.month - b.month)
    if (answered.length < 2) continue
    const first = answered[0]
    const last = answered[answered.length - 1]
    for (const q of survey.roles[role].questions) {
      if (q.type !== 'scale') continue
      const from = first[role][q.id]
      const to = last[role][q.id]
      if (from == null || to == null || from === to) continue
      out.push({ role, question: q, from, to, fromMonth: first.month, toMonth: last.month })
    }
  }
  return out
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from) || a.to - a.from - (b.to - b.from) || a.to - b.to)
    .slice(0, limit)
}

// Оценка по шкале: целые без запятой («3 → 2»), дробные с одним знаком.
export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : formatNumber(value)
}

// «Ещё 2 сигнала за 2–3-й месяцы. Они старше двух месяцев и на статус пары уже не влияют.»
export function olderLine(older: readonly Signal[], activeMonths: number): string {
  const n = older.length
  const age = windowWord(activeMonths)
  const tail = n === 1 ? `Он старше ${age} и на статус пары уже не влияет.` : `Они старше ${age} и на статус пары уже не влияют.`
  return `Ещё ${n} ${plural(n, WORDS.signal)} за ${monthsPhrase(older.map((s) => s.month))}. ${tail}`
}

// Блок сигнала на экране: главный и повторы, которые отмечаются вместе с ним.
export interface SignalGroup {
  head: Signal
  repeats: Signal[]
}

// Повторы одного условия сворачиваются под свежий сигнал. Если HR отметил повтор
// отдельно (снял флажок), у повтора другая отметка: он встаёт своим блоком сразу
// под главным, чтобы ни один сигнал не пропал с экрана.
export function signalGroups(signals: readonly Signal[]): SignalGroup[] {
  const out: SignalGroup[] = []
  for (const { head, repeats } of clusterRepeats([...signals])) {
    let rest = [head, ...repeats]
    while (rest.length > 0) {
      const [first, ...others] = rest
      const status = first.review.status
      const together = others.filter((r) => r.review.status === status)
      out.push({ head: first, repeats: together })
      rest = others.filter((r) => r.review.status !== status)
    }
  }
  return out
}

// Старые сигналы для строки «Раньше»: от свежего к старому, внутри месяца по важности.
export function olderSignals(signals: readonly Signal[], lastMonth: number, activeMonths: number): Signal[] {
  return signals
    .filter((s) => !inWindow(s, lastMonth, activeMonths))
    .sort((a, b) => b.month - a.month || compareSignals(a, b))
}

// Соседи по порядку ID, без перехода по кругу.
export function neighbours(ids: readonly string[], id: string): { prev: string | null; next: string | null } {
  const sorted = [...ids].sort()
  const i = sorted.indexOf(id)
  if (i < 0) return { prev: null, next: null }
  return { prev: sorted[i - 1] ?? null, next: sorted[i + 1] ?? null }
}

// Клетка тепловой карты: оценка в ступень 1–5 по шкале анкеты.
export function heatStep(value: number, scale: Scale): 1 | 2 | 3 | 4 | 5 {
  const share = (value - scale.min) / (scale.max - scale.min)
  return Math.min(5, Math.max(1, Math.round(1 + share * 4))) as 1 | 2 | 3 | 4 | 5
}

// «● Стажёр 3,0» в подсказке и подписи: оценка роли или «нет анкеты».
export function indexOf(cell: Cell | undefined, role: Role): number | null {
  if (!cell) return null
  return role === 'intern' ? cell.intern_index : cell.mentor_index
}
