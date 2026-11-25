// Сигналы пары: открытые карточками, отмеченные и старые одной строкой
// «Разобранные: N» с раскрытием. Отмеченная карточка уходит вниз, в разобранные.

import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

import { useReview, useThresholds } from '../../api/queries'
import type { PairDetail, ReviewStatus, Severity, Signal } from '../../api/types'
import { useReduced, variants } from '../../lib/motion'
import { Marked } from './Marked'
import { afterReview, situationMonths } from '../../lib/rules'
import { doneSignals, explanationLine, inWindow, marksWorthShowing, openSignals, signalQuote, type QuoteView } from './model'
import s from './Pair.module.css'

const SEVERITY_WORD: Record<Severity, string> = {
  high: 'высокая важность',
  medium: 'средняя важность',
  low: 'низкая важность',
}

const REVIEW_WORD: Partial<Record<ReviewStatus, string>> = {
  confirmed: 'подтвердилось',
  rejected: 'ложная тревога',
}

const SAVE_ERROR = 'Не сохранилось. Попробуйте ещё раз.'

export function SignalList({ pair, className }: { pair: PairDetail; className?: string }) {
  const review = useReview()
  const reduce = useReduced()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const open = openSignals(pair.signals)
  const done = doneSignals(pair.signals)
  // Одна и та же цитата на экране один раз: у второго сигнала без неё.
  const seen = new Set<string>()
  const quotes = open.map((sig) => {
    const q = signalQuote(sig, pair.comments)
    if (!q || seen.has(q.text)) return null
    seen.add(q.text)
    return q
  })

  const mark = (key: string, status: ReviewStatus) => {
    setErrors(({ [key]: _, ...rest }) => rest)
    review.mutateAsync({ key, status }).catch(() => setErrors((e) => ({ ...e, [key]: SAVE_ERROR })))
  }

  return (
    <section className={clsx(s.card, className)} aria-labelledby="pair-signals">
      <h2 id="pair-signals" className={s.cardTitle}>
        Сигналы
      </h2>
      {open.length === 0 && <p className={s.none}>Открытых сигналов нет</p>}
      <AnimatePresence initial={false}>
        {open.map((sig, i) => (
          <motion.div
            key={sig.key}
            className={s.signalWrap}
            variants={variants.collapse}
            initial={reduce ? false : 'hidden'}
            animate="shown"
            exit={reduce ? undefined : 'gone'}
          >
            <SignalCard
              signal={sig}
              quote={quotes[i]}
              error={errors[sig.key]}
              onMark={(status) => mark(sig.key, status)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      {done.length > 0 && (
        <Done
          signals={done}
          lastMonth={pair.last_month}
          onReopen={(sig) => mark(sig.key, 'open')}
          errors={errors}
        />
      )}
    </section>
  )
}

function Dot({ severity }: { severity: Severity }) {
  return (
    <span className={s.sev} data-sev={severity}>
      <span className="sr-only">{SEVERITY_WORD[severity]}</span>
    </span>
  )
}

function SignalCard({
  signal,
  quote,
  error,
  onMark,
}: {
  signal: Signal
  quote: QuoteView | null
  error?: string
  onMark: (status: ReviewStatus) => void
}) {
  return (
    <article className={s.signal}>
      <h3 className={s.signalTitle}>
        <Dot severity={signal.severity} />
        <span>
          {signal.title}
          <span className={s.signalMonth}> · {situationMonths(signal)}</span>
        </span>
      </h3>
      <div className={s.signalBody}>
        <p>{explanationLine(signal)}</p>
        {quote && (
          <figure className={s.quote}>
            <blockquote>
              «<Marked text={quote.text} marks={marksWorthShowing(quote.text, quote.marks)} />»
            </blockquote>
            <figcaption>— {quote.role === 'intern' ? 'стажёр' : 'наставник'}</figcaption>
          </figure>
        )}
        <p>
          <span className={s.todoLabel}>Что сделать:</span> {signal.action}
        </p>
        {afterReview(signal).map((line) => (
          <p key={line}>{line}</p>
        ))}
        <div className={s.actions}>
          <button type="button" className={s.btn} onClick={() => onMark('confirmed')}>
            Подтвердилось
          </button>
          <button type="button" className={s.btn} onClick={() => onMark('rejected')}>
            Ложная тревога
          </button>
        </div>
        {error && (
          <p role="alert" className={s.error}>
            {error}
          </p>
        )}
      </div>
    </article>
  )
}

function Done({
  signals,
  lastMonth,
  onReopen,
  errors,
}: {
  signals: Signal[]
  lastMonth: number
  onReopen: (signal: Signal) => void
  errors: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const { active_months: activeMonths } = useThresholds()
  const reduce = useReduced()
  return (
    <div className={s.done}>
      <button
        type="button"
        className={s.doneToggle}
        aria-expanded={open}
        aria-controls="pair-done"
        onClick={() => setOpen((v) => !v)}
      >
        Разобранные: {signals.length}
        <ChevronDown aria-hidden="true" size={18} strokeWidth={1.8} className={clsx(s.chevron, open && s.chevronOpen)} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id="pair-done"
            key="list"
            className={s.doneList}
            variants={variants.collapse}
            initial={reduce ? false : 'hidden'}
            animate="shown"
            exit={reduce ? undefined : 'gone'}
          >
            {signals.map((sig) => {
              const word = REVIEW_WORD[sig.review.status]
              return (
                <li key={sig.key}>
                  <Dot severity={sig.severity} />
                  <span className={s.doneText}>
                    {sig.title}
                    <span className={s.doneMeta}>
                      {situationMonths(sig)}{word ? ` · ${word}` : ''}
                    </span>
                    {afterReview(sig).map((line) => (
                      <span key={line} className={s.doneMeta}>
                        {line}
                      </span>
                    ))}
                    {errors[sig.key] && (
                      <span role="alert" className={s.error}>
                        {errors[sig.key]}
                      </span>
                    )}
                  </span>
                  {word && inWindow(sig, lastMonth, activeMonths) && (
                    <button type="button" className={s.linkBtn} onClick={() => onReopen(sig)}>
                      Вернуть
                    </button>
                  )}
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
