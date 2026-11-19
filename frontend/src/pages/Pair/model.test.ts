import { describe, expect, it } from 'vitest'

import type { Cell, PairDetail, ReviewStatus, Severity, Signal, Survey } from '../../api/types'
import {
  biggestChanges,
  gapSummary,
  heatStep,
  inWindow,
  neighbours,
  olderLine,
  olderSignals,
  signalGroups,
  statusLine,
} from './model'

const scale = { min: 1, max: 5 }
const th = { active_months: 2, gap: { min_gap: 0.25, high_gap: 0.4 } }

// Клетка с сигналом разрыва, как его ставит бэкенд: от 1 балла на шкале 1–5.
function cell(month: number, intern: number | null, mentor: number | null): Cell {
  const gap = intern != null && mentor != null ? Math.round((mentor - intern) * 10) / 10 : null
  const keys = gap == null ? [] : gap >= 1 ? [`gap_intern_low:P-03:both:${month}`] : gap <= -1 ? [`gap_mentor_low:P-03:both:${month}`] : []
  return {
    month,
    intern_index: intern,
    mentor_index: mentor,
    gap,
    status: 'ok',
    signal_keys: keys,
    missing: { intern: intern == null, mentor: mentor == null },
  }
}

// Ряд оценок по клеткам: один вопрос на роль, индекс и есть оценка.
function seriesOf(cells: Cell[]): PairDetail['series'] {
  return cells.map((c) => ({
    month: c.month,
    intern_index: c.intern_index,
    mentor_index: c.mentor_index,
    intern: { q: c.intern_index },
    mentor: { q: c.mentor_index },
  }))
}

function summary(cells: Cell[], last_month: number, collect: number) {
  return gapSummary({ cells, last_month, series: seriesOf(cells) }, scale, collect, th)
}

function signal(month: number, severity: Severity = 'medium', extra: Partial<Signal> = {}, status: ReviewStatus = 'open'): Signal {
  const type = extra.type ?? 'gap_intern_low'
  const role = extra.role ?? 'both'
  return {
    key: `${type}:P-03:${role}:${month}`,
    type,
    pair_id: 'P-03',
    role,
    month,
    severity,
    title: 'Стажёру хуже, чем видит наставник',
    explanation: '',
    action: '',
    values: [],
    quotes: [],
    active: true,
    review: { status, note: null, updated_at: null },
    ...extra,
  }
}

// P-03 из data/sample: разрыв 0,7 → 1,4 → 1,4 → 1,8 → 1,8.
const p03Cells = [cell(1, 3.8, 4.5), cell(2, 3.4, 4.8), cell(3, 3.4, 4.8), cell(4, 3.0, 4.8), cell(5, 3.0, 4.8)]

describe('statusLine', () => {
  it('пишет число активных сигналов и их важность', () => {
    expect(statusLine([signal(5, 'high'), signal(4, 'high')])).toBe('2 активных сигнала, оба высокой важности')
    expect(statusLine([signal(5, 'high'), signal(4), signal(3), signal(2)])).toBe('4 активных сигнала, 1 высокой важности')
    expect(statusLine([signal(5, 'low')])).toBe('1 активный сигнал, низкая важность')
    expect(statusLine([signal(5, 'medium'), signal(4, 'low')])).toBe('2 активных сигнала')
    expect(statusLine([signal(5, 'high', { active: false })])).toBe('Активных сигналов нет')
  })
})

describe('gapSummary', () => {
  it('объясняет разрыв P-03 как в эталоне', () => {
    const g = summary(p03Cells, 5, 6)
    expect(g.last).toEqual({ month: 5, gap: 1.8 })
    expect(g.gaps.map((x) => x.gap)).toEqual([0.7, 1.4, 1.4, 1.8, 1.8])
    expect(g.lead).toBe(
      'Разрыв в\u00a05-м месяце. Стажёру хуже, чем видит наставник. Порог высокой важности 1,6\u00a0балла. Разрыв выше порога с\u00a04-го месяца.',
    )
  })

  it('говорит, чья анкета за последний месяц не пришла', () => {
    const cells = [cell(3, 3.8, 4.5), cell(4, 3.0, 4.8), cell(5, null, 4.5)]
    expect(summary(cells, 5, 6).lead).toContain('За\u00a05-й месяц стажёр анкету не прислал.')
    const live = [cell(5, 4.6, 4.8), cell(6, 2.6, null)]
    expect(summary(live, 6, 6).lead).toContain('За\u00a06-й месяц наставник анкету ещё не прислал.')
  })

  it('различает направление и близкие оценки', () => {
    expect(summary([cell(5, 4.6, 2.0)], 5, 6).lead).toContain('Наставник ставит ниже, чем стажёр.')
    expect(summary([cell(5, 4.6, 4.8)], 5, 6).lead).toContain('Оценки близкие: разрыв меньше\u00a01,0 балла.')
    expect(summary([cell(1, 4.0, null)], 1, 1).last).toBeNull()
  })

  it('порог сверяет с точным разрывом, а не с округлённым', () => {
    // Стажёр 4,4,4,4,3 (3,8), наставник 5,5,5,4 (4,75): на экране 3,8 и 4,8, разрыв 1,0,
    // точно 0,95. Сигнала разрыва нет, значит и направления нет.
    const c: Cell = { ...cell(6, 3.8, 4.8), signal_keys: [] }
    const series = [{ month: 6, intern_index: 3.8, mentor_index: 4.8, intern: { a: 4, b: 4, c: 4, d: 4, e: 3 }, mentor: { a: 5, b: 5, c: 5, d: 4 } }]
    const g = gapSummary({ cells: [c], last_month: 6, series }, scale, 6, th)
    expect(g.lead).toContain('Оценки близкие')
    // Показанный 1,6 при точном 1,55: выше порога высокой важности не пишем.
    const near: Cell = { ...cell(5, 3.0, 4.6), signal_keys: ['gap_intern_low:P-03:both:5'] }
    const s2 = [{ month: 5, intern_index: 3.0, mentor_index: 4.6, intern: { a: 3, b: 3, c: 3, d: 3 }, mentor: { a: 5, b: 5, c: 4, d: 4, e: 5, f: 5, g: 5, h: 4, i: 5, j: 4, k: 5, l: 4, m: 5, n: 4, o: 5, p: 5, q: 4, r: 5, s: 4, t: 4 } }]
    expect(gapSummary({ cells: [near], last_month: 5, series: s2 }, scale, 6, th).lead).not.toContain('выше порога')
  })
})

