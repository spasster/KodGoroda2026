// Сигнал целиком: карточка пары и экран «С кем поговорить». Слева важность,
// источник и месяц; справа заголовок, объяснение, доказательства по типу,
// строка происхождения, «Что сделать.», повтор и отметка HR.
// Тексты сигнала пишет бэкенд, здесь они не переписываются и не обрезаются.

import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

import type { CommentItem, PairDetail, Role, Signal } from '../api/types'
import { monthsPhrase, ROLE_TITLE } from '../lib/format'
import { useReduced, variants } from '../lib/motion'
import { GapChain } from './GapChain'
import { Quote } from './Quote'
import { ReviewControl } from './ReviewControl'
import { SeverityLabel } from './Severity'
import s from './Signal.module.css'
import { Provenance, SourceTag } from './Source'

export interface SignalBlockProps {
  signal: Signal
  // Пара целиком: комментарии для реплик, клетки для цепочки разрыва, ID людей.
  // Без неё вместо комментариев показываются только сами цитаты.
  pair?: PairDetail
  // Повторы того же условия (clusterRepeats(...).repeats). Открытые попадут во
  // флажок «Отметить так же сигнал за 4-й месяц», включённый по умолчанию.
  repeats?: readonly Signal[]
  className?: string
}

export function SignalBlock({ signal, pair, repeats = [], className }: SignalBlockProps) {
  const reduce = useReduced()
  const open = signal.review.status === 'open'
  const openRepeats = repeats.filter((r) => r.review.status === 'open')
  const [alsoChecked, setAlsoChecked] = useState(true)
  // Открыт: отметка уходит на открытые повторы, если флажок стоит. Отмечен:
  // «Снять отметку» уходит и на повторы с той же отметкой.
  const alsoKeys = open
    ? alsoChecked
      ? openRepeats.map((r) => r.key)
      : []
    : repeats.filter((r) => r.review.status === signal.review.status).map((r) => r.key)

  return (
    <article className={clsx(s.signal, className)} data-signal={signal.key}>
      <div className={s.side}>
        <SeverityLabel severity={signal.severity} />
        <SourceTag type={signal.type} />
        <span>{signal.month}-й месяц</span>
      </div>
      <div className={s.body}>
        <h3 className={s.title}>{signal.title}</h3>
        <p className={s.expl}>{signal.explanation}</p>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="evidence"
              className={s.collapse}
              variants={variants.collapse}
              initial="hidden"
              animate="shown"
              exit={reduce ? undefined : 'gone'}
            >
              <Evidence signal={signal} pair={pair} />
              <Provenance signal={signal} />
              <p className={s.todo}>
                <b>Что сделать.</b> {signal.action}
              </p>
              {openRepeats.length > 0 && (
                <div className={s.repeat}>
                  <label>
                    <input type="checkbox" checked={alsoChecked} onChange={(e) => setAlsoChecked(e.target.checked)} />
                    <span>
                      {repeatLine(signal, openRepeats)}
                      <small>
                        {openRepeats.some((r) => r.title !== signal.title)
                          ? 'Это тот же человек и тот же разговор.'
                          : 'Условие то же самое.'}{' '}
                        Если разговор по {signal.month}-му месяцу уже был, хватит одного решения.
                      </small>
                    </span>
                  </label>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <ReviewControl signal={signal} alsoKeys={alsoKeys} />
      </div>
    </article>
  )
}

// «Отметить так же сигнал за 4-й месяц», «…сигналы за 3-й и 4-й месяцы». Разные
// заголовки дописываются в ёлочках, каждый один раз.
function repeatLine(head: Signal, repeats: readonly Signal[]): string {
  const months = monthsPhrase(repeats.map((r) => r.month))
  const what = repeats.length === 1 ? `сигнал за ${months}` : `сигналы за ${months}`
  const other = [...new Set(repeats.map((r) => r.title))]
  const titles = other.some((t) => t !== head.title) ? `: ${other.map((t) => `«${t}»`).join(', ')}` : ''
  return `Отметить так же ${what}${titles}`
}

function personId(pair: PairDetail | undefined, role: Role): string | undefined {
  if (!pair) return undefined
  return role === 'intern' ? pair.intern_id : pair.mentor_id
}

function findComment(pair: PairDetail | undefined, role: Role, month: number, questionId?: string): CommentItem | undefined {
  return pair?.comments.find((c) => c.role === role && c.month === month && (!questionId || c.question_id === questionId))
}

function caption(pair: PairDetail | undefined, role: Role, month: number, extra = ''): string {
  const id = personId(pair, role)
  return `${ROLE_TITLE[role]}${id ? ` ${id}` : ''}, ${month}-й месяц${extra}`
}

function Evidence({ signal, pair }: { signal: Signal; pair?: PairDetail }) {
  const marksFor = (role: Role, month: number) =>
    signal.quotes.filter((q) => q.role === role && q.month === month).map((q) => ({ start: q.start, end: q.end }))

  // Комментарий, на который опирается первая цитата, или сама цитата без пары.
  const quoteBlock = () => {
    const q = signal.quotes[0]
    if (!q) return null
    const c = findComment(pair, q.role, q.month, q.question_id)
    // Текстовое поле анкеты бывает вопросом («Что мешает?») или подписью («Комментарий
    // о работе стажёра за месяц»): подпись вопросом не называем.
    const ask =
      c && signal.type === 'text_vs_score'
        ? c.question_text.trim().endsWith('?')
          ? `, ответ на вопрос «${c.question_text}»`
          : ', из комментария'
        : ''
    return (
      <Quote
        className={s['single-quote']}
        text={c ? c.text : q.text}
        marks={c ? marksFor(q.role, q.month) : [{ start: 0, end: q.text.length }]}
        role={q.role}
        caption={caption(pair, q.role, q.month, ask)}
      />
    )
  }

  if (signal.type === 'gap_intern_low' || signal.type === 'gap_mentor_low') {
    const gaps = pair
      ? pair.cells.filter((c) => c.month <= signal.month).map((c) => c.gap)
      : gapsFromValues(signal)
    const low: Role = signal.type === 'gap_intern_low' ? 'intern' : 'mentor'
    const other: Role = low === 'intern' ? 'mentor' : 'intern'
    return (
      <div className={s.evidence}>
        <GapChain values={gaps} />
        {pair ? (
          <div className={s.replicas}>
            {[low, other].map((role, column) => (
              <Quote
                key={role}
                text={findComment(pair, role, signal.month)?.text ?? ''}
                marks={marksFor(role, signal.month)}
                role={role}
                caption={caption(pair, role, signal.month)}
                // Черта главной реплики у стороны, которой хуже; ответ второй стороны бледнее.
                secondary={column === 1}
              />
            ))}
          </div>
        ) : (
          quoteBlock()
        )}
      </div>
    )
  }

  if (signal.type === 'decline') {
    const role: Role = signal.role === 'mentor' ? 'mentor' : 'intern'
    return (
      <div className={s.evidence}>
        <GapChain
          values={signal.values.filter((v) => v.role === role).map((v) => v.value)}
          label={`оценка ${role === 'intern' ? 'стажёра' : 'наставника'}`}
          abs={false}
        />
        {quoteBlock()}
      </div>
    )
  }

  if (signal.type === 'text_vs_score') return quoteBlock()

  // silence: только объяснение.
  return null
}

// Разрывы по месяцам из values сигнала, если пары под рукой нет.
function gapsFromValues(signal: Signal): (number | null)[] {
  const months = [...new Set(signal.values.map((v) => v.month))].sort((a, b) => a - b)
  return months.map((m) => {
    const i = signal.values.find((v) => v.month === m && v.role === 'intern')?.value
    const mt = signal.values.find((v) => v.month === m && v.role === 'mentor')?.value
    return i != null && mt != null ? mt - i : null
  })
}
