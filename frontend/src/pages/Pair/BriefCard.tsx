// Активные ситуации пары, вопросы для разговора и заметки HR.

import { useState, type FormEvent } from 'react'

import { useAddNote, useBrief } from '../../api/queries'
import type { Signal } from '../../api/types'
import { compareSignals, situationMonths } from '../../lib/rules'
import s from './Brief.module.css'

const TO_LABEL = { intern: 'Стажёру', mentor: 'Наставнику', both: 'Обоим' } as const
const DATE = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })

export function BriefCard({ pairId, signals }: { pairId: string; signals: readonly Signal[] }) {
  const brief = useBrief(pairId)
  const addNote = useAddNote(pairId)
  const [text, setText] = useState('')
  const b = brief.data
  const active = signals.filter((x) => x.active).sort(compareSignals)
  if (!b) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value || addNote.isPending) return
    addNote.mutate(value, { onSuccess: () => setText('') })
  }

  return (
    <section className={s.brief}>
      <div className={s.col}>
        <h2 className={s.title}>Коротко</h2>
        {active.length > 0 ? (
          <ul className={s.situations}>
            {active.map((sig) => (
              <li key={sig.key}>
                <span className={s.sev} data-sev={sig.severity} aria-hidden="true" />
                <span>
                  {sig.title}
                  <span className={s.when}>, {situationMonths(sig)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.muted}>Сигналов нет</p>
        )}
      </div>
      <div className={s.col}>
        <h2 className={s.title}>Что спросить на встрече</h2>
        {b.questions.length > 0 ? (
          <ul className={s.questions}>
            {b.questions.map((q) => (
              <li key={q.text}>
                <span className={s.to}>{TO_LABEL[q.to]}:</span> {q.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.muted}>Поводов для отдельного разговора нет</p>
        )}
      </div>
      <div className={s.col}>
        <h2 className={s.title}>Заметки HR</h2>
        <form className={s.form} onSubmit={submit}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="О чём договорились и когда проверить" rows={2} aria-label="Новая заметка" />
          <button type="submit" disabled={!text.trim() || addNote.isPending}>
            Сохранить
          </button>
        </form>
        {addNote.isError && <p className={s.error}>Заметка не сохранилась</p>}
        <ul className={s.notes}>
          {b.notes.map((n) => (
            <li key={n.id}>
              <time dateTime={n.at}>{DATE.format(new Date(n.at))}</time>
              {n.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