describe('biggestChanges', () => {
  const survey: Survey = {
    title: '',
    months: 6,
    scale: { min: 1, max: 5, min_label: '', max_label: '' },
    roles: {
      intern: {
        title: '',
        person_label: '',
        questions: [
          { id: 'overall', type: 'scale', text: 'Как в целом?' },
          { id: 'support', type: 'scale', text: 'Помощь наставника?' },
          { id: 'comment', type: 'text', text: 'Комментарий' },
        ],
      },
      mentor: { title: '', person_label: '', questions: [{ id: 'speed', type: 'scale', text: 'Скорость?' }] },
    },
    paired_questions: [],
    thresholds: th,
  }
  const series: PairDetail['series'] = [
    { month: 1, intern_index: 4, mentor_index: 4, intern: { overall: 4, support: 3 }, mentor: { speed: 4 } },
    { month: 5, intern_index: 3, mentor_index: 5, intern: { overall: 3, support: 2 }, mentor: { speed: 5 } },
  ]

  it('сначала падения, при равенстве ниже итоговая оценка', () => {
    const list = biggestChanges(series, survey)
    expect(list.map((c) => `${c.question.id} ${c.from}→${c.to}`)).toEqual(['support 3→2', 'overall 4→3', 'speed 4→5'])
    expect(list[0]).toMatchObject({ fromMonth: 1, toMonth: 5, role: 'intern' })
  })
})

describe('старые сигналы', () => {
  it('окно активных считается от последнего месяца пары', () => {
    expect(inWindow(signal(4), 5, 2)).toBe(true)
    expect(inWindow(signal(3), 5, 2)).toBe(false)
  })

  it('строка «Раньше» склоняется', () => {
    expect(olderLine([signal(3), signal(2)], 2)).toBe(
      'Ещё 2 сигнала за 2–3-й месяцы. Они старше двух месяцев и на статус пары уже не влияют.',
    )
    expect(olderLine([signal(3)], 2)).toBe('Ещё 1 сигнал за 3-й месяц. Он старше двух месяцев и на статус пары уже не влияет.')
    expect(olderLine([signal(2)], 3)).toContain('старше трёх месяцев')
    expect(olderSignals([signal(2), signal(5), signal(3, 'high')], 5, 2).map((s) => s.month)).toEqual([3, 2])
  })
})

describe('signalGroups', () => {
  it('повторы одного условия идут под свежим сигналом', () => {
    const groups = signalGroups([signal(4, 'high'), signal(5, 'high')])
    expect(groups).toHaveLength(1)
    expect(groups[0].head.month).toBe(5)
    expect(groups[0].repeats.map((r) => r.month)).toEqual([4])
  })

  it('повтор с другой отметкой встаёт своим блоком, сигнал не пропадает', () => {
    const groups = signalGroups([signal(5, 'high', {}, 'rejected'), signal(4, 'high')])
    expect(groups.map((g) => [g.head.month, g.repeats.length])).toEqual([
      [5, 0],
      [4, 0],
    ])
  })
})

describe('мелочи', () => {
  it('соседние пары без перехода по кругу', () => {
    expect(neighbours(['P-03', 'P-01', 'P-02'], 'P-02')).toEqual({ prev: 'P-01', next: 'P-03' })
    expect(neighbours(['P-01', 'P-02'], 'P-01')).toEqual({ prev: null, next: 'P-02' })
    expect(neighbours(['P-01'], 'P-09')).toEqual({ prev: null, next: null })
  })

  it('ступень тепловой карты по шкале анкеты', () => {
    expect([1, 2, 3, 4, 5].map((v) => heatStep(v, scale))).toEqual([1, 2, 3, 4, 5])
    expect(heatStep(10, { min: 0, max: 10 })).toBe(5)
    expect(heatStep(0, { min: 0, max: 10 })).toBe(1)
  })
})
