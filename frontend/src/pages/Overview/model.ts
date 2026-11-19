// Расчёты обзора поверх API: фраза-заголовок, группы плашек, сбор анкет,
// сигналы по парам, строка Excel в последних анкетах.
// Источник правил: docs/design/system.md, разделы «Итоги» и «Правила, которые фронт считает сам».

import type { Overview, PairStatus, PairSummary, RecentItem, Signal } from '../../api/types'
import { plural, type Forms } from '../../lib/format'
import { compareSignals, isActive, isOpen, sortPairsByPriority } from '../../lib/rules'

const PAIRS_INSTR: Forms = ['парой', 'парами', 'парами']
const PAIRS_DAT: Forms = ['паре', 'парам', 'парам']
const PAIRS_GEN: Forms = ['пары', 'пар', 'пар']

export interface StatusCounts {
  risk: number
  watch: number
  total: number
}

// «Пора поговорить с 4 парами из 5» и остальные случаи из system.md.
export function headline({ risk, watch, total }: StatusCounts): string {
  if (risk > 0 && risk === total) {
    return total === 1 ? 'Пора поговорить с единственной парой' : `Пора поговорить со всеми ${total} ${plural(total, PAIRS_INSTR)}`
  }
  if (risk > 0) return `Пора поговорить с ${risk} ${plural(risk, PAIRS_INSTR)} из ${total}`
  if (watch > 0) return `Срочно говорить не с кем. Присмотреться стоит к ${watch} ${plural(watch, PAIRS_DAT)}`
  return total === 1 ? 'Поговорить не с кем: у пары всё спокойно' : `Поговорить не с кем: у всех ${total} ${plural(total, PAIRS_GEN)} спокойно`
}

export function countStatuses(pairs: PairSummary[]): StatusCounts {
  return {
    risk: pairs.filter((p) => p.status === 'risk').length,
    watch: pairs.filter((p) => p.status === 'watch').length,
    total: pairs.length,
  }
}

// Плашки итогов: risk и watch по приоритету, ok по ID.
export type ChipGroups = Record<PairStatus, string[]>

export function chipGroups(pairs: PairSummary[], signals: Signal[]): ChipGroups {
  const ids = (st: PairStatus) => pairs.filter((p) => p.status === st).map((p) => p.pair_id)
  return {
    risk: sortPairsByPriority(ids('risk'), signals),
    watch: sortPairsByPriority(ids('watch'), signals),
    ok: ids('ok'),
  }
}

// Сигналы одной пары: активные (держат статус) и открытые (ждут решения HR).
export interface PairSignals {
  active: Signal[]
  open: Signal[]
}

const NO_SIGNALS: PairSignals = { active: [], open: [] }

export function signalsByPair(signals: Signal[]): (pairId: string) => PairSignals {
  const map = new Map<string, PairSignals>()
  for (const s of signals) {
    if (!isActive(s)) continue
    let entry = map.get(s.pair_id)
    if (!entry) map.set(s.pair_id, (entry = { active: [], open: [] }))
    entry.active.push(s)
    if (isOpen(s)) entry.open.push(s)
  }
  for (const entry of map.values()) {
    entry.active.sort(compareSignals)
    entry.open.sort(compareSignals)
  }
  return (pairId) => map.get(pairId) ?? NO_SIGNALS
}

// Сколько анкет пришло за месяц сбора: каждая пара даёт до двух.
export function responsesIn(pairs: PairSummary[], month: number): number {
  return pairs.reduce((n, p) => {
    const c = p.cells.find((cell) => cell.month === month)
    return n + (c ? Number(!c.missing.intern) + Number(!c.missing.mentor) : 0)
  }, 0)
}

// Последние анкеты: живые по одной, анкеты из Excel одной строкой.
export interface ExcelLine {
  count: number
  lastAt: string
  from: number
  to: number
}

export function splitRecent(o: Overview): { live: RecentItem[]; excel: ExcelLine | null } {
  const live = o.recent.filter((r) => r.source !== 'excel')
  const excel = o.recent.filter((r) => r.source === 'excel')
  if (excel.length === 0) return { live, excel: null }
  // В recent только 10 последних: всё, что не живое, пришло из Excel.
  const lastAt = excel.reduce((a, r) => (r.at > a ? r.at : a), excel[0].at)
  const to = Math.max(...excel.map((r) => r.month))
  const from = Math.min(to, ...o.months)
  return { live, excel: { count: Math.max(excel.length, o.totals.responses - live.length), lastAt, from, to } }
}
