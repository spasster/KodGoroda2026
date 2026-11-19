// Логика экрана «С кем поговорить» без React: фильтры из адреса, окно
// последних месяцев, счётчики сегментов, группы по парам и повторы.
// Правила: docs/design/system.md, разделы «Экран „С кем поговорить“» и
// «Правила, которые фронт считает сам».

import type { ReviewStatus, Severity, Signal } from '../../api/types'
import { clusterRepeats } from '../../lib/rules'

export type StatusFilter = ReviewStatus | 'all'
export type SeverityFilter = Severity | 'all'

export interface Filters {
  status: StatusFilter
  severity: SeverityFilter
  // «Только последние 2 месяца».
  recent: boolean
}

export const DEFAULT_FILTERS: Filters = { status: 'open', severity: 'all', recent: true }

const STATUSES: readonly StatusFilter[] = ['open', 'confirmed', 'rejected', 'all']
const SEVERITIES: readonly SeverityFilter[] = ['all', 'high', 'medium', 'low']

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value != null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

// ?status=confirmed&severity=high&period=all. Непонятное значение даёт умолчание.
export function readFilters(params: URLSearchParams): Filters {
  return {
    status: pick(params.get('status'), STATUSES, DEFAULT_FILTERS.status),
    severity: pick(params.get('severity'), SEVERITIES, DEFAULT_FILTERS.severity),
    recent: params.get('period') !== 'all',
  }
}

// В адрес пишем только то, что отличается от умолчания: /signals без хвоста и есть очередь.
export function writeFilters(f: Filters): URLSearchParams {
  const params = new URLSearchParams()
  if (f.status !== DEFAULT_FILTERS.status) params.set('status', f.status)
  if (f.severity !== DEFAULT_FILTERS.severity) params.set('severity', f.severity)
  if (!f.recent) params.set('period', 'all')
  return params
}

export function filtersKey(f: Filters): string {
  return `${f.status}|${f.severity}|${f.recent ? 'recent' : 'all'}`
}

// Фильтр сужен относительно умолчания: важность выбрана или окно выключено.
export function isNarrowed(f: Filters): boolean {
  return f.severity !== 'all' || !f.recent
}

// Сигнал в последних active_months месяцах своей пары. Для неотмеченных это то же,
// что signal.active с бэкенда, но ложная тревога тоже попадает в окно: иначе
// фильтр «Ложная тревога» с флажком всегда был бы пустым. Пары нет в обзоре
// (только что создана анкетой), значит верим бэкенду.
export function inWindow(s: Signal, lastMonth: ReadonlyMap<string, number>, activeMonths: number): boolean {
  const last = lastMonth.get(s.pair_id)
  if (last == null) return s.active
  return s.month > last - activeMonths
}

export interface SignalsView {
  // Счётчики сегментов «Открытые 12», «Высокая 5».
  statusCounts: Record<StatusFilter, number>
  severityCounts: Record<Severity, number>
  // Что видно после всех фильтров, вместе с отмеченными на глазах.
  list: Signal[]
  // Сколько подходит по отметке и окну без фильтра важности.
  byStatus: number
  // Открытых среди видимых: 0 при непустом списке значит «всё разобрано».
  openInList: number
}

// keep: сигналы, которые уже стояли в списке при этих фильтрах. Отмеченный на
// глазах сигнал остаётся на месте в свёрнутом виде, пока фильтр не сменится.
export function buildView(
  all: readonly Signal[],
  f: Filters,
  lastMonth: ReadonlyMap<string, number>,
  activeMonths: number,
  keep: ReadonlySet<string> = new Set(),
): SignalsView {
  const base = f.recent ? all.filter((s) => inWindow(s, lastMonth, activeMonths)) : [...all]
  const statusCounts: Record<StatusFilter, number> = { open: 0, confirmed: 0, rejected: 0, all: base.length }
  for (const s of base) statusCounts[s.review.status] += 1

  const byStatus = base.filter((s) => f.status === 'all' || s.review.status === f.status || keep.has(s.key))
  const severityCounts: Record<Severity, number> = { high: 0, medium: 0, low: 0 }
  for (const s of byStatus) severityCounts[s.severity] += 1

  const list = byStatus.filter((s) => f.severity === 'all' || s.severity === f.severity)
  return {
    statusCounts,
    severityCounts,
    list,
    byStatus: byStatus.length,
    openInList: list.filter((s) => s.review.status === 'open').length,
  }
}

// Сигнал на экране и его свёрнутые повторы.
export interface Item {
  signal: Signal
  repeats: Signal[]
}

// Повторы одного условия пары (тип и роль) сворачиваются в свежий сигнал, если у
// них та же отметка: одно решение на один разговор. Повтор с другой отметкой
// стоит отдельно, свежий первым.
export function itemsOf(signals: readonly Signal[]): Item[] {
  return clusterRepeats([...signals]).flatMap(({ head, repeats }) => {
    const parts = new Map<ReviewStatus, Signal[]>()
    for (const s of [head, ...repeats]) {
      const list = parts.get(s.review.status)
      if (list) list.push(s)
      else parts.set(s.review.status, [s])
    }
    return [...parts.values()].map(([signal, ...rest]) => ({ signal, repeats: rest }))
  })
}

// Порядок групп не прыгает под рукой: пары, что уже стоят на экране, остаются на
// своих местах, новые встают туда, куда их ставит приоритет.
export function stableOrder(prev: readonly string[], current: readonly string[]): string[] {
  const now = new Set(current)
  const out = prev.filter((id) => now.has(id))
  const placed = new Set(out)
  current.forEach((id, i) => {
    if (placed.has(id)) return
    const next = current.slice(i + 1).find((x) => placed.has(x))
    out.splice(next ? out.indexOf(next) : out.length, 0, id)
    placed.add(id)
  })
  return out
}
