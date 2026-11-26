// История каждой пары для таблицы программы. Копия расчёта обзора: страницы не зависят друг от друга.

import type { PairStatus, PairSummary, Signal } from '../../api/types'
import { compareSignals, isActive, isOpen } from '../../lib/rules'

export interface Story {
  pair: PairSummary
  status: PairStatus
  /** Самая важная активная ситуация. null — всё ровно. */
  main: Signal | null
  /** Активных ситуаций всего. */
  active: number
  /** Из них отмеченных HR. */
  reviewed: number
  /** Открытых, то есть ещё не отмеченных. */
  signals: number
  /** Самая важная прошлая ситуация, если активных нет: что было за программу. */
  past: Signal | null
}

const RANK: Record<PairStatus, number> = { risk: 0, watch: 1, ok: 2 }

export function storyOf(pair: PairSummary, all: Signal[]): Story {
  // Заметки (важность low) светофор не красят и поводом для разговора не считаются.
  const act = all.filter((s) => s.pair_id === pair.pair_id && isActive(s) && s.severity !== 'low').sort(compareSignals)
  const open = act.filter(isOpen).length
  const past = all
    .filter((s) => s.pair_id === pair.pair_id && !s.active && s.severity !== 'low' && s.review.status !== 'rejected')
    .sort(compareSignals)
  return { pair, status: pair.status, main: act[0] ?? null, active: act.length, reviewed: act.length - open, signals: open, past: past[0] ?? null }
}

export function sortStories(stories: Story[]): Story[] {
  return [...stories].sort(
    (a, b) => RANK[a.status] - RANK[b.status] || b.signals - a.signals || (a.pair.pair_id < b.pair.pair_id ? -1 : 1),
  )
}
