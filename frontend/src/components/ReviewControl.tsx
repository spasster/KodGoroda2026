// Отметка HR: «Подтвердилось» и «Ложная тревога» одного веса, без брендовой
// заливки, чтобы интерфейс никуда не подталкивал. После отметки плашка с датой,
// для «Подтвердилось» ещё заметка; «Снять отметку» возвращает сигнал в очередь.

import clsx from 'clsx'
import { Check, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'

import { ApiError } from '../api/client'
import { useReview, useThresholds } from '../api/queries'
import type { ReviewStatus, Signal } from '../api/types'
import { formatDayTime, windowWord } from '../lib/format'
import { useReduced, variants } from '../lib/motion'
import { Button } from './Button'
import s from './Signal.module.css'

const NETWORK_ERROR = 'Отметка не сохранилась: сервер не ответил. Нажмите ещё раз.'

function errorText(e: unknown): string {
  return e instanceof ApiError && e.status >= 400 && e.status < 500 ? e.message : NETWORK_ERROR
}

export interface ReviewControlProps {
  signal: Signal
  // Ключи повторов того же условия: отметка и её снятие уйдут и на них.
  alsoKeys?: readonly string[]
  className?: string
}

export function ReviewControl({ signal, alsoKeys = [], className }: ReviewControlProps) {
  const review = useReview()
  const reduce = useReduced()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = signal.review.status
  const th = useThresholds()

  // Плашка проявляется снизу, только если отметку поставили на глазах.
  const prev = useRef(status)
  const animateIn = prev.current !== status && !reduce
  useEffect(() => {
    prev.current = status
  })

  const send = async (next: ReviewStatus) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await Promise.all([signal.key, ...alsoKeys].map((key) => review.mutateAsync({ key, status: next })))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (status === 'open') {
    return (
      <div className={className}>
        <div className={s.actions}>
          <Button busy={busy} onClick={() => void send('confirmed')}>
            <Check aria-hidden="true" strokeWidth={1.8} />
            Подтвердилось
          </Button>
          <Button busy={busy} onClick={() => void send('rejected')}>
            <X aria-hidden="true" strokeWidth={1.8} />
            Ложная тревога
          </Button>
          <span className={s.hint}>
            Любая отметка уберёт сигнал из очереди. Ложная тревога ещё и перестанет влиять на статус пары. Отметку
            можно снять.
          </span>
        </div>
        {error && (
          <p role="alert" className={s.error}>
            {error}
          </p>
        )}
      </div>
    )
  }

  const confirmed = status === 'confirmed'
  const at = signal.review.updated_at
  return (
    <motion.div
      key={status}
      className={clsx(s.reviewed, className)}
      variants={variants.swap}
      initial={animateIn ? 'hidden' : false}
      animate="shown"
    >
      {confirmed ? <Check aria-hidden="true" strokeWidth={1.8} /> : <X aria-hidden="true" strokeWidth={1.8} />}
      <div className={s['reviewed-main']}>
        <b>{confirmed ? 'Подтвердилось' : 'Ложная тревога'}</b>
        {at ? `, ${formatDayTime(at)}.` : '.'}
        <p>
          {confirmed
            ? `Сигнал ушёл из очереди, но держит статус пары, пока ему меньше ${windowWord(th.active_months)}.`
            : 'Сигнал убран из очереди и на статус пары не влияет.'}
        </p>
        {confirmed && <NoteField signal={signal} onError={setError} />}
        {error && (
          <p role="alert" className={s.error}>
            {error}
          </p>
        )}
      </div>
      <Button variant="quiet" busy={busy} onClick={() => void send('open')}>
        Снять отметку
      </Button>
    </motion.div>
  )
}

// Заметка для себя: сохраняется по потере фокуса, только у этого сигнала.
function NoteField({ signal, onError }: { signal: Signal; onError: (text: string | null) => void }) {
  const review = useReview()
  const id = useId()
  const saved = signal.review.note ?? ''
  const [draft, setDraft] = useState(saved)

  // Заметку поменяли в другой вкладке или откатили после ошибки.
  useEffect(() => setDraft(saved), [saved])

  const save = () => {
    if (draft.trim() === saved.trim()) return
    onError(null)
    review.mutate(
      { key: signal.key, status: 'confirmed', note: draft },
      { onError: (e) => onError(errorText(e)) },
    )
  }

  return (
    <>
      <label htmlFor={id} className="sr-only">
        Заметка для себя: о чём договорились
      </label>
      <textarea
        id={id}
        className={s.note}
        value={draft}
        placeholder="Заметка для себя: о чём договорились"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        rows={2}
      />
    </>
  )
}
