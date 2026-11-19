// Числа, склонения, время и подписи для интерфейса на русском.

import type { PairStatus, ReviewStatus, Role, Severity, SignalType } from '../api/types'
import type { LiveStatus } from '../live/connection'

// Пустое значение: нет анкеты, нет индекса.
export const EMPTY = '—'

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

// 4.6 → «4,6», 4 → «4,0», null → «—».
export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return EMPTY
  return numberFormat(digits, 'negative').format(value)
}

// Изменение со знаком: 1.75 → «+1,8», -0.5 → «-0,5», 0 → «0,0».
export function formatDelta(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return EMPTY
  return numberFormat(digits, 'exceptZero').format(value)
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

const AGO_MINUTES: Forms = ['минуту', 'минуты', 'минут']
const AGO_HOURS: Forms = ['час', 'часа', 'часов']
const AGO_DAYS: Forms = ['день', 'дня', 'дней']
const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const dayMonthYear = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// «только что», «2 минуты назад», «3 часа назад», «вчера», «4 дня назад», «12 ноября».
export function formatRelative(at: string | Date, now: Date = new Date()): string {
  const date = typeof at === 'string' ? new Date(at) : at
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

export const ROLE_LABEL: Record<Role | 'both', string> = {
  intern: 'стажёр',
  mentor: 'наставник',
  both: 'стажёр и наставник',
}

export const SIGNAL_TYPE_LABEL: Record<SignalType, string> = {
  decline: 'Спад',
  gap_intern_low: 'Расхождение',
  gap_mentor_low: 'Наставник недоволен',
  text_vs_score: 'Текст против оценки',
  silence: 'Молчание',
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'высокая',
  medium: 'средняя',
  low: 'низкая',
}

export const PAIR_STATUS_LABEL: Record<PairStatus, string> = {
  risk: 'риск',
  watch: 'внимание',
  ok: 'норма',
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  open: 'не разобран',
  confirmed: 'подтвердилось',
  rejected: 'ложная тревога',
}

// Темы разбора текста из docs/contract.md.
export const TOPIC_LABEL: Record<string, string> = {
  tasks_shortage: 'нехватка задач',
  overload: 'перегрузка',
  mentor: 'отношения с наставником',
  clarity: 'непонятные задачи',
  motivation: 'мотивация и интерес',
  team: 'команда',
  growth: 'рост и обучение',
  positive: 'хорошее',
}

export const LIVE_STATUS_LABEL: Record<LiveStatus, string> = {
  connected: 'подключено',
  reconnecting: 'переподключаемся',
  offline: 'нет связи',
}

const SOURCE_LABEL: Record<string, string> = {
  excel: 'Excel',
  form: 'форма',
  yandex: 'Яндекс Формы',
  gsheet: 'Google Формы',
}

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source
}
