// Лампа связи и строка событий в шапке. Пинг: кольцо расходится от точки при
// новой анкете и раз в 15 секунд, пока связь есть. EventSource не отдаёт
// комментарии «: ping» из SSE, поэтому такт держит таймер.

import clsx from 'clsx'
import { useEffect, useState } from 'react'

import { formatClock } from '../lib/format'
import { useReduced } from '../lib/motion'
import { useLive } from '../live/useLive'
import s from './AppShell.module.css'

const PING_MS = 15_000
// Сколько держится «Только что анкета S-01 за 6-й месяц».
const JUST_NOW_MS = 60_000

// updatedAt: когда данные на экране последний раз пришли с сервера, мс. 0, если не приходили.
export function LiveIndicator({ updatedAt }: { updatedAt: number }) {
  const { status, last } = useLive()
  const reduce = useReduced()
  const [ping, setPing] = useState(0)
  const [, setTick] = useState(0)

  const connected = status === 'connected'

  useEffect(() => {
    if (!connected || reduce) return
    const t = window.setInterval(() => setPing((n) => n + 1), PING_MS)
    return () => window.clearInterval(t)
  }, [connected, reduce])

  // Пришла анкета: вспышка и строка «Только что…» на минуту.
  const lastId = last?.id
  const lastAt = last ? Date.parse(last.at) : 0
  useEffect(() => {
    if (lastId == null) return
    if (!reduce) setPing((n) => n + 1)
    const left = lastAt + JUST_NOW_MS - Date.now()
    if (left <= 0) return
    const t = window.setTimeout(() => setTick((n) => n + 1), left + 50)
    return () => window.clearTimeout(t)
  }, [lastId, lastAt, reduce])

  const justNow = last != null && Date.now() - lastAt < JUST_NOW_MS
  const time = updatedAt > 0 ? formatClock(updatedAt) : null

  let text
  if (connected && justNow) {
    text = (
      <>
        <b>Только что</b> анкета {last.person_id} за {last.month}-й месяц
      </>
    )
  } else if (connected) {
    text = (
      <>
        <b>На связи.</b>
        {time && ` Обновлено в ${time}`}
      </>
    )
  } else if (status === 'connecting') {
    text = <b>Подключаемся…</b>
  } else {
    text = (
      <>
        {/* Время первым: если строка не влезет, обрежется конец фразы, а не время. */}
        <b>Нет связи.</b>
        {time ? ` Данные от ${time}, переподключаемся` : ' Переподключаемся'}
      </>
    )
  }

  return (
    <div className={s.live} aria-live="polite">
      <span className={clsx(s.lamp, !connected && s.off)} aria-hidden="true">
        {connected && ping > 0 && <span key={ping} className={s.ring} />}
      </span>
      <span className={s['live-text']}>{text}</span>
    </div>
  )
}
