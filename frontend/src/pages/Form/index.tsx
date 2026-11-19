// Заглушка формы для стажёра и наставника. Без оболочки дашборда: ссылку
// открывают с телефона. Вопросы из /api/survey, люди и месяц из /api/people.

import { useState, type FormEvent } from 'react'

import { useIngest, usePeople, useSurvey } from '../../api/queries'
import type { Role } from '../../api/types'
import { formatCount, monthLabel, WORDS } from '../../lib/format'

type Answers = Record<string, number | string>

export function FormPage() {
  const survey = useSurvey()
  const people = usePeople()
  const ingest = useIngest()
  const [role, setRole] = useState<Role>('intern')
  const [personId, setPersonId] = useState('')
  const [month, setMonth] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Answers>({})

  if (survey.isPending || people.isPending) return <p>Загружаем анкету</p>
  if (survey.isError) return <p>Ошибка: {survey.error.message}</p>
  if (people.isError) return <p>Ошибка: {people.error.message}</p>

  const s = survey.data
  const roleDef = s.roles[role]
  const persons = role === 'intern' ? people.data.interns : people.data.mentors
  const scale = Array.from({ length: s.scale.max - s.scale.min + 1 }, (_, i) => s.scale.min + i)
  const months = Array.from({ length: s.months }, (_, i) => i + 1)

  const chooseRole = (next: Role) => {
    setRole(next)
    setPersonId('')
    setMonth(null)
    setAnswers({})
    ingest.reset()
  }

  const choosePerson = (id: string) => {
    setPersonId(id)
    setMonth(persons.find((p) => p.id === id)?.next_month ?? null)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!personId || month === null) return
    ingest.mutate(
      { role, person_id: personId, month, answers, source: 'form' },
      { onSuccess: () => setAnswers({}) },
    )
  }

  return (
    <form onSubmit={submit}>
      <h1>{s.title}</h1>
      <p>
        <label>
          <input type="radio" checked={role === 'intern'} onChange={() => chooseRole('intern')} /> {s.roles.intern.title}
        </label>{' '}
        <label>
          <input type="radio" checked={role === 'mentor'} onChange={() => chooseRole('mentor')} /> {s.roles.mentor.title}
        </label>
      </p>
      <p>
        <label>
          {roleDef.person_label}:{' '}
          <select value={personId} onChange={(e) => choosePerson(e.target.value)} required>
            <option value="">выберите</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Месяц:{' '}
          <select value={month ?? ''} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)} required>
            <option value="">выберите</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
      </p>

      {roleDef.questions.map((q) => (
        <fieldset key={q.id}>
          <legend>{q.text}</legend>
          {q.type === 'scale' ? (
            <p>
              {s.scale.min_label}{' '}
              {scale.map((v) => (
                <label key={v}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === v}
                    onChange={() => setAnswers({ ...answers, [q.id]: v })}
                  />{' '}
                  {v}{' '}
                </label>
              ))}
              {s.scale.max_label}
            </p>
          ) : (
            <textarea
              value={String(answers[q.id] ?? '')}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              rows={4}
              cols={60}
            />
          )}
        </fieldset>
      ))}

      <p>
        <button type="submit" disabled={ingest.isPending || !personId || month === null}>
          Отправить
        </button>
      </p>
      {ingest.isError && <p role="alert">Не отправилось: {ingest.error.message}</p>}
      {ingest.isSuccess && (
        <p role="status">
          Анкета принята{ingest.data.replaced ? ' и заменила прежнюю' : ''}: пара {ingest.data.pair_id}. Новых сигналов:{' '}
          {ingest.data.new_signals.length ? formatCount(ingest.data.new_signals.length, WORDS.signal) : 'нет'}.
        </p>
      )}
    </form>
  )
}
