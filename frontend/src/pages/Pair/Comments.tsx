// Комментарии по месяцам от свежего к старому: стажёр и наставник рядом,
// фрагменты, на которые опираются сигналы, подсвечены.

import clsx from 'clsx'
import { motion } from 'motion/react'
import { useRef } from 'react'

import type { Cell, CommentItem, PairDetail, Role } from '../../api/types'
import { ease, useReduced } from '../../lib/motion'
import { useLive } from '../../live/useLive'
import { Tag } from '../../ds/components/data-display/Tag'
import { Marked } from './Marked'
import { hasData } from './model'
import s from './Pair.module.css'
import t from './Talk.module.css'
import { topicLabels } from './topics'

// Inline-стиль Tag системы перебивается только через style.
const TAG_STYLE = { height: 22, padding: '0 8px', fontSize: 12 } as const

const ROLES: { role: Role; title: string }[] = [
  { role: 'intern', title: 'Стажёр' },
  { role: 'mentor', title: 'Наставник' },
]

export function Comments({
  pair,
  collect,
  flash,
  labels,
  className,
}: {
  pair: PairDetail
  collect: number | null
  flash?: number | null
  /** Подпись вопроса по ключу «роль:id». */
  labels: Record<string, string>
  className?: string
}) {
  const { isFreshResponse } = useLive()
  const reduce = useReduced()
  const rows = pair.cells.filter(hasData).sort((a, b) => b.month - a.month)

  // Месяц, которого не было при открытии (пришла анкета), проявляется.
  const known = useRef<Set<number> | null>(null)
  if (known.current == null) known.current = new Set(rows.map((c) => c.month))

  return (
    <section className={className} aria-labelledby="pair-comments">
      <h2 id="pair-comments" className={t.blockTitle}>
        Комментарии
      </h2>
      {rows.length === 0 ? (
        <p className={s.none}>Анкет пока нет</p>
      ) : (
        <>
          <div className={s.sidesHead} aria-hidden="true">
            <span />
            {ROLES.map(({ role, title }) => (
              <span key={role}>{title}</span>
            ))}
          </div>
          <ol className={s.months}>
            {rows.map((cell) => {
              const fresh = ROLES.some(({ role }) => isFreshResponse(pair.pair_id, role, cell.month))
              return (
                <motion.li
                  key={cell.month}
                  id={`month-${cell.month}`}
                  className={clsx(flash === cell.month && s.flash)}
                  initial={!known.current!.has(cell.month) && !reduce ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: ease.out, delay: 0.3 }}
                >
                  <h3 className={s.monthName}>
                    {cell.month}-й месяц
                    {fresh && <span className={s.fresh}>новое</span>}
                  </h3>
                  {ROLES.map(({ role, title }) => (
                    <div key={role}>
                      <p className={s.who}>{title}</p>
                      <Said
                        cell={cell}
                        role={role}
                        waiting={cell.month === collect}
                        labels={labels}
                        items={pair.comments.filter((c) => c.role === role && c.month === cell.month)}
                      />
                    </div>
                  ))}
                </motion.li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}

function Said({
  cell,
  role,
  items,
  waiting,
  labels,
}: {
  cell: Cell
  role: Role
  items: CommentItem[]
  waiting: boolean
  labels: Record<string, string>
}) {
  if (cell.missing[role]) return <p className={s.empty}>{waiting ? 'ждём анкету' : 'анкеты нет'}</p>
  const filled = items.filter((c) => c.text.trim())
  if (filled.length === 0) return <p className={s.empty}>без комментария</p>
  return (
    <>
      {filled.map((c) => {
        const topics = topicLabels(c.topics)
        return (
          <div key={c.question_id} className={s.saidItem}>
            <p className={s.saidHead}>
              <span>{labels[`${role}:${c.question_id}`] ?? c.question_text}</span>
              {topics.map((t) => (
                <Tag key={t} style={TAG_STYLE}>
                  {t}
                </Tag>
              ))}
            </p>
            <p className={s.said}>
              «<Marked text={c.text.trimEnd()} marks={c.highlights} />»
            </p>
          </div>
        )
      })}
    </>
  )
}
