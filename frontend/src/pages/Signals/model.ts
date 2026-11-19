// Логика экрана сигналов без React: сегменты и порядок строк.
// Вид и тексты: docs/design/v2.md, раздел «Сигналы».

import type { Signal } from '../../api/types'
import { compareSignals } from '../../lib/rules'

export type Segment = 'open' | 'done' | 'all'

// Открытые: активные и не отмеченные, то же число, что open_signals в обзоре.
// Разобранные: HR отметил. Все: вся история.
export function inSegment(s: Signal, seg: Segment): boolean {
  if (seg === 'open') return s.active && s.review.status === 'open'
  if (seg === 'done') return s.review.status !== 'open'
  return true
}

// Сначала высокая важность, потом свежие.
export function segmentRows(all: readonly Signal[], seg: Segment): Signal[] {
  return all
    .filter((s) => inSegment(s, seg))
    .sort((a, b) => compareSignals(a, b) || (a.pair_id < b.pair_id ? -1 : a.pair_id > b.pair_id ? 1 : 0))
}
