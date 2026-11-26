// Анкета стажёра и наставника (docs/design/v2.md, «Форма»). Без оболочки
// дашборда: ссылку открывают с телефона. Вопросы из /api/survey, люди и месяц
// из /api/people, отправка в POST /api/ingest.
// Шаг 1: роль и человек. Шаг 2: вопросы. ?role=intern&id=S-01 сразу открывает шаг 2.
// Личная ссылка ?t=<роль>.<ID>.<токен>: сразу вопросы, без шага 1, месяц задан сервером.

import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useIngest, usePeople, useSurvey } from '../../api/queries'
import type { People, Role, Survey } from '../../api/types'
import { Button } from '../../ds/components/core/Button'
import { Logo } from '../../ds/components/brand/Logo'
import { formatCount, personName, ROLE_LABEL, ROLE_TITLE } from '../../lib/format'
import { parseFormToken, type FormToken } from '../../lib/formLink'
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
  token?: string
}

// Черновик одной роли. Роль переключили и вернулись: ответы на месте.
interface Draft {
  personKey: string
  // Ставится при выборе человека и дальше меняется только руками, поэтому
  // свежий /api/people после отправки его не сдвигает.
  month: number | null
  answers: Answers
}

const ROLES: readonly Role[] = ['intern', 'mentor']
const OTHER: Record<Role, Role> = { intern: 'mentor', mentor: 'intern' }
const EMPTY_DRAFT: Draft = { personKey: '', month: null, answers: {} }

// Оценка до этой включительно просит пояснение. Ответ уходит под ключом «{вопрос}__why».
const LOW_MAX = 2
const WHY = '__why'
const ASK_MINUTES = 'около 2 минут'

// Черновик живёт в браузере, по человеку и месяцу. Хранилища может не быть (приватное окно): тогда без черновика.
const draftKey = (role: Role, personKey: string, month: number) => `form-draft:${role}:${personKey}:${month}`

function readDraft(key: string): Answers {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'number' || typeof v === 'string'))
  } catch {
    return {}
  }
}

function writeDraft(key: string, answers: Answers) {
  try {
    if (Object.keys(answers).length) localStorage.setItem(key, JSON.stringify(answers))
    else localStorage.removeItem(key)
  } catch {
    // Черновик не сохранился, форма работает как есть.
  }
}

function startDraft(role: Role, p: Person, survey: Survey): Draft {
  const month = defaultMonth(p, survey)
  return { personKey: p.key, month, answers: readDraft(draftKey(role, p.key, month)) }
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
}

