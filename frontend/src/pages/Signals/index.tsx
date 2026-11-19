// Экран «Сигналы» (/signals): одна строка на сигнал, раскрытие на месте,
// один фильтр-сегмент, отмена отметки. Вид и тексты: docs/design/v2.md.

import { useQueries } from '@tanstack/react-query'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../../api/client'
import { queryKeys, useOverview, useReview, useSignals } from '../../api/queries'
import type { PairDetail, ReviewStatus } from '../../api/types'
import { personName } from '../../lib/format'
import { dur, ease, useReduced } from '../../lib/motion'
import { useLive } from '../../live/useLive'
import { segmentRows, type Segment } from './model'
import { SignalRow } from './SignalRow'
import s from './Signals.module.css'

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'open', label: 'Открытые' },
  { value: 'done', label: 'Разобранные' },
  { value: 'all', label: 'Все' },
]

const EMPTY: Record<Segment, string> = {
  open: 'Все сигналы разобраны',
  done: 'Разобранных пока нет',
  all: 'Сигналов нет',
}

const UNDO_MS = 5000

interface Notice {
  id: number
  key: string
  text: string
  undo: boolean
}

export function SignalsPage() {
  const reduce = useReduced()
  const [segment, setSegment] = useState<Segment>('open')
  const [openId, setOpenId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const noticeId = useRef(0)

  const signals = useSignals({ status: 'all' })
  const overview = useOverview()
  const review = useReview()
  const { isFreshCell } = useLive()
  const all = signals.data

  const rows = useMemo(
    () => ({
      open: all ? segmentRows(all, 'open') : [],
      done: all ? segmentRows(all, 'done') : [],
      all: all ? segmentRows(all, 'all') : [],
    }),
    [all],
  )
  const list = rows[segment]

  const names = useMemo(
    () => new Map((overview.data?.pairs ?? []).map((p) => [p.pair_id, personName(p.intern_name, p.intern_id)])),
    [overview.data],
  )

  // Карточки пар нужны для цитаты целиком: комментарий с подсвеченным местом.
  const pairIds = useMemo(() => [...new Set((all ?? []).map((x) => x.pair_id))].sort(), [all])
  const pairQueries = useQueries({
    queries: pairIds.map((id) => ({ queryKey: queryKeys.pair(id), queryFn: () => api.pair(id) })),
  })
  const details = new Map<string, PairDetail | undefined>(pairIds.map((id, i) => [id, pairQueries[i]?.data]))

  const say = (n: Omit<Notice, 'id'>) => setNotice({ ...n, id: ++noticeId.current })

  const mark = async (key: string, status: ReviewStatus) => {
    if (status !== 'open') setNotice(null)
    try {
      await review.mutateAsync({ key, status })
      if (status !== 'open') say({ key, text: 'Отмечено', undo: true })
    } catch {
      say({ key, text: 'Отметка не сохранилась', undo: false })
    }
  }

  const undo = async (n: Notice) => {
    setNotice(null)
    try {
      await review.mutateAsync({ key: n.key, status: 'open' })
    } catch {
      say({ key: n.key, text: 'Не получилось отменить', undo: false })
    }
  }

  let body
  if (!all && signals.isError) {
    body = (
      <div className={s.empty}>
        <p className={s.emptyText}>Не удалось загрузить сигналы</p>
        <button type="button" className={clsx(s.btn, s.secondary)} onClick={() => void signals.refetch()}>
          Повторить
        </button>
      </div>
    )
  } else if (!all) {
    body = <Skeleton />
  } else {
    body = (
      <>
        <ul className={s.list}>
          <AnimatePresence initial={false}>
            {list.map((x) => (
              <SignalRow
                key={x.key}
                signal={x}
                name={names.get(x.pair_id) ?? personName(null, x.pair_id)}
                detail={details.get(x.pair_id)}
                open={openId === x.key}
                fresh={isFreshCell(x.pair_id, x.month)}
                reduce={reduce}
                onToggle={() => setOpenId((id) => (id === x.key ? null : x.key))}
                onMark={(status) => void mark(x.key, status)}
              />
            ))}
          </AnimatePresence>
        </ul>
        <AnimatePresence initial={false}>
          {list.length === 0 && (
            <motion.div
              key={segment}
              className={s.empty}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: dur.m, ease: ease.out, delay: reduce ? 0 : dur.s } }}
            >
              <p className={s.emptyText}>{all.length === 0 ? EMPTY.all : EMPTY[segment]}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <div className={clsx('wrap', s.page)}>
      <div className={s.head}>
        <h1 className={s.h1}>Сигналы</h1>
        <div className={s.segments} role="group" aria-label="Какие сигналы показать">
          {SEGMENTS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={s.segment}
              aria-pressed={segment === o.value}
              onClick={() => setSegment(o.value)}
            >
              {o.label}
              {all && <span className={s.count}>{rows[o.value].length}</span>}
            </button>
          ))}
        </div>
      </div>
      <motion.div
        className={s.card}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur.m, ease: ease.out }}
      >
        {body}
      </motion.div>
      <UndoBar notice={notice} reduce={reduce} onUndo={(n) => void undo(n)} onClose={() => setNotice(null)} />
    </div>
  )
}

// Плашка внизу по центру: «Отмечено · Отменить». Держится 5 секунд, пока
// курсор не над ней и фокус не внутри.
function UndoBar({
  notice,
  reduce,
  onUndo,
  onClose,
}: {
  notice: Notice | null
  reduce: boolean
  onUndo: (n: Notice) => void
  onClose: () => void
}) {
  const [hold, setHold] = useState(false)
  const id = notice?.id
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (id == null || hold) return
    const t = window.setTimeout(() => close.current(), UNDO_MS)
    return () => window.clearTimeout(t)
  }, [id, hold])

  useEffect(() => setHold(false), [id])

  return (
    <div className={s.dock} aria-live="polite">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            role="status"
            className={s.undo}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.m, ease: ease.out } }}
            exit={reduce ? undefined : { opacity: 0, y: 8, transition: { duration: dur.s, ease: ease.out } }}
            onMouseEnter={() => setHold(true)}
            onMouseLeave={() => setHold(false)}
            onFocus={() => setHold(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false)
            }}
          >
            <span>{notice.text}</span>
            {notice.undo && (
              <button type="button" className={s.undoBtn} onClick={() => onUndo(notice)}>
                Отменить
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Skeleton() {
  return (
    <ul className={s.list} aria-busy="true" aria-label="Загружаем сигналы">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className={s.item}>
          <div className={s.skelRow}>
            <span className={s.skel} style={{ width: 10, height: 10, borderRadius: '50%' }} />
            <span className={s.skel} style={{ width: 120 }} />
            <span className={s.skel} style={{ width: `${46 - i * 4}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
