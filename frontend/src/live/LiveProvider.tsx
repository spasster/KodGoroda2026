// Одно соединение с /api/events на всё приложение. События обновляют данные
// react-query, новые анкеты копятся в очереди уведомлений.

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { invalidateAfterResponse, invalidateAfterReview } from '../api/queries'
import { connectLive, type LiveStatus } from './connection'
import { LiveContext, type LiveNotification, type LiveState } from './useLive'

const MAX_NOTIFICATIONS = 20

export function LiveProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>('reconnecting')
  const [notifications, setNotifications] = useState<LiveNotification[]>([])
  const nextId = useRef(1)

  useEffect(
    () =>
      connectLive({
        onStatus: setStatus,
        onOpen: (reconnected) => {
          if (reconnected) void qc.invalidateQueries()
        },
        onResponse: (event) => {
          invalidateAfterResponse(qc, event.pair_id)
          const item: LiveNotification = { ...event, id: nextId.current++, at: new Date().toISOString() }
          setNotifications((list) => [item, ...list].slice(0, MAX_NOTIFICATIONS))
        },
        onReview: (event) => invalidateAfterReview(qc, event.key),
        onReset: () => {
          void qc.invalidateQueries()
          setNotifications([])
        },
      }),
    [qc],
  )

  const dismiss = useCallback((id: number) => setNotifications((list) => list.filter((n) => n.id !== id)), [])
  const clear = useCallback(() => setNotifications([]), [])

  const value = useMemo<LiveState>(
    () => ({ status, notifications, dismiss, clear }),
    [status, notifications, dismiss, clear],
  )
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}
