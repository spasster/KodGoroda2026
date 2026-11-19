import { describe, expect, it } from 'vitest'

import type { CommentItem, Overview, Signal } from '../../api/types'
import { doneSignals, explanationLine, marksWorthShowing, neighbours, openGroups, pairOrder, signalQuote } from './model'

function sig(over: Partial<Signal> & Pick<Signal, 'type' | 'month'>): Signal {
  return {
    key: `${over.type}:P-01:${over.role ?? 'intern'}:${over.month}`,
    pair_id: 'P-01',
    role: 'intern',
    severity: 'medium',
    title: 'Заголовок',
    explanation: '',
    action: '',
    values: [],
    quotes: [],
    active: true,
    review: { status: 'open', note: null, updated_at: null },
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

describe('openGroups', () => {
  it('склеивает одно условие за разные месяцы, разные заголовки не склеивает', () => {
    const list = [
      sig({ type: 'silence', month: 5, title: 'Стажёр не заполнил анкету' }),
      sig({ type: 'silence', month: 4, title: 'Стажёр оставил комментарий пустым', severity: 'low' }),
      sig({ type: 'gap_intern_low', role: 'both', month: 5, severity: 'high', title: 'Разрыв' }),
      sig({ type: 'gap_intern_low', role: 'both', month: 4, severity: 'high', title: 'Разрыв' }),
      sig({ type: 'decline', month: 3, active: false }),
      sig({ type: 'decline', month: 5, review: { status: 'rejected', note: null, updated_at: null } }),
    ]
    const groups = openGroups(list)
    expect(groups.map((g) => [g.head.title, g.signals.map((s) => s.month)])).toEqual([
      ['Разрыв', [5, 4]],
      ['Стажёр не заполнил анкету', [5]],
      ['Стажёр оставил комментарий пустым', [4]],
    ])
    expect(doneSignals(list).map((s) => s.month)).toEqual([5, 3])
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
