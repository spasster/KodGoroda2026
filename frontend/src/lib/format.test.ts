import { describe, expect, it } from 'vitest'

import {
  formatClock,
  formatCount,
  monthsPhrase,
  formatDayTime,
  formatDelta,
  formatNumber,
  formatRelative,
  monthLabel,
  monthOrdinal,
  plural,
  sourceLabel,
  WORDS,
} from './format'

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

describe('formatDelta', () => {
  it('ставит знак', () => {
    expect(formatDelta(1.75)).toBe('+1,8')
    expect(formatDelta(-0.5)).toBe('−0,5')
    expect(formatDelta(0)).toBe('0,0')
    expect(formatDelta(null)).toBe('—')
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

describe('monthLabel', () => {
  it('месяц с номером', () => {
    expect(monthLabel(3)).toBe('месяц 3')
    expect(monthOrdinal(5)).toBe('5-й месяц')
  })
})

describe('время и источник', () => {
  it('часы и дата отметки', () => {
    expect(formatClock(new Date(2026, 10, 26, 9, 5))).toBe('09:05')
    expect(formatDayTime(new Date(2026, 10, 26, 14, 5))).toBe('26 ноября в 14:05')
    expect(formatClock('не дата')).toBe('—')
  })

  it('источник словами', () => {
    expect(sourceLabel('form')).toBe('через форму')
    expect(sourceLabel('excel')).toBe('из Excel')
    expect(sourceLabel('tabs')).toBe('tabs')
  })
})

describe('formatRelative', () => {
  // Местное время, чтобы тест не зависел от часового пояса.
  const now = new Date(2026, 10, 19, 15, 0, 0)
  const ago = (ms: number) => new Date(now.getTime() - ms)
  const MIN = 60_000
  const HOUR = 60 * MIN

  it('секунды и будущее', () => {
    expect(formatRelative(ago(10_000), now)).toBe('только что')
    expect(formatRelative(ago(-5_000), now)).toBe('только что')
  })

  it('минуты в винительном падеже', () => {
    expect(formatRelative(ago(MIN), now)).toBe('1 минуту назад')
    expect(formatRelative(ago(2 * MIN), now)).toBe('2 минуты назад')
    expect(formatRelative(ago(5 * MIN), now)).toBe('5 минут назад')
    expect(formatRelative(ago(21 * MIN), now)).toBe('21 минуту назад')
    expect(formatRelative(ago(59 * MIN), now)).toBe('59 минут назад')
  })

  it('часы', () => {
    expect(formatRelative(ago(HOUR), now)).toBe('1 час назад')
    expect(formatRelative(ago(3 * HOUR), now)).toBe('3 часа назад')
    expect(formatRelative(ago(11 * HOUR), now)).toBe('11 часов назад')
  })

  it('дни и дата', () => {
    expect(formatRelative(new Date(2026, 10, 18, 9, 0), now)).toBe('вчера')
    expect(formatRelative(new Date(2026, 10, 16, 9, 0), now)).toBe('3 дня назад')
    expect(formatRelative(new Date(2026, 10, 14, 9, 0), now)).toBe('5 дней назад')
    expect(formatRelative(new Date(2026, 10, 9, 9, 0), now)).toBe('9 ноября')
    expect(formatRelative(new Date(2025, 5, 30, 9, 0), now)).toBe('30 июня 2025 г.')
  })

  it('строка ISO и мусор', () => {
    expect(formatRelative(ago(2 * MIN).toISOString(), now)).toBe('2 минуты назад')
    expect(formatRelative('не дата', now)).toBe('—')
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
