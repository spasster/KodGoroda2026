// «Комментарии по месяцам»: месяцы от свежего к старому, стажёр слева, наставник
// справа. Подчёркнуто то, на что опираются сигналы; под текстом темы разбора.
// На телефоне строка разворачивается в блок: месяц, стажёр, наставник.

import clsx from 'clsx'
import { motion } from 'motion/react'
import { useRef } from 'react'

import type { Cell, CommentItem, PairDetail, Role } from '../../api/types'
import { MarkedText, RoleLabel, RoleMark, SectionHead } from '../../components'
import { formatNumber, TOPIC_LABEL } from '../../lib/format'
import { dur, ease, useReduced } from '../../lib/motion'
import { isGapNotable } from '../../lib/rules'
import { useLive } from '../../live/useLive'
import { hasData, indexOf } from './model'
import s from './Pair.module.css'

export function Comments({ pair, collect }: { pair: PairDetail; collect: number | null }) {
  const { isFreshResponse } = useLive()
  const reduce = useReduced()
  const rows = pair.cells.filter(hasData).sort((a, b) => b.month - a.month)

  // Месяцы, которые были при открытии. Новый месяц после анкеты проявляется.
  const known = useRef<Set<number> | null>(null)
  if (known.current == null) known.current = new Set(rows.map((c) => c.month))

  const person = (role: Role) => (role === 'intern' ? pair.intern_id : pair.mentor_id)

  return (
    <section className={clsx(s.block, s.last)} aria-labelledby="comments-h">
      <SectionHead id="comments-h" title="Комментарии по месяцам" note="Подчёркнуто то, на что опираются сигналы." />
      {rows.length === 0 ? (
        <p className={s.calm}>Анкет у пары пока нет.</p>
      ) : (
        <table className={s.cm}>
          <colgroup>
            <col className={s.cmMonthCol} />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Месяц</th>
              <th scope="col">
                <RoleLabel role="intern" id={pair.intern_id} />
              </th>
              <th scope="col">
                <RoleLabel role="mentor" id={pair.mentor_id} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cell) => {
              const fresh = isFreshResponse(pair.pair_id, 'intern', cell.month) || isFreshResponse(pair.pair_id, 'mentor', cell.month)
              return (
                <motion.tr
                  key={cell.month}
                  initial={!known.current!.has(cell.month) && !reduce ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={{ duration: dur.l, ease: ease.out, delay: 0.4 }}
                >
                  <th scope="row" className={s.cmMonth}>
                    <MonthCell cell={cell} fresh={fresh} />
                  </th>
                  {(['intern', 'mentor'] as const).map((role) => (
                    <td key={role}>
                      <span className={s.cmWho}>
                        <RoleLabel role={role} id={person(role)} />
                      </span>
                      <RoleComments
                        cell={cell}
                        role={role}
                        waiting={cell.month === collect}
                        items={pair.comments.filter((c) => c.role === role && c.month === cell.month)}
                      />
                    </td>
                  ))}
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

function MonthCell({ cell, fresh }: { cell: Cell; fresh: boolean }) {
  const score = (role: Role) => {
    const v = indexOf(cell, role)
    return v != null ? formatNumber(v) : 'нет'
  }
  return (
    <>
      <span className={s.cmMonthName}>
        {cell.month}-й месяц
        {fresh && <span className={s.newTag}>новое</span>}
      </span>
      <span className={clsx(s.cmScores, 'num')}>
        <span>
          <RoleMark role="intern" />
          <span className="sr-only">стажёр </span>
          {score('intern')}
        </span>
        <span>
          <RoleMark role="mentor" />
          <span className="sr-only">наставник </span>
          {score('mentor')}
        </span>
      </span>
      {cell.gap != null && (
        <span className={clsx(s.gapPill, isGapNotable(cell) && s.gapPillHigh, 'num')}>
          разрыв {formatNumber(Math.abs(cell.gap))}
        </span>
      )}
    </>
  )
}

function RoleComments({ cell, role, items, waiting }: { cell: Cell; role: Role; items: CommentItem[]; waiting: boolean }) {
  // Месяц сбора ещё идёт: анкета может прийти.
  if (cell.missing[role]) return <span className={s.cmEmpty}>{waiting ? 'Ждём анкету' : 'Анкеты нет'}</span>
  const filled = items.filter((c) => c.text.trim())
  if (filled.length === 0) return <span className={s.cmEmpty}>Комментарий пустой</span>
  // Если в анкете финала окажется несколько текстовых вопросов, подписываем каждый.
  const many = filled.length > 1
  return (
    <>
      {filled.map((c) => (
        <div key={c.question_id} className={s.cmItem}>
          {many && <span className={s.cmQuestion}>{c.question_text}</span>}
          <p>
            <MarkedText text={c.text} marks={c.highlights} />
          </p>
          {c.topics.length > 0 && (
            <div className={s.topics}>
              {c.topics.map((t) => (
                <span key={t} className={s.topic}>
                  {TOPIC_LABEL[t] ?? t}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  )
}
