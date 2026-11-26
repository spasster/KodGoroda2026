// Расчёты обзора поверх API: история каждого стажёра на выбранный месяц.

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
  /** Самая важная прошлая ситуация (не low, не «проблемы нет»). Для строки «выправилось». */
  past: Signal | null
}

const RANK: Record<PairStatus, number> = { risk: 0, watch: 1, ok: 2 }

/** История пары: статус от бэкенда, главное из самой важной активной ситуации. */
export function storyOf(pair: PairSummary, all: Signal[]): Story {
  // Заметки (важность low) светофор не красят и поводом для разговора не считаются.
  const act = all.filter((s) => s.pair_id === pair.pair_id && isActive(s) && s.severity !== 'low').sort(compareSignals)
  const open = act.filter(isOpen).length
  const past = all
    .filter((s) => s.pair_id === pair.pair_id && !s.active && s.severity !== 'low' && s.review.status !== 'rejected')
    .sort(compareSignals)
  return {
    pair,
    status: pair.status,
    main: act[0] ?? null,
    active: act.length,
    reviewed: act.length - open,
    signals: open,
    past: past[0] ?? null,
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

// История программы по клеткам: у скольких пар был критичный месяц, у скольких
// только зона внимания, и сколько анкет собрано из положенных.
export interface History {
  riskEver: number
  watchOnly: number
  collected: number
  expected: number
}

export function historyOf(pairs: PairSummary[], months: number): History {
  let riskEver = 0
  let watchOnly = 0
  let collected = 0
  for (const p of pairs) {
    if (p.cells.some((c) => c.status === 'risk')) riskEver++
    else if (p.cells.some((c) => c.status === 'watch')) watchOnly++
    for (const c of p.cells) collected += Number(!c.missing.intern) + Number(!c.missing.mentor)
  }
  return { riskEver, watchOnly, collected, expected: pairs.length * months * 2 }
}
