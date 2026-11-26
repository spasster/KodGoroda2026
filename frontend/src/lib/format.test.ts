import { describe, expect, it } from 'vitest'

import { formatClock, formatCount, formatNumber, monthsPhrase, PAIR_STATUS_LABEL, personName, plural, type Forms } from './format'

const WORDS = {
  pair: ['пара', 'пары', 'пар'],
  signal: ['сигнал', 'сигнала', 'сигналов'],
  response: ['анкета', 'анкеты', 'анкет'],
  month: ['месяц', 'месяца', 'месяцев'],
} as const satisfies Record<string, Forms>

describe('formatNumber', () => {
  it('пишет дробь через запятую с одним знаком', () => {
    expect(formatNumber(4.6)).toBe('4,6')
    expect(formatNumber(4)).toBe('4,0')
    expect(formatNumber(3.04)).toBe('3,0')
    expect(formatNumber(1.75, 2)).toBe('1,75')
    expect(formatNumber(2, 0)).toBe('2')
  })

  it('не пишет минус у нуля после округления', () => {
    expect(formatNumber(-0.5)).toBe('−0,5')
    expect(formatNumber(-0.04)).toBe('0,0')
  })

  it('пустое значение', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber(undefined)).toBe('—')
    expect(formatNumber(Number.NaN)).toBe('—')
  })
})

describe('plural', () => {
  const cases: [number, string][] = [
    [0, 'пар'], [1, 'пара'], [2, 'пары'], [4, 'пары'], [5, 'пар'], [11, 'пар'], [12, 'пар'], [14, 'пар'],
    [21, 'пара'], [22, 'пары'], [25, 'пар'], [101, 'пара'], [111, 'пар'], [112, 'пар'], [122, 'пары'],
  ]
  it.each(cases)('%i → %s', (n, word) => {
    expect(plural(n, WORDS.pair)).toBe(word)
  })

  it('дробные и отрицательные', () => {
    expect(plural(1.5, WORDS.month)).toBe('месяца')
    expect(plural(-1, WORDS.signal)).toBe('сигнал')
    expect(plural(-5, WORDS.signal)).toBe('сигналов')
  })
})

describe('formatCount', () => {
  it('пары, сигналы, анкеты, месяцы', () => {
    expect(formatCount(1, WORDS.pair)).toBe('1 пара')
    expect(formatCount(2, WORDS.pair)).toBe('2 пары')
    expect(formatCount(5, WORDS.pair)).toBe('5 пар')
    expect(formatCount(1, WORDS.signal)).toBe('1 сигнал')
    expect(formatCount(3, WORDS.signal)).toBe('3 сигнала')
    expect(formatCount(11, WORDS.signal)).toBe('11 сигналов')
    expect(formatCount(21, WORDS.response)).toBe('21 анкета')
    expect(formatCount(54, WORDS.response)).toBe('54 анкеты')
    expect(formatCount(0, WORDS.response)).toBe('0 анкет')
    expect(formatCount(6, WORDS.month)).toBe('6 месяцев')
    expect(formatCount(2, WORDS.month)).toBe('2 месяца')
  })
})

describe('monthsPhrase', () => {
  it('несколько месяцев во множественном числе', () => {
    expect(monthsPhrase([3])).toBe('3-й месяц')
    expect(monthsPhrase([3, 2])).toBe('2–3-й месяцы')
    expect(monthsPhrase([2, 4])).toBe('2-й и 4-й месяцы')
    expect(monthsPhrase([1, 3, 4])).toBe('1-й, 3-й и 4-й месяцы')
  })
})

describe('время', () => {
  it('часы по местному времени', () => {
    expect(formatClock(new Date(2026, 10, 26, 9, 5))).toBe('09:05')
    expect(formatClock('не дата')).toBe('—')
  })
})

describe('подписи v2', () => {
  it('статусы пары', () => {
    expect(PAIR_STATUS_LABEL).toEqual({ risk: 'Критичный сигнал', watch: 'Зона внимания', ok: 'Положительная оценка' })
  })

  it('имя или ID', () => {
    expect(personName('Илья Морозов', 'S-01')).toBe('Илья Морозов')
    expect(personName(null, 'S-01')).toBe('S-01')
    expect(personName('  ', 'S-01')).toBe('S-01')
  })
})
