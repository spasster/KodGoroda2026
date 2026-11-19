// Строка сигнала: точка важности, стажёр, заголовок, месяц. По клику
// раскрывается на месте: объяснение, цитата, что сделать, отметка.

import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { CommentItem, PairDetail, Quote, ReviewStatus, Signal } from '../../api/types'
import { ROLE_LABEL, SEVERITY_LABEL } from '../../lib/format'
import { dur, ease } from '../../lib/motion'
import s from './Signals.module.css'

export type Mark = Exclude<ReviewStatus, 'open'>

const MARK_LABEL: Record<Mark, string> = { confirmed: 'Подтвердилось', rejected: 'Ложная тревога' }

interface Props {
  signal: Signal
  name: string
  detail?: PairDetail
  open: boolean
  fresh: boolean
  reduce: boolean
  onToggle: () => void
  onMark: (status: ReviewStatus) => void
}

export function SignalRow({ signal: head, name, detail, open, fresh, reduce, onToggle, onMark }: Props) {
  const status = head.review.status
  const panelId = `signal-${head.key}`
  const t = reduce ? { duration: 0 } : { duration: dur.s, ease: ease.out }

  return (
    <motion.li
      className={s.item}
      initial={reduce ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={reduce ? undefined : { height: 0, opacity: 0 }}
      transition={reduce ? { duration: 0 } : { duration: dur.m, ease: ease.out }}
    >
      <button type="button" className={s.row} aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        {/* Цвет только у открытых: разобранные и старые не требуют внимания. */}
        <span className={clsx(s.dot, head.active && status === 'open' ? s[head.severity] : s.dotDone)} aria-hidden="true" />
        <span className="sr-only">Важность {SEVERITY_LABEL[head.severity]}.</span>
        <span className={s.name}>{name}</span>
        <span className={s.title}>{head.title}</span>
        <span className={s.meta}>
          {status !== 'open' ? (
            <span className={s.markLabel}>{MARK_LABEL[status]}</span>
          ) : (
            fresh && <span className={s.fresh}>новое</span>
          )}
          <span className={s.month}>{head.month} мес</span>
        </span>
        <ChevronRight className={s.chevron} aria-hidden="true" size={20} strokeWidth={1.8} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            className={s.panel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={t}
          >
            <div className={s.panelInner}>
              <p className={s.explain}>{head.explanation}</p>
              <Quotes quotes={head.quotes} comments={detail?.comments} />
              <p className={s.todo}>Что сделать: {head.action}</p>
              <div className={s.actions}>
                {status === 'open' ? (
                  <>
                    <button type="button" className={clsx(s.btn, s.secondary)} onClick={() => onMark('confirmed')}>
                      Подтвердилось
                    </button>
                    <button type="button" className={clsx(s.btn, s.secondary)} onClick={() => onMark('rejected')}>
                      Ложная тревога
                    </button>
                  </>
                ) : (
                  <button type="button" className={clsx(s.btn, s.secondary)} onClick={() => onMark('open')}>
                    Снять отметку
                  </button>
                )}
                <Link to={`/pairs/${head.pair_id}`} className={s.pairLink}>
                  Открыть пару
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

// Цитаты сигнала. Если карточка пары уже есть, показываем комментарий целиком
// и подсвечиваем найденные места; пока её нет, только сами фрагменты.
function Quotes({ quotes, comments }: { quotes: Quote[]; comments?: CommentItem[] }) {
  const groups = new Map<string, Quote[]>()
  for (const q of quotes) {
    const k = `${q.role}|${q.month}|${q.question_id}`
    const list = groups.get(k)
    if (list) list.push(q)
    else groups.set(k, [q])
  }
  return (
    <>
      {[...groups.values()].slice(0, 2).map((list) => {
        const q = list[0]
        const comment = comments?.find((c) => c.role === q.role && c.month === q.month && c.question_id === q.question_id)
        const body = comment ? (
          <Marked text={comment.text} marks={list} />
        ) : (
          list.map((x) => x.text).join(' … ')
        )
        return (
          <blockquote key={`${q.role}|${q.month}|${q.question_id}`} className={s.quote}>
            «{body}» <span className={s.who}>— {ROLE_LABEL[q.role]}</span>
          </blockquote>
        )
      })}
    </>
  )
}

function Marked({ text, marks }: { text: string; marks: readonly { start: number; end: number }[] }) {
  const ranges = [...marks]
    .filter((m) => m.end > m.start)
    .sort((a, b) => a.start - b.start)
    .reduce<{ start: number; end: number }[]>((acc, m) => {
      const prev = acc[acc.length - 1]
      if (prev && m.start <= prev.end) prev.end = Math.max(prev.end, m.end)
      else acc.push({ start: Math.max(0, m.start), end: Math.min(text.length, m.end) })
      return acc
    }, [])
  const parts: ReactNode[] = []
  let i = 0
  ranges.forEach((r, k) => {
    if (r.start > i) parts.push(text.slice(i, r.start))
    parts.push(<mark key={k}>{text.slice(r.start, r.end)}</mark>)
    i = r.end
  })
  if (i < text.length) parts.push(text.slice(i))
  return <>{parts}</>
}
