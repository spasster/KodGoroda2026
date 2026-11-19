import { createContext, useContext } from 'react'

import type { ResponseEvent } from '../api/types'
import type { LiveStatus } from './connection'

// Уведомление о новой анкете: кто прислал, пара, месяц, ключи новых сигналов.
// Текст сигнала берётся из useSignals или usePair по ключу.
export interface LiveNotification extends ResponseEvent {
  id: number
  // Когда событие дошло до браузера, ISO.
  at: string
}

export interface LiveState {
  status: LiveStatus
  // Свежие сверху.
  notifications: LiveNotification[]
  dismiss: (id: number) => void
  clear: () => void
}

export const LiveContext = createContext<LiveState | null>(null)

export function useLive(): LiveState {
  const state = useContext(LiveContext)
  if (!state) throw new Error('useLive работает только внутри LiveProvider')
  return state
}
