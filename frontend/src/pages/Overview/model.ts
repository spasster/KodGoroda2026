// Расчёты обзора поверх API: порядок строк, главный сигнал пары, анкеты за месяц.

import type { PairStatus, PairSummary, Signal } from '../../api/types'
import { compareSignals, isActive } from '../../lib/rules'

const RANK: Record<PairStatus, number> = { risk: 0, watch: 1, ok: 2 }

// Сначала «Пора поговорить», потом «Присмотреться», потом «Всё ровно»; внутри
// больше открытых сигналов выше.
function sortRows(pairs: PairSummary[]): string[] {
  return [...pairs]
    .sort(
      (a, b) =>
        RANK[a.status] - RANK[b.status] ||
        b.open_signals - a.open_signals ||
        (a.pair_id < b.pair_id ? -1 : a.pair_id > b.pair_id ? 1 : 0),
    )
    .map((p) => p.pair_id)
}

// Порядок не прыгает при живом обновлении до перезагрузки страницы. Считаем
// заново, только если сменился состав пар или анкет стало меньше (база сброшена).
let held: { ids: string; responses: number; order: string[] } | null = null

export function rowOrder(pairs: PairSummary[], responses: number): string[] {
  const ids = pairs
    .map((p) => p.pair_id)
    .sort()
    .join(',')
  if (!held || held.ids !== ids || responses < held.responses) held = { ids, responses, order: sortRows(pairs) }
  else held.responses = responses
  return held.order
}

// Заголовок самого важного активного сигнала каждой пары.
export function mainTitles(signals: Signal[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const s of [...signals].filter(isActive).sort(compareSignals)) {
    if (!map.has(s.pair_id)) map.set(s.pair_id, s.title)
  }
  return map
}

// Сколько анкет пришло за месяц: каждая пара даёт до двух.
export function responsesIn(pairs: PairSummary[], month: number): number {
  return pairs.reduce((n, p) => {
    const c = p.cells.find((cell) => cell.month === month)
    return n + (c ? Number(!c.missing.intern) + Number(!c.missing.mentor) : 0)
  }, 0)
}
