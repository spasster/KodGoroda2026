// Анкета стажёра и наставника (docs/design/v2.md, «Форма»). Без оболочки
// дашборда: ссылку открывают с телефона. Вопросы из /api/survey, люди и месяц
// из /api/people, отправка в POST /api/ingest.
// Шаг 1: роль и человек. Шаг 2: вопросы. ?role=intern&id=S-01 сразу открывает шаг 2.

import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useIngest, usePeople, useSurvey } from '../../api/queries'
import type { People, Role, Survey } from '../../api/types'
import { personName, ROLE_LABEL, ROLE_TITLE } from '../../lib/format'
import { useDocumentTitle } from './title'
import s from './Form.module.css'

type Answers = Record<string, number | string>

interface Person {
  // ID и вторая сторона: у наставника бывает несколько стажёров, один ID на две строки.
  key: string
  id: string
  name: string
  // Есть имя в справочнике. Нет: вместо имени ID, и второй раз его не пишем.
  named: boolean
  other: string
  otherName: string
  // Первый месяц без анкеты, null: заполнены все.
  next: number | null
}

// Черновик одной роли. Роль переключили и вернулись: ответы на месте.
interface Draft {
  personKey: string
  // Ставится при выборе человека и дальше меняется только руками, поэтому
  // свежий /api/people после отправки его не сдвигает.
  month: number | null
  answers: Answers
  department: string
}

const ROLES: readonly Role[] = ['intern', 'mentor']
const OTHER: Record<Role, Role> = { intern: 'mentor', mentor: 'intern' }
const EMPTY_DRAFT: Draft = { personKey: '', month: null, answers: {}, department: '' }

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
}

function personsOf(people: People, role: Role): Person[] {
  const list =
    role === 'intern'
      ? people.interns.map((p) => ({ id: p.id, name: p.name, other: p.mentor_id, next: p.next_month }))
      : people.mentors.map((p) => ({ id: p.id, name: p.name, other: p.intern_id, next: p.next_month }))
  const names = new Map<string, string | null | undefined>()
  for (const p of [...people.interns, ...people.mentors]) names.set(p.id, p.name)
  return list.map((p) => ({
    key: `${p.id}:${p.other}`,
    id: p.id,
    name: personName(p.name, p.id),
    named: Boolean(p.name?.trim()),
    other: p.other,
    otherName: personName(names.get(p.other), p.other),
    next: p.next,
  }))
}

// Первый месяц без анкеты. Заполнены все, значит последний.
function defaultMonth(p: Person, survey: Survey): number {
  return p.next ?? survey.months
}

// До next_month анкеты есть за каждый месяц.
function alreadySent(p: Person, month: number): boolean {
  return p.next == null || month < p.next
}

function fromParams(params: URLSearchParams, people: People, survey: Survey) {
  const id = (params.get('id') ?? '').trim().toUpperCase()
  const raw = params.get('role')
  const asked: Role | null = raw === 'intern' || raw === 'mentor' ? raw : null
  const drafts: Record<Role, Draft> = { intern: EMPTY_DRAFT, mentor: EMPTY_DRAFT }
  // ID сам говорит, чья это анкета: S-01 стажёр, даже если в ссылке role=mentor.
  const roles: readonly Role[] = asked ? [asked, OTHER[asked]] : ROLES
  for (const role of roles) {
    const p = id ? personsOf(people, role).find((x) => x.id === id) : undefined
    if (p) {
      drafts[role] = { ...EMPTY_DRAFT, personKey: p.key, month: defaultMonth(p, survey) }
      return { role, drafts }
    }
  }
  return { role: asked, drafts }
}

// Предлоги и частицы (в, и, не, ли) не висят в конце строки.
function nbsp(text: string): string {
  return text.replace(/(?<=^|[\s«(])([а-яё]{1,2}) /gi, '$1\u00A0')
}

function reveal(el: Element, block: ScrollLogicalPosition) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block })
}

// Карточки шага появляются друг за другом, номер задаёт задержку.
function order(i: number): CSSProperties {
  return { '--i': i } as CSSProperties
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={s.page}>
      <div className={s.wrap}>
        <header className={s.top}>
          <span className={s.mark} aria-hidden="true">
            МГТС
          </span>
          <span className={s.product}>Анкета стажировки</span>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}

export function FormPage() {
  useDocumentTitle('Анкета стажировки')
  const survey = useSurvey()
  const people = usePeople()

  // Данные уже были, а повторный запрос упал: форма остаётся на экране.
  if (survey.data && people.data) return <FormFlow survey={survey.data} people={people.data} />

  if (survey.isError || people.isError) {
    const busy = survey.isFetching || people.isFetching
    return (
      <Shell>
        <section className={clsx(s.card, s.center)} role="alert">
          <h1 className={s.title}>Анкета не загрузилась</h1>
          <button
            type="button"
            className={s.secondary}
            aria-busy={busy || undefined}
            onClick={() => {
              if (survey.isError) void survey.refetch()
              if (people.isError) void people.refetch()
            }}
          >
            Повторить
          </button>
        </section>
      </Shell>
    )
  }

  return (
    <Shell>
      <section className={clsx(s.card, s.skeleton)} aria-busy="true" aria-label="Загрузка">
        <i style={{ width: '40%', height: 28 }} />
        <div className={s.roles}>
          <i />
          <i />
        </div>
      </section>
    </Shell>
  )
}

