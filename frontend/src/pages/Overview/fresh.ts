// Метка «новое» и кольцо бренда у анкет, пришедших при открытом дашборде.
// Держится, пока HR не откроет карточку пары. useLive() помнит такие анкеты до
// перезагрузки страницы, здесь их копия в localStorage, чтобы метка пережила
// перезагрузку. Снимаем по переходу на /pairs/:id любым путём: из таблицы,
// из уведомления, с экрана сигналов.

import { useSyncExternalStore } from 'react'

import type { Role } from '../../api/types'

const STORAGE_KEY = 'sverka.fresh'

// key: `${pair_id}:${role}:${month}`; at: когда анкета пришла, мс.
export interface FreshEntry {
  key: string
  at: number
}

export const freshKey = (pairId: string, role: Role, month: number) => `${pairId}:${role}:${month}`

function load(): FreshEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list.filter(
      (e): e is FreshEntry => !!e && typeof e === 'object' && typeof e.key === 'string' && typeof e.at === 'number',
    )
  } catch {
    return []
  }
}

let entries: FreshEntry[] = load()
const listeners = new Set<() => void>()

function commit(next: FreshEntry[]) {
  entries = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Хранилище закрыто (приватное окно): метка проживёт до перезагрузки.
  }
  listeners.forEach((l) => l())
}

export function addFresh(items: FreshEntry[]) {
  const add = items.filter((item) => !entries.some((e) => e.key === item.key))
  if (add.length) commit([...entries, ...add])
}

export function clearFreshPair(pairId: string) {
  const prefix = `${pairId}:`
  if (entries.some((e) => e.key.startsWith(prefix))) commit(entries.filter((e) => !e.key.startsWith(prefix)))
}

// Убираем метки анкет, которых в данных уже нет (база сброшена). Только если
// данные пришли позже метки: иначе это просто ещё не перезапрошенный обзор.
export function pruneFresh(exists: (key: string) => boolean, dataAt: number) {
  const next = entries.filter((e) => e.at >= dataAt || exists(e.key))
  if (next.length !== entries.length) commit(next)
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useFreshEntries(): readonly FreshEntry[] {
  return useSyncExternalStore(subscribe, () => entries)
}

// Переходы слушаем у роутера: обзор в это время размонтирован. Импорт
// динамический, потому что router.tsx сам импортирует эту страницу.
function pairFromPath(pathname: string): string | null {
  const m = /^\/pairs\/([^/]+)/.exec(pathname)
  return m ? decodeURIComponent(m[1]).trim().toUpperCase() : null
}

void import('../../app/router')
  .then(({ router }) => {
    const check = (pathname: string) => {
      const id = pairFromPath(pathname)
      if (id) clearFreshPair(id)
    }
    check(router.state.location.pathname)
    router.subscribe((state) => check(state.location.pathname))
  })
  .catch(() => {})
