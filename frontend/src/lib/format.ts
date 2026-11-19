// Числа, склонения, время и подписи для интерфейса на русском.
// Подписи взяты из словаря docs/design/system.md.

import type { PairStatus, ReviewStatus, Role, Severity, SignalType } from '../api/types'

// Пустое значение: нет анкеты, нет индекса.
export const EMPTY = '—'

// Минус в интерфейсе: U+2212, а не дефис (system.md, «Типографика»).
export const MINUS = '−'

const numberFormats = new Map<string, Intl.NumberFormat>()

function numberFormat(digits: number, signDisplay: 'negative' | 'exceptZero'): Intl.NumberFormat {
  const id = `${digits}:${signDisplay}`
  let nf = numberFormats.get(id)
  if (!nf) {
    nf = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay })
    numberFormats.set(id, nf)
  }
  return nf
}

// 4.6 → «4,6», 4 → «4,0», -0.5 → «−0,5», null → «—».
export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return EMPTY
  return numberFormat(digits, 'negative').format(value).replace('-', MINUS)
}

// Изменение со знаком: 1.75 → «+1,8», -0.5 → «−0,5», 0 → «0,0».
export function formatDelta(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return EMPTY
  return numberFormat(digits, 'exceptZero').format(value).replace('-', MINUS)
}

// Формы слова для 1, 2 и 5.
export type Forms = readonly [one: string, few: string, many: string]

export const WORDS = {
  pair: ['пара', 'пары', 'пар'],
  signal: ['сигнал', 'сигнала', 'сигналов'],
  response: ['анкета', 'анкеты', 'анкет'],
  month: ['месяц', 'месяца', 'месяцев'],
} as const satisfies Record<string, Forms>

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

// «месяц 3».
export function monthLabel(month: number): string {
  return `месяц ${month}`
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

// Окно активных сигналов (active_months из signals.json) словами.
// «старше двух месяцев».
export function windowWord(months: number): string {
  const word: Record<number, string> = { 1: 'месяца', 2: 'двух месяцев', 3: 'трёх месяцев', 4: 'четырёх месяцев' }
  return word[months] ?? `${months} месяцев`
}

// «за последние два месяца», «за последний месяц».
export function recentWindow(months: number): string {
  if (months === 1) return 'за последний месяц'
  const word: Record<number, string> = { 2: 'два месяца', 3: 'три месяца', 4: 'четыре месяца' }
  return `за последние ${word[months] ?? formatCount(months, WORDS.month)}`
}

// «5-й месяц». Для «за 6-й месяц», «в 5-м месяце» допишите слово сами.
export function monthOrdinal(month: number): string {
  return `${month}-й месяц`
}

const AGO_MINUTES: Forms = ['минуту', 'минуты', 'минут']
const AGO_HOURS: Forms = ['час', 'часа', 'часов']
const AGO_DAYS: Forms = ['день', 'дня', 'дней']
const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const dayMonthYear = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const clock = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

function toDate(at: string | Date | number): Date {
  return at instanceof Date ? at : new Date(at)
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// «только что», «2 минуты назад», «3 часа назад», «вчера», «4 дня назад», «12 ноября».
export function formatRelative(at: string | Date, now: Date = new Date()): string {
  const date = toDate(at)
  if (Number.isNaN(date.getTime())) return EMPTY
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'только что'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${formatCount(minutes, AGO_MINUTES)} назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${formatCount(hours, AGO_HOURS)} назад`
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (days === 1) return 'вчера'
  if (days < 7) return `${formatCount(days, AGO_DAYS)} назад`
  return (date.getFullYear() === now.getFullYear() ? dayMonth : dayMonthYear).format(date)
}

// Время по местным часам: «14:02». Принимает ISO, Date или миллисекунды.
export function formatClock(at: string | Date | number): string {
  const date = toDate(at)
  return Number.isNaN(date.getTime()) ? EMPTY : clock.format(date)
}

// Когда HR поставил отметку: «26 ноября в 14:05».
export function formatDayTime(at: string | Date | number): string {
  const date = toDate(at)
  if (Number.isNaN(date.getTime())) return EMPTY
  return `${dayMonth.format(date)} в ${clock.format(date)}`
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

export const SIGNAL_TYPE_LABEL: Record<SignalType, string> = {
  decline: 'Спад',
  gap_intern_low: 'Разрыв',
  gap_mentor_low: 'Наставник недоволен',
  text_vs_score: 'Текст против оценки',
  silence: 'Молчание',
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
  ok: 'Спокойно',
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  open: 'не разобран',
  confirmed: 'подтвердилось',
  rejected: 'ложная тревога',
}

// Темы разбора текста из docs/contract.md, подписи меток из system.md.
export const TOPIC_LABEL: Record<string, string> = {
  tasks_shortage: 'мало задач',
  overload: 'перегрузка',
  mentor: 'наставник',
  clarity: 'понятность задач',
  motivation: 'мотивация',
  team: 'команда',
  growth: 'рост',
  positive: 'хорошее',
}

// Откуда пришла анкета, продолжение фразы: «анкета за 6-й месяц, через форму».
const SOURCE_LABEL: Record<string, string> = {
  excel: 'из Excel',
  form: 'через форму',
  yandex: 'из Яндекс Форм',
  gsheet: 'из Google Таблиц',
}

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source
}
