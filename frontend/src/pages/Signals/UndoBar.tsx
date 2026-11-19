// Плашка «Подтвердилось: 2 сигнала пары P-05. Отменить» в правом нижнем углу.
// Держится 6 секунд, пока курсор не над ней и фокус не внутри. «Отменить» шлёт
// status: open на те же ключи; ошибка оставляет плашку с понятным текстом.
// Уведомления о новых анкетах стоят слева внизу, поэтому эта справа.

import { Check, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

import { ApiError } from '../../api/client'
import { pairIdFromSignalKey, useReview } from '../../api/queries'
import { Button } from '../../components'
import { formatCount, WORDS } from '../../lib/format'
import { useReduced, variants } from '../../lib/motion'
import s from './Signals.module.css'
import type { UndoBatch } from './useUndo'

const HOLD_MS = 6000
const NETWORK_ERROR = 'Отметка не снялась: сервер не ответил. Нажмите ещё раз.'

const LABEL = { confirmed: 'Подтвердилось', rejected: 'Ложная тревога' } as const

// «2 сигнала пары P-05», «1 сигнал».
function what(keys: readonly string[]): string {
  const pairs = [...new Set(keys.map(pairIdFromSignalKey))]
  const count = formatCount(keys.length, WORDS.signal)
  return pairs.length === 1 && pairs[0] ? `${count} пары ${pairs[0]}` : count
}

export function UndoBar({
  batch,
  // Отметку уже сняли другим путём («Снять отметку» в самом сигнале): плашка не нужна.
  stale,
  onClose,
}: {
  batch: UndoBatch | null
  stale: boolean
  onClose: () => void
}) {
  const reduce = useReduced()
  const review = useReview()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hold, setHold] = useState(false)

  // Новое решение: всё с начала.
  const id = batch?.id
  useEffect(() => {
    setBusy(false)
    setError(null)
    setHold(false)
  }, [id])

  // Пока идёт отмена, отметка на экране уже снята: плашку не прячем, ждём ответа.
  const shown = batch != null && (!stale || busy || error != null)

  useEffect(() => {
    if (!shown || hold || busy) return
    const t = window.setTimeout(onClose, error ? HOLD_MS * 2 : HOLD_MS)
    return () => window.clearTimeout(t)
  }, [shown, hold, busy, error, onClose, id])

  const undo = async () => {
    if (!batch || busy) return
    setBusy(true)
    setError(null)
    try {
      await Promise.all(batch.keys.map((key) => review.mutateAsync({ key, status: 'open' })))
      setBusy(false)
      onClose()
    } catch (e) {
      setError(e instanceof ApiError && e.status >= 400 && e.status < 500 ? e.message : NETWORK_ERROR)
      setBusy(false)
    }
  }

  return (
    <div className={s.undoDock} aria-live="polite">
      <AnimatePresence initial={false}>
        {shown && (
          <motion.div
            key={batch.id}
            role="status"
            className={s.undo}
            variants={variants.toast}
            initial={reduce ? false : 'hidden'}
            animate="shown"
            exit={reduce ? undefined : 'gone'}
            onMouseEnter={() => setHold(true)}
            onMouseLeave={() => setHold(false)}
            onFocus={() => setHold(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false)
            }}
          >
            {batch.status === 'confirmed' ? (
              <Check aria-hidden="true" strokeWidth={1.8} className={s.undoIcon} />
            ) : (
              <X aria-hidden="true" strokeWidth={1.8} className={s.undoIcon} />
            )}
            <p className={s.undoText}>
              {error ?? (
                <>
                  <b>{LABEL[batch.status]}:</b> {what(batch.keys)}.
                </>
              )}
            </p>
            <Button size="s" busy={busy} onClick={() => void undo()}>
              Отменить
            </Button>
            <button type="button" className={s.undoClose} aria-label="Скрыть" onClick={onClose}>
              <X aria-hidden="true" strokeWidth={1.8} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
