import { describe, expect, it } from 'vitest'

import type { Signal } from '../api/types'
import { afterReview, calendarMonthName, collectMonth, compareSignals, isOpen, sentenceAround, situationMonths } from './rules'

function sig(key: string, severity: Signal['severity'], extra: Partial<Signal> = {}): Signal {
  const [type, pair_id, role, month] = key.split(':')
  return {
    key,
    type: type as Signal['type'],
    pair_id,
    role: role as Signal['role'],
    month: Number(month),
    months: [Number(month)],
    since_month: Number(month),
    severity,
    title: key,
    explanation: '',
    action: '',
    values: [],
    quotes: [],
    active: true,
    review: { status: 'open', note: null, updated_at: null, month: null, previous: null },
    outcome: null,
    ...extra,
  }
}

// Активные сигналы тестового набора data/sample, как их отдаёт /api/signals?active=true.
const sample: Signal[] = [
  sig('gap_intern_low:P-03:both:5', 'high'),
  sig('gap_mentor_low:P-05:both:5', 'high'),
  sig('gap_intern_low:P-02:both:4', 'high'),
  sig('gap_intern_low:P-03:both:4', 'high'),
  sig('gap_mentor_low:P-05:both:4', 'high'),
  sig('text_vs_score:P-02:mentor:5', 'medium'),
  sig('silence:P-02:intern:5', 'medium'),
  sig('text_vs_score:P-04:intern:5', 'medium'),
  sig('decline:P-05:mentor:5', 'medium'),
  sig('decline:P-02:intern:4', 'medium'),
  sig('text_vs_score:P-02:mentor:4', 'medium'),
  sig('text_vs_score:P-04:intern:4', 'medium'),
  sig('decline:P-05:mentor:4', 'medium'),
  sig('silence:P-02:intern:4', 'low'),
]

describe('compareSignals', () => {
  it('важность, потом свежий месяц, потом тип', () => {
    const order = [...sample].sort(compareSignals).map((s) => s.key)
    expect(order.slice(0, 3)).toEqual(['gap_intern_low:P-03:both:5', 'gap_mentor_low:P-05:both:5', 'gap_intern_low:P-02:both:4'])
    const tie = [sig('silence:P-01:intern:5', 'high'), sig('decline:P-01:intern:5', 'high')]
    expect(tie.sort(compareSignals)[0].key).toBe('decline:P-01:intern:5')
  })
})

describe('isOpen', () => {
  it('активный и без отметки HR', () => {
    expect(isOpen(sig('decline:P-01:intern:5', 'high'))).toBe(true)
    expect(isOpen(sig('decline:P-01:intern:5', 'high', { active: false }))).toBe(false)
    const confirmed = sig('decline:P-01:intern:5', 'high', { review: { status: 'confirmed', note: null, updated_at: null, month: 4, previous: null } })
    expect(isOpen(confirmed)).toBe(false)
  })
})

describe('collectMonth', () => {
  it('наибольший next_month, но не больше длины программы', () => {
    const people = {
      interns: [{ id: 'S-01', mentor_id: 'M-01', pair_id: 'P-01', next_month: 6 }, { id: 'S-02', mentor_id: 'M-02', pair_id: 'P-02', next_month: 5 }],
      mentors: [{ id: 'M-01', intern_id: 'S-01', pair_id: 'P-01', next_month: null }],
    }
    expect(collectMonth(people, 6)).toBe(6)
    expect(collectMonth(people, 5)).toBe(5)
    expect(collectMonth({ interns: [], mentors: [] }, 6)).toBeNull()
    expect(collectMonth(undefined, 6)).toBeNull()
  })
})

describe('calendarMonthName', () => {
  it('месяц программы по дате свежей анкеты', () => {
    const recent = [
      { at: '2026-10-29T08:29:37Z', pair_id: 'P-02', role: 'mentor' as const, person_id: 'M-02', month: 5, source: 'excel' },
      { at: '2026-10-31T11:46:16Z', pair_id: 'P-05', role: 'mentor' as const, person_id: 'M-05', month: 5, source: 'excel' },
    ]
    expect(calendarMonthName(6, recent)).toBe('ноябрь')
    expect(calendarMonthName(1, recent)).toBe('июнь')
    expect(calendarMonthName(6, [])).toBeNull()
    // Поздняя анкета за 5-й месяц, пришедшая в ноябре, подпись не сдвигает.
    const late = [...recent, { at: '2026-11-19T19:11:17Z', pair_id: 'P-02', role: 'intern' as const, person_id: 'S-02', month: 5, source: 'form' }]
    expect(calendarMonthName(6, late)).toBe('ноябрь')
  })
})

describe('sentenceAround', () => {
  it('предложение с цитатой и сдвиг цитаты', () => {
    const text = 'Тестов много. Наставник обещал созвон, созвона так и не было. Учусь сам.'
    const start = text.indexOf('созвона так')
    const end = start + 'созвона так и не было'.length
    const s = sentenceAround(text, start, end)
    expect(s.text).toBe('Наставник обещал созвон, созвона так и не было.')
    expect(s.text.slice(s.start, s.end)).toBe('созвона так и не было')
  })

  it('цитата в первом и в последнем предложении без точки', () => {
    expect(sentenceAround('Задач нет совсем', 0, 9).text).toBe('Задач нет совсем')
  })
})

describe('situationMonths', () => {
  it('один месяц и серия', () => {
    expect(situationMonths(sig('decline:P-01:intern:4', 'high'))).toBe('4-й месяц')
    const run = sig('decline:P-01:intern:5', 'high', { months: [2, 3, 4, 5], since_month: 2 })
    expect(situationMonths(run)).toBe('со 2-го месяца, 4 мес.')
    const gap = sig('decline:P-01:intern:5', 'high', { months: [2, 5], since_month: 5 })
    expect(situationMonths(gap)).toBe('5-й месяц')
  })
})

describe('afterReview', () => {
  it('итог и повтор после ложной тревоги', () => {
    const s = sig('silence:P-01:intern:5', 'low', {
      outcome: { review_month: 3, last_month: 5, repeated: true, text: 'После отметки в 3-м месяце повторилось в 5-м' },
      review: { status: 'open', note: null, updated_at: null, month: 3, previous: { status: 'rejected', month: 2 } },
    })
    expect(afterReview(s)).toEqual([
      'После отметки в 3-м месяце повторилось в 5-м',
      'Во 2-м месяце отмечено как ложная тревога, после этого повторилось',
    ])
    expect(afterReview(sig('silence:P-01:intern:5', 'low'))).toEqual([])
  })
})
