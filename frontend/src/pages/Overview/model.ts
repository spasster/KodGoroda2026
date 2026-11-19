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

/** История пары: статус от бэкенда, вывод и цитата из самого важного активного сигнала. */
export function storyOf(pair: PairSummary, all: Signal[]): Story {
  const act = all.filter((s) => s.pair_id === pair.pair_id && isActive(s)).sort(compareSignals)
  return {
    pair,
    status: pair.status,
    title: act[0]?.title ?? null,
    quote: act.find((s) => s.quotes.length > 0)?.quotes[0] ?? null,
    signals: act.filter(isOpen).length,
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
