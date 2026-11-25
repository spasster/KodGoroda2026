import { describe, expect, it } from 'vitest'

import type { ReviewStatus, Severity, Signal } from '../../api/types'
import { segmentRows } from './model'

function sig(pair: string, month: number, severity: Severity, status: ReviewStatus = 'open', active = true): Signal {
  return {
    key: `decline:${pair}:intern`,
    type: 'decline',
    pair_id: pair,
    role: 'intern',
    month,
    months: [month],
    since_month: month,
    severity,
    title: '',
    explanation: '',
    action: '',
    values: [],
    quotes: [],
    active: active && status !== 'rejected',
    review: { status, note: null, updated_at: null, month: null, previous: null },
    outcome: null,
  }
}

const all = [
  sig('P-01', 4, 'medium'),
  sig('P-02', 5, 'high'),
  sig('P-03', 5, 'medium'),
  sig('P-04', 4, 'high', 'confirmed'),
  sig('P-05', 3, 'high', 'rejected'),
  sig('P-01', 2, 'high', 'open', false),
]

const keys = (list: Signal[]) => list.map((s) => `${s.pair_id}:${s.month}`)

describe('сегменты экрана сигналов', () => {
  it('открытые: активные без отметки, сначала высокая важность, потом свежие', () => {
    expect(keys(segmentRows(all, 'open'))).toEqual(['P-02:5', 'P-03:5', 'P-01:4'])
  })

  it('разобранные: всё, что отметил HR, в том числе вне окна', () => {
    expect(keys(segmentRows(all, 'done'))).toEqual(['P-04:4', 'P-05:3'])
  })

  it('все: вся история', () => {
    expect(segmentRows(all, 'all')).toHaveLength(all.length)
  })
})