function personsOf(people: People, role: Role): Person[] {
  const list =
    role === 'intern'
      ? people.interns.map((p) => ({ id: p.id, name: p.name, other: p.mentor_id, next: p.next_month, token: p.token }))
      : people.mentors.map((p) => ({ id: p.id, name: p.name, other: p.intern_id, next: p.next_month, token: p.token }))
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
    token: p.token,
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
  const drafts: Record<Role, Draft> = { intern: EMPTY_DRAFT, mentor: EMPTY_DRAFT }

  // Личная ссылка. Токен сверяем со списком людей: чужой или устаревший не открывает анкету.
  const lock = parseFormToken(params.get('t'))
  if (lock) {
    const mine = personsOf(people, lock.role).filter((p) => p.id === lock.id && p.token === lock.token)
    // У наставника с двумя стажёрами одна ссылка на двоих: человека выберут на шаге 1.
    if (mine.length === 1) drafts[lock.role] = startDraft(lock.role, mine[0], survey)
    return { role: lock.role, drafts, lock, valid: mine.length > 0 }
  }

  const id = (params.get('id') ?? '').trim().toUpperCase()
  const raw = params.get('role')
  const asked: Role | null = raw === 'intern' || raw === 'mentor' ? raw : null
  // ID сам говорит, чья это анкета: S-01 стажёр, даже если в ссылке role=mentor.
  const roles: readonly Role[] = asked ? [asked, OTHER[asked]] : ROLES
  for (const role of roles) {
    const p = id ? personsOf(people, role).find((x) => x.id === id) : undefined
    if (p) {
      drafts[role] = startDraft(role, p, survey)
      return { role, drafts, lock: null, valid: true }
    }
  }
  return { role: asked, drafts, lock: null, valid: true }
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
          <Logo variant="mark" size={40} />
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
  const lock: FormToken | null = init.lock
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
  const all = role ? personsOf(people, role) : []
  // По личной ссылке видны только её люди (обычно один).
  const persons = lock ? all.filter((p) => p.id === lock.id && p.token === lock.token) : all
  const person = persons.find((p) => p.key === draft.personKey) ?? null
  const step2 = role != null && person != null && !picking
  // По ссылке месяц задан и не меняется, без ссылки его выбирают.
  const month = person ? (lock ? person.next : (draft.month ?? defaultMonth(person, survey))) : null
  const saveKey = role && person && month != null && !sent ? draftKey(role, person.key, month) : null

  // Шаг сменился: наверх, фокус на имя, чтобы скринридер не потерялся.
  useEffect(() => {
    if (!step2) return
    window.scrollTo(0, 0)
    nameRef.current?.focus({ preventScroll: true })
  }, [step2])

  useEffect(() => {
    if (saveKey) writeDraft(saveKey, draft.answers)
  }, [saveKey, draft.answers])

  const patch = (fn: (d: Draft) => Draft) => {
    if (role) setDrafts((all) => ({ ...all, [role]: fn(all[role]) }))
  }
  const setAnswer = (id: string, value: number | string) => patch((d) => ({ ...d, answers: { ...d.answers, [id]: value } }))

  const chooseRole = (next: Role) => {
    setRole(next)
    setTried(false)
    ingest.reset()
  }

  const choosePerson = (p: Person) => {
    // Тот же человек: месяц, который поменяли руками, не сбрасываем.
    if (p.key !== draft.personKey && role) patch(() => startDraft(role, p, survey))
    setPicking(false)
  }

  const chooseMonth = (m: number) => {
    if (role && person) patch((d) => ({ ...d, month: m, answers: readDraft(draftKey(role, person.key, m)) }))
  }

  const again = () => {
    if (role) setDrafts((all) => ({ ...all, [role]: EMPTY_DRAFT }))
    setTried(false)
    setSent(false)
    ingest.reset()
    window.scrollTo(0, 0)
  }

  if (!init.valid) {
    return (
      <Shell>
        <section className={clsx(s.card, s.center)} role="alert">
          <h1 className={s.title}>Ссылка не подошла</h1>
          <p className={s.sub}>Попросите HR прислать новую. Или откройте анкету без ссылки и выберите себя в списке.</p>
          <a className={clsx(s.secondary, s.anchor)} href="/form">
            Открыть анкету
          </a>
        </section>
      </Shell>
    )
  }

  if (sent) return <Done onAgain={lock ? undefined : again} />

  if (lock && person && month == null) {
    return (
      <Shell>
        <section className={clsx(s.card, s.center)}>
          <h1 className={s.title}>Все анкеты за программу уже заполнены, спасибо</h1>
        </section>
      </Shell>
    )
  }

  if (!step2) {
    // По ссылке роль известна: остаётся выбрать стажёра, если их несколько.
    const firstPerson = persons[0]
    return (
      <Shell>
        <section className={s.card} aria-labelledby="form-who">
          <h1 className={s.title} id="form-who">
            {lock && firstPerson ? `${personName(firstPerson.name, firstPerson.id)}, о ком анкета?` : 'Кто вы?'}
          </h1>
          {!lock && (
            <div className={s.roles}>
              {ROLES.map((r) => (
                <button key={r} type="button" className={s.choice} aria-pressed={r === role} onClick={() => chooseRole(r)}>
                  {ROLE_TITLE[r]}
                </button>
              ))}
            </div>
          )}
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
                      {lock ? personName(people.interns.find((x) => x.id === p.other)?.name, p.other) : p.name}
                      {!lock && persons.some((x) => x.id === p.id && x.key !== p.key) && (
                        <span className={s.sub}>
                          {ROLE_LABEL[OTHER[role]]} {p.otherName}
                        </span>
                      )}
                    </span>
                    {/* ID нужен, только когда по имени людей не различить. */}
                    {!lock && p.named && persons.some((x) => x.id !== p.id && x.name === p.name) && <span className={s.id}>{p.id}</span>}
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
  // Как в счётчике «Отвечено N из M»: оценки обязательны, комментарий отдельно.
  const questionCount = def.questions.filter((q) => q.type === 'scale').length
  const textCount = def.questions.filter((q) => q.type === 'text').length
  const scaleQs = def.questions.filter((q) => q.type === 'scale')
  const missing = scaleQs.filter((q) => typeof draft.answers[q.id] !== 'number')
  const scale = range(survey.scale.min, survey.scale.max)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ingest.isPending) return
    setTried(true)
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
      if (q.type === 'scale' && typeof v === 'number') {
        answers[q.id] = v
        // Пояснение уходит, только пока оценка низкая: передумали и подняли её, старый текст не нужен.
        const why = draft.answers[q.id + WHY]
        if (v <= LOW_MAX && typeof why === 'string' && why.trim()) answers[q.id + WHY] = why.trim()
      }
      if (q.type === 'text') answers[q.id] = typeof v === 'string' ? v.trim() : ''
      if (q.type === 'choice' && typeof v === 'string' && v) answers[q.id] = v
    }
    ingest.mutate(
      // Вторая сторона пары явно: у наставника с двумя стажёрами без неё анкета не найдёт пару.
      {
        role,
        person_id: person.id,
        ...(role === 'intern' ? { mentor_id: person.other } : { intern_id: person.other }),
        month: month ?? survey.months,
        answers,
        source: 'form',
        ...(lock ? { token: lock.token } : {}),
      },
      {
        onSuccess: () => {
          if (saveKey) writeDraft(saveKey, {})
          setSent(true)
        },
      },
    )
  }

  return (
    <Shell>
      <form className={s.stack} noValidate onSubmit={submit}>
        <section className={s.card} style={order(0)}>
          <div className={s.head}>
            <h1 className={s.name} ref={nameRef} tabIndex={-1}>
              {lock ? `${person.name}, анкета за ${month}-й месяц` : person.name}
            </h1>
            {(!lock || persons.length > 1) && (
              <button type="button" className={s.link} onClick={() => setPicking(true)}>
                Изменить
              </button>
            )}
          </div>
          <p className={s.sub}>
            {ROLE_LABEL[OTHER[role]]} {person.otherName}
          </p>
          {lock ? (
            <p className={s.sub}>
              {formatCount(questionCount, ['оценка', 'оценки', 'оценок'])}
              {textCount ? ` и ${formatCount(textCount, ['вопрос', 'вопроса', 'вопросов'])} словами` : ''}, {ASK_MINUTES}
            </p>
          ) : (
            <div className={s.select}>
              <select aria-label="Месяц" value={month ?? ''} onChange={(e) => chooseMonth(Number(e.target.value))}>
                {range(1, survey.months).map((m) => (
                  <option key={m} value={m}>
                    {m}-й месяц{alreadySent(person, m) ? ', анкета уже есть' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" strokeWidth={1.8} />
            </div>
          )}
        </section>

        {def.questions.map((q, i) => {
          if (q.type === 'text') {
            return (
              <section key={`${role}-${q.id}`} className={s.card} style={order(i + 1)}>
                <label className={s.qt} htmlFor={`form-t-${q.id}`}>
                  {nbsp(q.text)}
                </label>
                <p className={s.trust}>{role === 'intern' ? 'Ответ видит только HR программы. Наставник его не видит.' : 'Ответ видит только HR программы.'}</p>
                <textarea
                  id={`form-t-${q.id}`}
                  className={s.text}
                  rows={4}
                  value={String(draft.answers[q.id] ?? '')}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
              </section>
            )
          }
          if (q.type === 'choice') {
            const options = q.options?.length ? q.options : ['Да', 'Нет']
            return (
              <section key={`${role}-${q.id}`} className={s.card} style={order(i + 1)} aria-labelledby={`form-qt-${q.id}`}>
                <h2 className={s.qt} id={`form-qt-${q.id}`}>
                  {nbsp(q.text)}
                </h2>
                <div className={s.scale} role="radiogroup" aria-labelledby={`form-qt-${q.id}`} style={{ '--n': options.length } as CSSProperties}>
                  {options.map((o) => (
                    <label key={o} className={s.opt}>
                      <input
                        type="radio"
                        name={`${role}-${q.id}`}
                        checked={draft.answers[q.id] === o}
                        onChange={() => setAnswer(q.id, o)}
                        aria-label={o}
                      />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
              </section>
            )
          }
          const value = draft.answers[q.id]
          const miss = tried && typeof value !== 'number'
          const low = typeof value === 'number' && value <= LOW_MAX
          return (
            <section
              key={`${role}-${q.id}`}
              id={`form-q-${q.id}`}
              className={clsx(s.card, miss && s.miss)}
              style={order(i + 1)}
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
                      checked={value === v}
                      onChange={() => setAnswer(q.id, v)}
                      aria-label={`${v} из ${survey.scale.max}${v === survey.scale.min ? `, ${survey.scale.min_label}` : v === survey.scale.max ? `, ${survey.scale.max_label}` : ''}`}
                    />
                    <span>{v}</span>
                  </label>
                ))}
              </div>
              <div className={s.edges} aria-hidden="true">
                <span>{survey.scale.min_label}</span>
                <span>{survey.scale.max_label}</span>
              </div>
              <div className={s.why} data-open={low}>
                <div>
                  <label className={s.whyLabel} htmlFor={`form-w-${q.id}`}>
                    Что за этим стоит? Необязательно
                  </label>
                  <textarea
                    id={`form-w-${q.id}`}
                    className={clsx(s.text, s.whyText)}
                    rows={3}
                    tabIndex={low ? 0 : -1}
                    value={String(draft.answers[q.id + WHY] ?? '')}
                    onChange={(e) => setAnswer(q.id + WHY, e.target.value)}
                  />
                </div>
              </div>
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
          <div className={s.bar}>
            <span className={s.count} aria-live="polite">
              Отвечено {scaleQs.length - missing.length} из {scaleQs.length}
            </span>
            <div className={s.submit}>
              <Button variant="primary" size="l" fullWidth type="submit" aria-busy={ingest.isPending || undefined}>
                {ingest.isPending ? 'Отправляем…' : 'Отправить'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Shell>
  )
}

function Done({ onAgain }: { onAgain?: () => void }) {
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
          Спасибо
        </h1>
        <p className={s.sub}>Следующая анкета в конце следующего месяца.</p>
        {onAgain && (
          <button type="button" className={s.secondary} onClick={onAgain}>
            Заполнить ещё одну
          </button>
        )}
      </section>
    </Shell>
  )
}
