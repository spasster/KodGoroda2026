// «Итог встречи»: одна форма вместо кнопок на каждом сигнале и отдельных заметок.
// По каждому открытому поводу: подтвердилось, не подтвердилось или не обсуждали.
// Поле «Договорились» уходит в заметки HR. Ниже история договорённостей и разобранные
// поводы со строкой «что изменилось после отметки».

import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'

import { useAddNote, useBrief, useReview, useThresholds } from '../../api/queries'
import type { PairDetail, ReviewStatus, Signal } from '../../api/types'
import { Button } from '../../components'
import { useReduced, variants } from '../../lib/motion'
import { afterReview, situationMonths } from '../../lib/rules'
import { doneSignals, inWindow, openSignals } from './model'
import s from './Talk.module.css'

type Choice = 'confirmed' | 'rejected' | 'skip'

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'confirmed', label: 'Да' },
  { value: 'rejected', label: 'Нет' },
  { value: 'skip', label: 'Не обсуждали' },
]

const REVIEW_WORD: Partial<Record<ReviewStatus, string>> = {
  confirmed: 'подтвердилось',
  rejected: 'не подтвердилось',
}

const DATE = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const CLOCK = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

export function Outcome({ pair }: { pair: PairDetail }) {
  const brief = useBrief(pair.pair_id)
  const addNote = useAddNote(pair.pair_id)
  const review = useReview()
  const reduce = useReduced()
  // Заметка из комментария (важность low) — не проблема: подтверждать её не предлагаем.
  const open = openSignals(pair.signals).filter((sig) => sig.severity !== 'low')
  // «Разобрано» — только то, что отметил HR: «подтвердилось» или «проблемы нет». Прошлые сигналы без отметки
  // показывает блок «Сигналы» слева.
  const done = doneSignals(pair.signals).filter((sig) => sig.review.status !== 'open')

  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const marked = open.filter((sig) => (choices[sig.key] ?? 'skip') !== 'skip')
  const note = text.trim()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (marked.length === 0 && !note) {
      setHint(open.length ? 'Отметьте хотя бы один повод или запишите, о чём договорились.' : 'Запишите, о чём договорились.')
      return
    }
    setBusy(true)
    setHint(null)
    try {
      await Promise.all(marked.map((sig) => review.mutateAsync({ key: sig.key, status: choices[sig.key] as ReviewStatus })))
      if (note) await addNote.mutateAsync(note)
      setChoices({})
      setText('')
      setSavedAt(new Date())
    } catch {
      setHint('Не сохранилось. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  const notes = brief.data?.notes ?? []

  return (
    <section className={s.outcome} aria-labelledby="talk-outcome">
      <h2 id="talk-outcome" className={s.blockTitle}>
        Итог встречи
      </h2>
      <form onSubmit={submit} className={s.outcomeForm}>
        {open.length > 0 && <p className={s.choicesHead}>Проблема подтвердилась?</p>}
        {open.length > 0 && (
          <ul className={s.choices}>
            {open.map((sig) => (
              <li key={sig.key}>
                <p className={s.choiceTitle}>
                  <span className={s.sev} data-sev={sig.severity} aria-hidden="true" />
                  {sig.title}
                </p>
                <div className={s.segment} role="radiogroup" aria-label={`Подтвердилось: ${sig.title}`}>
                  {CHOICES.map((c) => {
                    const on = (choices[sig.key] ?? 'skip') === c.value
                    return (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={clsx(s.segBtn, on && s.segOn)}
                        data-choice={c.value}
                        onClick={() => setChoices((prev) => ({ ...prev, [sig.key]: c.value }))}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
        <label className={s.agreeLabel} htmlFor={`agree-${pair.pair_id}`}>
          Договорились
        </label>
        <textarea
          id={`agree-${pair.pair_id}`}
          className={s.agree}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Например: созвон с наставником раз в неделю, проверить в следующем месяце"
        />
        <div className={s.submitRow}>
          <Button type="submit" variant="brand" busy={busy}>
            Сохранить итог
          </Button>
          <AnimatePresence>
            {savedAt && !hint && (
              <motion.span
                key={savedAt.getTime()}
                className={s.saved}
                initial={reduce ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                Сохранено в {CLOCK.format(savedAt)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {hint && (
          <p role="alert" className={s.hint}>
            {hint}
          </p>
        )}
      </form>

      {notes.length > 0 && (
        <div className={s.history}>
          <p className="overline">Договорённости</p>
          <ul className={s.notes}>
            {notes.map((n) => (
              <li key={n.id}>
                <time dateTime={n.at}>{DATE.format(new Date(n.at))}</time>
                {n.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {done.length > 0 && <Done signals={done} lastMonth={pair.last_month} />}
    </section>
  )
}

// Разобранные и старые поводы: что решили и что изменилось после этого.
function Done({ signals, lastMonth }: { signals: Signal[]; lastMonth: number }) {
  const review = useReview()
  const reduce = useReduced()
  const { active_months: activeMonths } = useThresholds()
  const [error, setError] = useState<string | null>(null)
  const reopen = (key: string) => {
    setError(null)
    review.mutateAsync({ key, status: 'open' }).catch(() => setError('Не сохранилось. Попробуйте ещё раз.'))
  }
  return (
    <div className={s.history}>
      <p className="overline">Разобрано</p>
      <ul className={s.done}>
        <AnimatePresence initial={false}>
          {signals.map((sig) => {
            const word = REVIEW_WORD[sig.review.status]
            return (
              <motion.li key={sig.key} variants={variants.collapse} initial={reduce ? false : 'hidden'} animate="shown" exit={reduce ? undefined : 'gone'}>
                <span className={s.sev} data-sev={sig.severity} aria-hidden="true" />
                <span className={s.doneText}>
                  {sig.title}
                  <span className={s.doneMeta}>
                    {situationMonths(sig)}
                    {word ? ` · ${word}` : ' · прошло'}
                  </span>
                  {afterReview(sig).map((line) => (
                    <span key={line} className={s.doneAfter}>
                      {line}
                    </span>
                  ))}
                </span>
                {word && inWindow(sig, lastMonth, activeMonths) && (
                  <button type="button" className={s.linkBtn} onClick={() => reopen(sig.key)}>
                    Вернуть
                  </button>
                )}
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
      {error && (
        <p role="alert" className={s.hint}>
          {error}
        </p>
      )}
    </div>
  )
}
