// Числа, склонения, время и подписи для интерфейса на русском.
// Подписи по docs/design/v2.md.

import type { PairStatus, Role, Severity } from '../api/types'

// Пустое значение: нет анкеты, нет индекса.
export const EMPTY = '—'

// Минус в интерфейсе: U+2212, а не дефис.
export const MINUS = '−'

const numberFormats = new Map<string, Intl.NumberFormat>()

function numberFormat(digits: number): Intl.NumberFormat {
  const id = String(digits)
  let nf = numberFormats.get(id)
  if (!nf) {
    nf = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: 'negative' })
    numberFormats.set(id, nf)
  }
  return nf
}

// 4.6 → «4,6», 4 → «4,0», -0.5 → «−0,5», null → «—».
export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return EMPTY
  return numberFormat(digits).format(value).replace('-', MINUS)
}

// Формы слова для 1, 2 и 5.
export type Forms = readonly [one: string, few: string, many: string]

// Дробные числа берут форму «2»: 1,5 месяца.
export function plural(n: number, forms: Forms): string {
  const abs = Math.abs(n)
  if (!Number.isInteger(abs)) return forms[1]
  const d10 = abs % 10
  const d100 = abs % 100
  if (d10 === 1 && d100 !== 11) return forms[0]
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return forms[1]
  return forms[2]
}

// 1 пара, 2 пары, 5 пар.
export function formatCount(n: number, forms: Forms): string {
  return `${n} ${plural(n, forms)}`
}

// Несколько месяцев, слово «месяц» во множественном числе: «3-й месяц»,
// «2–3-й месяцы», «2-й и 4-й месяцы», «1-й, 3-й и 4-й месяцы».
export function monthsPhrase(months: readonly number[]): string {
  const list = [...new Set(months)].sort((a, b) => a - b)
  if (list.length === 0) return ''
  if (list.length === 1) return `${list[0]}-й месяц`
  const first = list[0]
  const last = list[list.length - 1]
  if (last - first === list.length - 1) return `${first}–${last}-й месяцы`
  return `${list.slice(0, -1).map((m) => `${m}-й`).join(', ')} и ${last}-й месяцы`
}

const clock = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

function toDate(at: string | Date | number): Date {
  return at instanceof Date ? at : new Date(at)
}

// Время по местным часам: «14:02». Принимает ISO, Date или миллисекунды.
export function formatClock(at: string | Date | number): string {
  const date = toDate(at)
  return Number.isNaN(date.getTime()) ? EMPTY : clock.format(date)
}

export const ROLE_LABEL: Record<Role | 'both', string> = {
  intern: 'стажёр',
  mentor: 'наставник',
  both: 'стажёр и наставник',
}

// С заглавной, перед ID: «Стажёр S-03», «Наставник M-03».
export const ROLE_TITLE: Record<Role, string> = {
  intern: 'Стажёр',
  mentor: 'Наставник',
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'высокая',
  medium: 'средняя',
  low: 'низкая',
}

// Статус пары и клетки месяца.
export const PAIR_STATUS_LABEL: Record<PairStatus, string> = {
  risk: 'Пора поговорить',
  watch: 'Присмотреться',
  ok: 'Всё ровно',
}

/** Имя человека из справочника survey/people.json; если имени нет, показываем ID. */
export function personName(name: string | null | undefined, id: string): string {
  return name?.trim() ? name : id
}
