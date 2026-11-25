// Сводка по стажёру, вопросы для разговора и заметки HR.

import { useState, type FormEvent } from 'react'

import { useAddNote, useBrief } from '../../api/queries'
import { ROLE_LABEL } from '../../lib/format'
import s from './Brief.module.css'

const DATE = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })

export function BriefCard({ pairId }: { pairId: string }) {
  const brief = useBrief(pairId)
  const addNote = useAddNote(pairId)
  const [text, setText] = useState('')
  const b = brief.data
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
        <p className={s.summary}>{b.summary}</p>
      </div>
      <div className={s.col}>
        <h2 className={s.title}>Что спросить на встрече</h2>
        {b.questions.length > 0 ? (
          <ul className={s.questions}>
            {b.questions.map((q) => (
              <li key={q.text}>
                <span className={s.to} data-role={q.to}>
                  {ROLE_LABEL[q.to]}
                </span>
                {q.text}
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
