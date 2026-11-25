// Строка таблицы сигналов: важность, стажёр, заголовок, когда, отметка. По клику
// раскрывается на месте: объяснение, цитата, что сделать, отметка.

import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { CommentItem, PairDetail, Quote, ReviewStatus, Signal } from '../../api/types'
import { ROLE_LABEL, SEVERITY_LABEL } from '../../lib/format'
import { afterReview, situationMonths } from '../../lib/rules'
import s from './Signals.module.css'

export type Mark = Exclude<ReviewStatus, 'open'>

export const MARK_LABEL: Record<ReviewStatus, string> = { open: 'открыта', confirmed: 'подтвердилась', rejected: 'проблемы нет' }

interface Props {
  signal: Signal
  /** Имя стажёра. */
  person: string
  detail?: PairDetail
  open: boolean
  fresh: boolean
  /** Сколько колонок в таблице, для строки с подробностями. */
  cols: number
  onToggle: () => void
  onMark: (status: ReviewStatus) => void
}

export function SignalRow({ signal: head, person, detail, open, fresh, cols, onToggle, onMark }: Props) {
  const status = head.review.status
  const panelId = `signal-${head.key}`

  return (
    <>
      <tr className={clsx(s.row, open && s.rowOpen)} onClick={onToggle}>
        <td className={s.cDot}>
          {/* Цвет только у открытых: разобранные и старые не требуют внимания. */}
          <span className={clsx(s.dot, head.active && status === 'open' ? s[head.severity] : s.dotDone)} aria-hidden="true" />
          <span className="sr-only">Важность {SEVERITY_LABEL[head.severity]}.</span>
        </td>
        <td className={s.cPerson}>{person}</td>
        <td className={s.cTitle}>
          <button
            type="button"
            className={s.toggle}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            {head.title}
          </button>
          {fresh && <span className={s.fresh}>новое</span>}
        </td>
        <td className={s.cWhen}>{situationMonths(head)}</td>
        <td className={s.cMark}>{status === 'open' ? '' : MARK_LABEL[status]}</td>
      </tr>
      {open && (
        <tr id={panelId} className={s.detail}>
          <td colSpan={cols}>
            <div className={s.panelInner}>
              <p className={s.explain}>{head.explanation}</p>
              <Quotes quotes={head.quotes} comments={detail?.comments} />
              <p className={s.todo}>Что сделать: {head.action}</p>
              {afterReview(head).map((line) => (
                <p key={line} className={s.explain}>
                  {line}
                </p>
              ))}
              <div className={s.actions}>
                {status === 'open' ? (
                  <>
                    <button type="button" className={clsx(s.btn, s.secondary)} onClick={() => onMark('confirmed')}>
                      Проблема подтвердилась
                    </button>
                    <button type="button" className={clsx(s.btn, s.secondary)} onClick={() => onMark('rejected')}>
                      Проблемы нет
                    </button>
                  </>
                ) : (
                  <button type="button" className={clsx(s.btn, s.secondary)} onClick={() => onMark('open')}>
                    Снять отметку
                  </button>
                )}
                <Link to={`/pairs/${head.pair_id}`} className={s.pairLink}>
                  Открыть стажёра
                </Link>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
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
