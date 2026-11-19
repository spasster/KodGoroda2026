import { describe, expect, it } from 'vitest'

import type { ReviewStatus, Severity, Signal, SignalType } from '../../api/types'
import { buildView, DEFAULT_FILTERS, itemsOf, readFilters, stableOrder, writeFilters } from './model'

function sig(
  type: SignalType,
  pair: string,
  month: number,
  severity: Severity = 'medium',
  status: ReviewStatus = 'open',
  role: Signal['role'] = 'both',
): Signal {
  return {
    key: `${type}:${pair}:${role}:${month}`,
    type,
    pair_id: pair,
    role,
    month,
    severity,
    title: type,
    explanation: '',
    action: '',
    values: [],
    quotes: [],
    active: month > 3 && status !== 'rejected',
    review: { status, note: null, updated_at: null },
  }
}

const last = new Map([
  ['P-02', 5],
  ['P-05', 5],
])

describe('фильтры в адресе', () => {
  it('умолчание не пишет ничего', () => {
    expect(writeFilters(DEFAULT_FILTERS).toString()).toBe('')
    expect(readFilters(new URLSearchParams(''))).toEqual(DEFAULT_FILTERS)
  })

  it('туда и обратно', () => {
    const f = { status: 'rejected', severity: 'high', recent: false } as const
    expect(readFilters(writeFilters(f))).toEqual(f)
  })

  it('мусор даёт умолчание', () => {
    expect(readFilters(new URLSearchParams('status=x&severity=y&period=z'))).toEqual(DEFAULT_FILTERS)
  })
})

describe('buildView', () => {
  const all = [
    sig('gap_mentor_low', 'P-05', 5, 'high'),
    sig('gap_mentor_low', 'P-05', 4, 'high', 'confirmed'),
    sig('gap_mentor_low', 'P-05', 3, 'high'),
    sig('decline', 'P-02', 5, 'medium', 'rejected', 'intern'),
    sig('silence', 'P-02', 4, 'low', 'open', 'intern'),
  ]

  it('окно по последнему месяцу пары, ложная тревога в окне остаётся', () => {
    const v = buildView(all, { ...DEFAULT_FILTERS, status: 'all' }, last, 2)
    expect(v.statusCounts).toEqual({ open: 2, confirmed: 1, rejected: 1, all: 4 })
    expect(v.list.map((s) => s.month)).toEqual([5, 4, 5, 4])
  })

  it('без окна видно и старое', () => {
    const v = buildView(all, { ...DEFAULT_FILTERS, recent: false }, last, 2)
    expect(v.statusCounts.all).toBe(5)
    expect(v.list).toHaveLength(3)
  })

  it('важность считается по отметке, фильтр важности сужает список', () => {
    const v = buildView(all, { ...DEFAULT_FILTERS, severity: 'low' }, last, 2)
    expect(v.severityCounts).toEqual({ high: 1, medium: 0, low: 1 })
    expect(v.list.map((s) => s.key)).toEqual(['silence:P-02:intern:4'])
    expect(v.byStatus).toBe(2)
  })

  it('отмеченный на глазах остаётся в «Открытых»', () => {
    const marked = all.map((s) => (s.month === 5 && s.pair_id === 'P-05' ? sig('gap_mentor_low', 'P-05', 5, 'high', 'confirmed') : s))
    const v = buildView(marked, DEFAULT_FILTERS, last, 2, new Set(['gap_mentor_low:P-05:both:5']))
    expect(v.list.map((s) => s.key)).toContain('gap_mentor_low:P-05:both:5')
    expect(v.statusCounts.open).toBe(1)
    expect(v.openInList).toBe(1)
  })
})

describe('itemsOf', () => {
  it('повторы с той же отметкой сворачиваются, с другой стоят отдельно', () => {
    const items = itemsOf([
      sig('gap_mentor_low', 'P-05', 5, 'high'),
      sig('gap_mentor_low', 'P-05', 4, 'high', 'confirmed'),
      sig('gap_mentor_low', 'P-05', 3, 'high'),
      sig('decline', 'P-05', 5, 'medium', 'open', 'mentor'),
    ])
    expect(items.map((i) => [i.signal.month, i.signal.type, i.repeats.map((r) => r.month)])).toEqual([
      [5, 'gap_mentor_low', [3]],
      [4, 'gap_mentor_low', []],
      [5, 'decline', []],
    ])
  })
})

describe('stableOrder', () => {
  it('старые на местах, новая пара встаёт по приоритету', () => {
    expect(stableOrder(['P-05', 'P-03', 'P-02'], ['P-03', 'P-05', 'P-01', 'P-02'])).toEqual(['P-05', 'P-03', 'P-01', 'P-02'])
  })

  it('пропавшая пара уходит, пустой прошлый порядок даёт текущий', () => {
    expect(stableOrder(['P-05', 'P-03'], ['P-03'])).toEqual(['P-03'])
    expect(stableOrder([], ['P-02', 'P-04'])).toEqual(['P-02', 'P-04'])
  })
})
