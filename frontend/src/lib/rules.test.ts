import { describe, expect, it } from 'vitest'

import type { Cell, Signal } from '../api/types'
import {
  calendarMonthName,
  clusterRepeats,
  collectMonth,
  gapDirection,
  highGapPoints,
  mainSignal,
  sentenceAround,
  sortPairsByPriority,
} from './rules'

const scale = { min: 1, max: 5 }

function sig(key: string, severity: Signal['severity'], extra: Partial<Signal> = {}): Signal {
  const [type, pair_id, role, month] = key.split(':')
  return {
    key,
    type: type as Signal['type'],
    pair_id,
    role: role as Signal['role'],
    month: Number(month),
    severity,
    title: key,
    explanation: '',
    action: '',
    values: [],
    quotes: [],
    active: true,
    review: { status: 'open', note: null, updated_at: null },
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

describe('sortPairsByPriority', () => {
  it('порядок пар на тестовых данных', () => {
    // Как в system.md: P-05, P-03, P-02, P-04. У P-05 и P-03 по два high, у P-05 больше сигналов.
    expect(sortPairsByPriority(['P-01', 'P-02', 'P-03', 'P-04', 'P-05'], sample)).toEqual([
      'P-05', 'P-03', 'P-02', 'P-04', 'P-01',
    ])
  })

  it('неактивные и отклонённые не считаются', () => {
    const list = [sig('decline:P-01:intern:6', 'high', { active: false }), sig('silence:P-02:intern:6', 'low')]
    expect(sortPairsByPriority(['P-01', 'P-02'], list)).toEqual(['P-02', 'P-01'])
  })
})

describe('mainSignal', () => {
  it('важность, потом свежий месяц, потом тип', () => {
    expect(mainSignal(sample.filter((s) => s.pair_id === 'P-02'))?.key).toBe('gap_intern_low:P-02:both:4')
    expect(mainSignal(sample.filter((s) => s.pair_id === 'P-05'))?.key).toBe('gap_mentor_low:P-05:both:5')
    const tie = [sig('silence:P-01:intern:5', 'high'), sig('decline:P-01:intern:5', 'high')]
    expect(mainSignal(tie)?.key).toBe('decline:P-01:intern:5')
    expect(mainSignal([])).toBeUndefined()
  })
})

describe('clusterRepeats', () => {
  it('сворачивает одно условие в паре, свежий сверху', () => {
    const groups = clusterRepeats(sample.filter((s) => s.pair_id === 'P-05'))
    expect(groups.map((g) => [g.head.key, g.repeats.map((r) => r.key)])).toEqual([
      ['gap_mentor_low:P-05:both:5', ['gap_mentor_low:P-05:both:4']],
      ['decline:P-05:mentor:5', ['decline:P-05:mentor:4']],
    ])
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

describe('gapDirection', () => {
  const cell = (i: number | null, m: number | null, keys: string[] = []): Cell => ({
    month: 5,
    intern_index: i,
    mentor_index: m,
    gap: i != null && m != null ? m - i : null,
    status: 'ok',
    signal_keys: keys,
    missing: { intern: i == null, mentor: m == null },
  })

  it('слово по клетке последнего месяца и её сигналу разрыва', () => {
    expect(gapDirection(cell(3.0, 4.8, ['gap_intern_low:P-03:both:5']))).toBe('стажёру хуже')
    expect(gapDirection(cell(4.6, 2.0, ['gap_mentor_low:P-05:both:5']))).toBe('наставник недоволен')
    expect(gapDirection(cell(null, 4.5))).toBe('нет анкеты стажёра')
    expect(gapDirection(cell(2.6, null))).toBe('нет анкеты наставника')
    expect(gapDirection(cell(4.6, 4.8))).toBeNull()
    // На экране 3,8 и 4,8, разрыв 1,0, но точный 0,95 ниже порога: сигнала нет, слова нет.
    expect(gapDirection(cell(3.8, 4.8))).toBeNull()
  })

  it('порог высокой важности в баллах', () => {
    expect(highGapPoints(scale, { active_months: 2, gap: { min_gap: 0.25, high_gap: 0.4 } })).toBeCloseTo(1.6)
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
