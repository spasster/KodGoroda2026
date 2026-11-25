// Точка связи в шапке: зелёная — онлайн, жёлтая — переподключаемся, серая — нет
// связи. При наведении подсказка со временем последнего обновления. Новая анкета
// пускает от точки одно кольцо.

import clsx from 'clsx'
import { useEffect, useState } from 'react'

import { formatClock } from '../lib/format'
import { useReduced } from '../lib/motion'
import type { LiveStatus } from '../live/connection'
import { useLive } from '../live/useLive'
import s from './AppShell.module.css'

const WORD: Partial<Record<LiveStatus, string>> = {
  connecting: 'подключаемся',
  reconnecting: 'подключаемся',
  offline: 'нет связи',
}

// updatedAt: когда данные на экране последний раз пришли с сервера, мс. 0, если не приходили.
export function LiveIndicator({ updatedAt }: { updatedAt: number }) {
  const { status, last } = useLive()
  const reduce = useReduced()
  const [ping, setPing] = useState(0)

  const lastId = last?.id
  useEffect(() => {
    if (lastId != null && !reduce) setPing((n) => n + 1)
  }, [lastId, reduce])

  const time = updatedAt > 0 ? formatClock(updatedAt) : null
  const hint =
    status === 'connected'
      ? time && `Обновлено в ${time}`
      : status === 'offline'
        ? `Сервер не отвечает${time ? `, данные от ${time}` : ''}`
        : `Переподключаемся${time ? `, данные от ${time}` : ''}`

  return (
    <div className={s.live} tabIndex={0} aria-live="polite" title={status === 'connected' ? 'Онлайн' : undefined}>
      <span className={clsx(s.lamp, s[status])} aria-hidden="true">
        {ping > 0 && <span key={ping} className={s.ring} />}
      </span>
      {status !== 'connected' && <span className={s.liveWord}>{WORD[status]}</span>}
      {hint && (
        <span className={s.hint} role="tooltip">
          {hint}
        </span>
      )}
    </div>
  )
}
