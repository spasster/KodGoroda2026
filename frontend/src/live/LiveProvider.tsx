// Одно соединение с /api/events на всё приложение. События обновляют данные
// react-query, новые анкеты копятся в очереди уведомлений.

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { invalidateAfterResponse, invalidateAfterReview, queryKeys } from '../api/queries'
import type { Overview, Role } from '../api/types'
import { connectLive, type LiveStatus } from './connection'
import { LiveContext, type LiveNotification, type LiveState } from './useLive'

// Стопка уведомлений в углу: до трёх, новое сверху.
const MAX_NOTIFICATIONS = 3

const freshKey = (pairId: string, role: Role, month: number) => `${pairId}:${role}:${month}`

export function LiveProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>('connecting')
  const [notifications, setNotifications] = useState<LiveNotification[]>([])
  const [last, setLast] = useState<LiveNotification | null>(null)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set())
  const nextId = useRef(1)

  useEffect(
    () =>
      connectLive({
        onStatus: setStatus,
        onOpen: (reconnected) => {
          if (reconnected) void qc.invalidateQueries()
        },
        onResponse: (event) => {
          // Статус до анкеты берём из кэша до того, как обзор перезапросится.
          const before = qc.getQueryData<Overview>(queryKeys.overview)?.pairs.find((p) => p.pair_id === event.pair_id)
          invalidateAfterResponse(qc)
          const item: LiveNotification = {
            ...event,
            id: nextId.current++,
            at: new Date().toISOString(),
            before: before?.status ?? null,
          }
          setNotifications((list) => [item, ...list].slice(0, MAX_NOTIFICATIONS))
          setLast(item)
          setFresh((set) => new Set(set).add(freshKey(event.pair_id, event.role, event.month)))
        },
        onReview: (event) => invalidateAfterReview(qc, event.key),
        onReset: () => {
          void qc.invalidateQueries()
          setNotifications([])
          setLast(null)
          setFresh(new Set())
        },
      }),
    [qc],
  )

  const dismiss = useCallback((id: number) => setNotifications((list) => list.filter((n) => n.id !== id)), [])
  const clear = useCallback(() => setNotifications([]), [])

  const isFreshResponse = useCallback(
    (pairId: string, role: Role, month: number) => fresh.has(freshKey(pairId, role, month)),
    [fresh],
  )
  const isFreshCell = useCallback(
    (pairId: string, month: number) => isFreshResponse(pairId, 'intern', month) || isFreshResponse(pairId, 'mentor', month),
    [isFreshResponse],
  )
  const markPairSeen = useCallback((pairId: string) => {
    setFresh((set) => {
      const prefix = `${pairId}:`
      if (![...set].some((k) => k.startsWith(prefix))) return set
      return new Set([...set].filter((k) => !k.startsWith(prefix)))
    })
  }, [])

  const value = useMemo<LiveState>(
    () => ({ status, notifications, dismiss, clear, last, isFreshCell, isFreshResponse, markPairSeen }),
    [status, notifications, dismiss, clear, last, isFreshCell, isFreshResponse, markPairSeen],
  )
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}