function FormFlow({ survey, people }: { survey: Survey; people: People }) {
  const [params] = useSearchParams()
  const [init] = useState(() => fromParams(params, people, survey))
  const [role, setRole] = useState<Role | null>(init.role)
  const [drafts, setDrafts] = useState(init.drafts)
  // «Изменить»: снова список людей, хотя человек уже выбран.
  const [picking, setPicking] = useState(false)
  // Нажали «Отправить» с пропусками: пропуски подсвечены, пока их не заполнят.
  const [tried, setTried] = useState(false)
  const [sent, setSent] = useState(false)
  const ingest = useIngest()
  const nameRef = useRef<HTMLHeadingElement>(null)

  const draft = role ? drafts[role] : EMPTY_DRAFT
  const persons = role ? personsOf(people, role) : []
  const person = persons.find((p) => p.key === draft.personKey) ?? null
  const step2 = role != null && person != null && !picking

  // Шаг сменился: наверх, фокус на имя, чтобы скринридер не потерялся.
  useEffect(() => {
    if (!step2) return
    window.scrollTo(0, 0)
    nameRef.current?.focus({ preventScroll: true })
  }, [step2])

  const patch = (fn: (d: Draft) => Draft) => {
    if (role) setDrafts((all) => ({ ...all, [role]: fn(all[role]) }))
  }

  const chooseRole = (next: Role) => {
    setRole(next)
    setTried(false)
    ingest.reset()
  }

  const choosePerson = (p: Person) => {
    // Тот же человек: месяц, который поменяли руками, не сбрасываем.
    if (p.key !== draft.personKey) patch((d) => ({ ...d, personKey: p.key, month: defaultMonth(p, survey) }))
    setPicking(false)
  }

  const again = () => {
    if (role) setDrafts((all) => ({ ...all, [role]: EMPTY_DRAFT }))
    setTried(false)
    setSent(false)
    ingest.reset()
    window.scrollTo(0, 0)
  }

  if (sent) return <Done onAgain={again} />

  if (!step2) {
    return (
      <Shell>
        <section className={s.card} aria-labelledby="form-who">
          <h1 className={s.title} id="form-who">
            Кто вы?
          </h1>
          <div className={s.roles}>
            {ROLES.map((r) => (
              <button key={r} type="button" className={s.choice} aria-pressed={r === role} onClick={() => chooseRole(r)}>
                {ROLE_TITLE[r]}
              </button>
            ))}
          </div>
          {role &&
            (persons.length ? (
              <div className={s.people} key={role}>
                {persons.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={clsx(s.choice, s.person)}
                    aria-pressed={p.key === draft.personKey}
                    onClick={() => choosePerson(p)}
                  >
                    <span>
                      {p.name}
                      {persons.some((x) => x.id === p.id && x.key !== p.key) && (
                        <span className={s.sub}>
                          {ROLE_LABEL[OTHER[role]]} {p.otherName}
                        </span>
                      )}
                    </span>
                    {p.named && <span className={s.id}>{p.id}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <p className={s.empty}>Список пока пуст</p>
            ))}
        </section>
      </Shell>
    )
  }

  const def = survey.roles[role]
  const month = draft.month ?? defaultMonth(person, survey)
  const scaleQs = def.questions.filter((q) => q.type === 'scale')
  const missing = scaleQs.filter((q) => typeof draft.answers[q.id] !== 'number')
  const scale = range(survey.scale.min, survey.scale.max)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ingest.isPending) return
    setTried(true)
    if (survey.technical_fields?.department && !draft.department.trim()) {
      document.getElementById('form-department')?.focus()
      return
    }
    if (missing.length) {
      const el = document.getElementById(`form-q-${missing[0].id}`)
      if (el) {
        reveal(el, 'center')
        el.querySelector<HTMLElement>('input')?.focus({ preventScroll: true })
      }
      return
    }
    const answers: Answers = {}
    for (const q of def.questions) {
      const v = draft.answers[q.id]
      if (q.type === 'scale' && typeof v === 'number') answers[q.id] = v
      if (q.type === 'text') answers[q.id] = typeof v === 'string' ? v.trim() : ''
    }
    ingest.mutate(
      // Вторая сторона пары явно: у наставника с двумя стажёрами без неё анкета не найдёт пару.
      {
        role,
        person_id: person.id,
        ...(role === 'intern' ? { mentor_id: person.other } : { intern_id: person.other }),
        month,
        department: draft.department.trim() || undefined,
        answers,
        source: 'form',
      },
      { onSuccess: () => setSent(true) },
    )
  }

  return (
    <Shell>
      <form className={s.stack} noValidate onSubmit={submit}>
        <section className={s.card} style={order(0)}>
          <div className={s.head}>
            <h1 className={s.name} ref={nameRef} tabIndex={-1}>
              {person.name}
            </h1>
            <button type="button" className={s.link} onClick={() => setPicking(true)}>
              Изменить
            </button>
          </div>
          <p className={s.sub}>
            {ROLE_LABEL[OTHER[role]]} {person.otherName}
          </p>
          <div className={s.select}>
            <select aria-label={survey.technical_fields?.month ?? 'Месяц'} value={month} onChange={(e) => patch((d) => ({ ...d, month: Number(e.target.value) }))}>
              {range(1, survey.months).map((m) => (
                <option key={m} value={m}>
                  {m}-й месяц{alreadySent(person, m) ? ', анкета уже есть' : ''}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" strokeWidth={1.8} />
          </div>
          {survey.technical_fields?.department && (
            <label className={s.department}>
              {survey.technical_fields.department}
              <input id="form-department" className={s.text} value={draft.department} required
                aria-invalid={tried && !draft.department.trim() || undefined}
                onChange={(e) => patch((d) => ({ ...d, department: e.target.value }))} />
              {tried && !draft.department.trim() && <span role="alert">Укажите подразделение</span>}
            </label>
          )}
        </section>

        <p className={s.note} style={order(1)}>
          Ответы видит только HR программы.
        </p>

        {def.questions.map((q, i) => {
          if (q.type === 'text') {
            return (
              <section key={`${role}-${q.id}`} className={s.card} style={order(i + 2)}>
                <label className={s.qt} htmlFor={`form-t-${q.id}`}>
                  {nbsp(q.text)}
                </label>
                <textarea
                  id={`form-t-${q.id}`}
                  className={s.text}
                  rows={4}
                  value={String(draft.answers[q.id] ?? '')}
                  onChange={(e) => patch((d) => ({ ...d, answers: { ...d.answers, [q.id]: e.target.value } }))}
                />
              </section>
            )
          }
          const miss = tried && typeof draft.answers[q.id] !== 'number'
          return (
            <section
              key={`${role}-${q.id}`}
              id={`form-q-${q.id}`}
              className={clsx(s.card, miss && s.miss)}
              style={order(i + 2)}
              aria-labelledby={`form-qt-${q.id}`}
            >
              <h2 className={s.qt} id={`form-qt-${q.id}`}>
                {nbsp(q.text)}
              </h2>
              <div
                className={s.scale}
                role="radiogroup"
                aria-labelledby={`form-qt-${q.id}`}
                aria-invalid={miss || undefined}
                style={{ '--n': scale.length } as CSSProperties}
              >
                {scale.map((v) => (
                  <label key={v} className={s.opt}>
                    <input
                      type="radio"
                      name={`${role}-${q.id}`}
                      checked={draft.answers[q.id] === v}
                      onChange={() => patch((d) => ({ ...d, answers: { ...d.answers, [q.id]: v } }))}
                      aria-label={q.score_labels?.[v] ? `${v} из ${survey.scale.max}, ${q.score_labels[v]}` : `${v} из ${survey.scale.max}`}
                    />
                    <span>{v}</span>
                  </label>
                ))}
              </div>
              {q.score_labels ? (
                <ul className={s.rubric} aria-label="Расшифровка шкалы">
                  {Object.entries(q.score_labels).map(([score, label]) => <li key={score}><strong>{score}</strong> {label}</li>)}
                </ul>
              ) : (
                <div className={s.edges} aria-hidden="true">
                  <span>{survey.scale.min_label}</span>
                  <span>{survey.scale.max_label}</span>
                </div>
              )}
            </section>
          )
        })}

        <div className={s.dock}>
          {ingest.isError && (
            <p className={s.error} role="alert">
              {ingest.error.status >= 400 && ingest.error.status < 500
                ? ingest.error.message
                : 'Нет связи с сервером. Ответы на месте, отправьте ещё раз.'}
            </p>
          )}
          <button type="submit" className={s.submit} aria-busy={ingest.isPending || undefined}>
            {ingest.isPending ? 'Отправляем…' : 'Отправить'}
          </button>
        </div>
      </form>
    </Shell>
  )
}

function Done({ onAgain }: { onAgain: () => void }) {
  const head = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    head.current?.focus({ preventScroll: true })
  }, [])
  return (
    <Shell>
      <section className={clsx(s.card, s.center)}>
        <svg className={s.check} viewBox="0 0 64 64" aria-hidden="true">
          <circle cx={32} cy={32} r={32} />
          <path pathLength={1} d="m20 33 8 8 16-17" />
        </svg>
        <h1 className={s.title} ref={head} tabIndex={-1}>
          Спасибо, анкета отправлена
        </h1>
        <button type="button" className={s.secondary} onClick={onAgain}>
          Заполнить ещё одну
        </button>
      </section>
    </Shell>
  )
}
