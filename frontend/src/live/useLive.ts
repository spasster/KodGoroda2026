import { createContext, useContext } from 'react'

import type { PairStatus, ResponseEvent, Role } from '../api/types'
import type { LiveStatus } from './connection'

// Уведомление о новой анкете: кто прислал, пара, месяц, ключи новых сигналов.
// Текст сигнала берётся из usePair по ключу.
export interface LiveNotification extends ResponseEvent {
  id: number
  // Когда событие дошло до браузера, ISO.
  at: string
  // Статус пары до этой анкеты, из кэша обзора. null, если обзор ещё не загружен.
  before: PairStatus | null
}

export interface LiveState {
  status: LiveStatus
  // Уведомления в углу, свежие сверху, не больше трёх.
  notifications: LiveNotification[]
  dismiss: (id: number) => void
  clear: () => void
  // Последняя пришедшая анкета для строки в шапке. Скрытие уведомления её не трогает.
  last: LiveNotification | null
  // Метка «новое»: анкеты, пришедшие при открытой странице. Держится, пока HR не
  // откроет карточку пары. Оболочка снимает её сама при переходе на /pairs/:id.
  isFreshCell: (pairId: string, month: number) => boolean
  isFreshResponse: (pairId: string, role: Role, month: number) => boolean
  markPairSeen: (pairId: string) => void
}

export const LiveContext = createContext<LiveState | null>(null)

export function useLive(): LiveState {
  const state = useContext(LiveContext)
  if (!state) throw new Error('useLive работает только внутри LiveProvider')
  return state
}
