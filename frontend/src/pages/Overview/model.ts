// Расчёты обзора поверх API: история каждого стажёра на выбранный месяц.

import type { PairStatus, PairSummary, Quote, Signal } from '../../api/types'
import { compareSignals, isActive, isOpen } from '../../lib/rules'

export interface Story {
  pair: PairSummary
  status: PairStatus
  /** Главный вывод: заголовок самого важного сигнала. null — всё ровно. */
  title: string | null
  quote: Quote | null
  signals: number
}

const RANK: Record<PairStatus, number> = { risk: 0, watch: 1, ok: 2 }

/**
 * История пары. upto = null — как сейчас, по данным бэкенда.
 * upto = месяц — как это выглядело тогда: считаем по сигналам за этот и прошлый месяц
 * тем же правилом, что бэкенд (docs/contract.md, «Статус пары»).
 */
export function storyOf(pair: PairSummary, all: Signal[], upto: number | null, window: number): Story {
  const own = all.filter((s) => s.pair_id === pair.pair_id)
  const act = (
    upto == null ? own.filter(isActive) : own.filter((s) => s.month <= upto && s.month > upto - window && s.review.status !== 'rejected')
  ).sort(compareSignals)
  const status: PairStatus =
    upto == null ? pair.status : act.some((s) => s.severity === 'high') || act.length >= 2 ? 'risk' : act.length ? 'watch' : 'ok'
  return {
    pair,
    status,
    title: act[0]?.title ?? null,
    quote: act.find((s) => s.quotes.length > 0)?.quotes[0] ?? null,
    signals: upto == null ? act.filter(isOpen).length : act.length,
  }
}

export function sortStories(stories: Story[]): Story[] {
  return [...stories].sort(
    (a, b) => RANK[a.status] - RANK[b.status] || b.signals - a.signals || (a.pair.pair_id < b.pair.pair_id ? -1 : 1),
  )
}

// Сколько анкет пришло за месяц: каждая пара даёт до двух.
export function responsesIn(pairs: PairSummary[], month: number): number {
  return pairs.reduce((n, p) => {
    const c = p.cells.find((cell) => cell.month === month)
    return n + (c ? Number(!c.missing.intern) + Number(!c.missing.mentor) : 0)
  }, 0)
}
