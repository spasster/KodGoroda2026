import { describe, expect, it } from 'vitest'

import type { Cell, CommentItem, Overview, Signal } from '../../api/types'
import {
  doneSignals,
  explanationLine,
  marksWorthShowing,
  monthsLabel,
  neighbours,
  openSignals,
  pairOrder,
  pastSignals,
  recovery,
  scoreTone,
  signalQuote,
  signalSources,
} from './model'

function sig(over: Partial<Signal> & Pick<Signal, 'type' | 'month'>): Signal {
  return {
    key: `${over.type}:P-01:${over.role ?? 'intern'}`,
    pair_id: 'P-01',
    role: 'intern',
    months: [over.month],
    since_month: over.month,
    severity: 'medium',
    title: 'Заголовок',
    explanation: '',
    action: '',
    values: [],
    quotes: [],
    active: true,
    review: { status: 'open', note: null, updated_at: null, month: null, previous: null },
    outcome: null,
    ...over,
  }
}

describe('explanationLine', () => {
  it('берёт первое предложение', () => {
    const s = sig({ type: 'gap_intern_low', month: 5, explanation: 'В 5-м месяце стажёр ставит 3,0, наставник 4,8. Разрыв 1,8 балла.' })
    expect(explanationLine(s)).toBe('В 5-м месяце стажёр ставит 3,0, наставник 4,8.')
  })

  it('цепочку чисел заменяет крайними значениями', () => {
    const s = sig({
      type: 'decline',
      role: 'mentor',
      month: 5,
      explanation: 'Оценка наставника за три месяца: 3,0 → 2,5 → 2,0. Сильнее всего упала оценка по вопросу «X»: 3 → 2.',
      values: [
        { role: 'mentor', month: 3, value: 3 },
        { role: 'mentor', month: 4, value: 2.5 },
        { role: 'mentor', month: 5, value: 2 },
      ],
    })
    expect(explanationLine(s)).toBe('С 3-го по 5-й месяц оценка наставника снизилась с 3,0 до 2,0.')
  })

  it('резкое падение за месяц оставляет как есть', () => {
    const s = sig({ type: 'decline', month: 6, explanation: 'Оценка стажёра за месяц упала с 4,6 до 2,6. Сильнее всего: 5 → 2.' })
    expect(explanationLine(s)).toBe('Оценка стажёра за месяц упала с 4,6 до 2,6.')
  })
})

describe('openSignals', () => {
  it('оставляет открытые активные, сначала важные', () => {
    const rejected = { status: 'rejected' as const, note: null, updated_at: null, month: 4, previous: null }
    const list = [
      sig({ type: 'silence', month: 5, severity: 'low' }),
      sig({ type: 'gap_intern_low', role: 'both', month: 5, severity: 'high' }),
      sig({ type: 'decline', month: 3, active: false }),
      sig({ type: 'decline', month: 5, review: rejected }),
    ]
    expect(openSignals(list).map((s) => s.type)).toEqual(['gap_intern_low', 'silence'])
    expect(doneSignals(list).map((s) => s.type)).toEqual(['decline', 'decline'])
  })
})

describe('pairOrder и neighbours', () => {
  it('идут в порядке обзора: статус, потом число открытых сигналов', () => {
    const p = (pair_id: string, status: 'risk' | 'watch' | 'ok', open_signals: number) =>
      ({ pair_id, status, open_signals }) as Overview['pairs'][number]
    const order = pairOrder([p('P-01', 'ok', 0), p('P-02', 'risk', 2), p('P-03', 'watch', 1), p('P-04', 'risk', 5)])
    expect(order).toEqual(['P-04', 'P-02', 'P-03', 'P-01'])
    expect(neighbours(order, 'P-04')).toEqual({ prev: null, next: 'P-02' })
    expect(neighbours(order, 'P-03')).toEqual({ prev: 'P-02', next: 'P-01' })
  })
})

describe('signalQuote', () => {
  it('режет предложение вокруг фрагмента', () => {
    const text = 'Всё так же. Сообщения висят по два дня. Стараюсь не дёргать.'
    const start = text.indexOf('висят')
    const s = sig({
      type: 'gap_intern_low',
      month: 4,
      quotes: [{ role: 'intern', month: 4, question_id: 'c', text: 'висят по два дня', start, end: start + 16 }],
    })
    const c = { role: 'intern', month: 4, question_id: 'c', text } as CommentItem
    expect(signalQuote(s, [c])).toEqual({ role: 'intern', text: 'Сообщения висят по два дня.', marks: [{ start: 10, end: 26 }] })
  })

  it('не подсвечивает, если фрагмент и есть вся цитата', () => {
    expect(marksWorthShowing('Опять сорвал срок.', [{ start: 0, end: 17 }])).toEqual([])
  })
})

describe('история ситуаций', () => {
  const cell = (month: number, intern: number, status: Cell['status']): Cell => ({
    month, intern_index: intern, mentor_index: intern, gap: 0, status, signal_keys: [], missing: { intern: false, mentor: false },
  })
  const cells = [cell(2, 3.1, 'watch'), cell(3, 2.7, 'risk'), cell(4, 4.0, 'ok'), cell(5, 4.1, 'watch')]

  it('прошлая ситуация выправилась к первому месяцу ok с ростом индекса', () => {
    const s = sig({ type: 'low_question', month: 3, months: [2, 3], since_month: 2, active: false })
    expect(recovery(s, cells)).toEqual({ month: 4, from: 2.7, to: 4.0 })
    expect(monthsLabel(s)).toBe('месяцы 2–3')
    expect(monthsLabel(sig({ type: 'decline', month: 3 }))).toBe('3-й месяц')
  })

  it('нет месяца ok после ситуации: исход не пишем', () => {
    expect(recovery(sig({ type: 'decline', month: 4 }), cells)).toBeNull()
  })

  it('в истории только неактивные medium и high, от поздних к ранним', () => {
    const list = [
      sig({ type: 'decline', month: 2, active: false }),
      sig({ type: 'low_question', month: 3, active: false }),
      sig({ type: 'text_vs_score', month: 5, active: false, severity: 'low' }),
      sig({ type: 'gap_intern_low', month: 6 }),
    ]
    expect(pastSignals(list).map((s) => s.month)).toEqual([3, 2])
  })

  it('источник вывода: формула, разбор текста или оба', () => {
    expect(signalSources(sig({ type: 'decline', month: 3 }))).toEqual(['Формула по оценкам'])
    expect(signalSources(sig({ type: 'text_vs_score', month: 3 }))).toEqual(['ИИ: разбор комментария'])
    const q = { role: 'intern' as const, month: 3, question_id: 'x', text: 't', start: 0, end: 1 }
    expect(signalSources(sig({ type: 'decline', month: 3, quotes: [q] }))).toEqual(['Формула по оценкам', 'ИИ: разбор комментария'])
  })

  it('заливка клетки: 1–2 критично, 3 внимание, 4–5 без заливки', () => {
    expect([1, 2, 3, 4, 5, null].map(scoreTone)).toEqual(['low', 'low', 'mid', 'fine', 'fine', 'none'])
  })
})
