// Мобильная форма для стажёра и наставника (system.md, «Мобильная форма и
// «Спасибо»»). Без оболочки дашборда: ссылку открывают с телефона. Вопросы из
// /api/survey, ID и месяц из /api/people, отправка в POST /api/ingest.
// ?role=intern&id=S-01 заполняет роль, ID и месяц сразу.

import clsx from 'clsx'
import { CircleAlert, Lock } from 'lucide-react'
import { motion } from 'motion/react'
import { Fragment, useEffect, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { ApiError } from '../../api/client'
import { useIngest, usePeople, useSurvey } from '../../api/queries'
import type { People, Role, Survey } from '../../api/types'
import { Button, ErrorBanner, Loading, Segmented, Skeleton, type SegmentOption } from '../../components'
import { formatNumber, plural } from '../../lib/format'
import { dur, ease, transition, useReduced } from '../../lib/motion'
import { FormHeader, useDocumentTitle } from './FormHeader'
import s from './Form.module.css'

type Answers = Record<string, number | string>

// Черновик анкеты одной роли. Роль переключили и вернулись: ответы на месте.
interface Draft {
  // Person.key: у наставника бывает несколько стажёров, один ID на две кнопки.
  personKey: string
  // Месяц ставится при выборе ID и дальше меняется только руками, поэтому
  // свежий /api/people после чужой анкеты его не сдвигает.
  month: number | null
  monthOpen: boolean
  answers: Answers
}

interface Person {
  // ID и вторая сторона: пара однозначна, даже если ID повторяется.
  key: string
  id: string
  // ID второй стороны пары: наставник стажёра или стажёр наставника.
  other: string
  // Первый месяц без анкеты, null: заполнены все.
  next: number | null
}

interface Sent {
  role: Role
  personId: string
  month: number
  avg: number | null
  last: boolean
}

const EMPTY_DRAFT: Draft = { personKey: '', month: null, monthOpen: false, answers: {} }

const ROLE_OPTIONS: readonly SegmentOption<Role>[] = [
  { value: 'intern', label: 'Я стажёр' },
  { value: 'mentor', label: 'Я наставник' },
]

const OTHER_TITLE: Record<Role, string> = { intern: 'Наставник', mentor: 'Стажёр' }

const PRIVACY_REST: Record<Role, string> = {
  intern: 'Наставнику их не показывают.',
  mentor: 'Стажёру их не показывают.',
}

const PLACEHOLDER: Record<Role, string> = {
  intern: 'Например: чего не хватает, что получилось, о чём хотелось бы поговорить',
  mentor: 'Например: что у стажёра получилось, где ему нужна помощь',
}

const QUESTION_WORDS = ['вопрос', 'вопроса', 'вопросов'] as const

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
}

function personsOf(people: People, role: Role): Person[] {
  return role === 'intern'
    ? people.interns.map((p) => ({ key: `${p.id}:${p.mentor_id}`, id: p.id, other: p.mentor_id, next: p.next_month }))
    : people.mentors.map((p) => ({ key: `${p.id}:${p.intern_id}`, id: p.id, other: p.intern_id, next: p.next_month }))
}

// Месяц по умолчанию: первый без анкеты. Заполнены все, значит последний.
function defaultMonth(p: Person, survey: Survey): number {
  return p.next ?? survey.months
}

// До next_month анкеты есть за каждый месяц.
function alreadySent(p: Person, month: number): boolean {
  return p.next == null || month < p.next
}

// Колонки ряда кнопок: ID по пять, месяцы по шесть, шкала в один ряд до 6 кнопок.
function cols(n: number): CSSProperties {
  return { '--cols': n } as CSSProperties
}

// «4», «4 и 5», «1, 2, 3 и 4».
function joinAnd(items: ReactNode[]): ReactNode {
  return items.map((item, i) => (
    <Fragment key={i}>
      {i > 0 && (i === items.length - 1 ? ' и ' : ', ')}
      {item}
    </Fragment>
  ))
}

function fromParams(params: URLSearchParams, people: People, survey: Survey): { role: Role; drafts: Record<Role, Draft> } {
  const id = (params.get('id') ?? '').trim().toUpperCase()
  const asked: Role = params.get('role') === 'mentor' ? 'mentor' : 'intern'
  const drafts: Record<Role, Draft> = { intern: EMPTY_DRAFT, mentor: EMPTY_DRAFT }
  // ID сам говорит, чья это анкета: S-01 стажёр, даже если в ссылке role=mentor.
  for (const role of [asked, asked === 'intern' ? 'mentor' : 'intern'] as const) {
    const p = id ? personsOf(people, role).find((x) => x.id === id) : undefined
    if (p) {
      drafts[role] = { ...EMPTY_DRAFT, personKey: p.key, month: defaultMonth(p, survey) }
      return { role, drafts }
    }
  }
  return { role: asked, drafts }
}

export function FormPage() {
  useDocumentTitle('Анкета стажировки')
  const survey = useSurvey()
  const people = usePeople()

  // Данные уже были, а повторный запрос упал: форма остаётся на экране.
  if (survey.data && people.data) return <FormFlow survey={survey.data} people={people.data} />

  const failed = survey.isError || people.isError
  const retry = () => {
    if (survey.isError) void survey.refetch()
    if (people.isError) void people.refetch()
  }
  return (
    <div className={s.page}>
      <FormHeader />
      <main className={s.wrap}>
        {failed ? (
          <ErrorBanner
            className={s['load-error']}
            title="Не удалось загрузить данные"
            text="Сервер не ответил. Проверьте связь и нажмите «Повторить»."
            onRetry={retry}
            retrying={survey.isFetching || people.isFetching}
          />
        ) : (
          <FormSkeleton />
        )}
      </main>
    </div>
  )
}

function SkeletonRow({ n, height }: { n: number; height: number }) {
  return (
    <div className={s['skel-row']}>
      {range(1, n).map((i) => (
        <Skeleton key={i} height={height} radius={12} />
      ))}
    </div>
  )
}

// Серые блоки по форме анкеты: заголовок, роль, ID, приватность, первый вопрос.
function FormSkeleton() {
  return (
    <Loading className={s.skeleton}>
      <Skeleton width="88%" height={34} />
      <Skeleton width="70%" height={22} />
      <Skeleton width={150} height={22} style={{ marginTop: 24 }} />
      <Skeleton height={56} radius={14} />
      <Skeleton width={110} height={22} style={{ marginTop: 24 }} />
      <SkeletonRow n={5} height={52} />
      <Skeleton height={98} radius={12} style={{ marginTop: 24 }} />
      <Skeleton width="78%" height={24} style={{ marginTop: 24 }} />
      <SkeletonRow n={5} height={56} />
    </Loading>
  )
}

function Option({
  name,
  checked,
  onChange,
  label,
  children,
}: {
  name: string
  checked: boolean
  onChange: () => void
  // Подпись для скринридера, если цифры на кнопке мало: «2 из 5».
  label?: string
  children: ReactNode
}) {
  return (
    <label className={s.opt}>
      <input type="radio" name={name} checked={checked} onChange={onChange} aria-label={label} />
      <span>{children}</span>
    </label>
  )
}

function FormFlow({ survey, people }: { survey: Survey; people: People }) {
  const [params] = useSearchParams()
  const [init] = useState(() => fromParams(params, people, survey))
  const [role, setRole] = useState<Role>(init.role)
  const [drafts, setDrafts] = useState(init.drafts)
  // Нажали «Отправить» с пропусками: пропуски подсвечены, пока их не заполнят.
  const [tried, setTried] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)
  const ingest = useIngest()
  const reduce = useReduced()

  const def = survey.roles[role]
  const draft = drafts[role]
  const persons = personsOf(people, role)
  const person = persons.find((p) => p.key === draft.personKey) ?? null
  const month = person ? (draft.month ?? defaultMonth(person, survey)) : null
  const scaleQs = def.questions.filter((q) => q.type === 'scale')
  const textQs = def.questions.filter((q) => q.type === 'text')
  const missing = scaleQs.filter((q) => typeof draft.answers[q.id] !== 'number')
  const answered = scaleQs.length - missing.length
  const scale = range(survey.scale.min, survey.scale.max)
  const months = range(1, survey.months)
  const replaces = person != null && month != null && alreadySent(person, month)
  const commentEmpty = textQs.every((q) => !String(draft.answers[q.id] ?? '').trim())

  const patch = (fn: (d: Draft) => Draft) => setDrafts((all) => ({ ...all, [role]: fn(all[role]) }))

  const chooseRole = (next: Role) => {
    if (next === role) return
    setRole(next)
    setTried(false)
    ingest.reset()
  }

  // Прокрутка к блоку и фокус на его первое поле. Плавно, если движение не выключено.
  const goTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    el.querySelector<HTMLElement>('input:checked, input, textarea')?.focus({ preventScroll: true })
  }
  const jump = (id: string) => (e: MouseEvent) => {
    e.preventDefault()
    goTo(id)
  }

  const openMonths = () => {
    patch((d) => ({ ...d, monthOpen: true }))
    // Кнопка «Поменять месяц» исчезает, фокус переходит на выбранный месяц.
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#form-months input:checked')?.focus())
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ingest.isPending) return
    setTried(true)
    if (!person || month == null) return goTo('form-id')
    if (missing.length) return goTo(`form-q-${missing[0].id}`)

    const answers: Answers = {}
    for (const q of def.questions) {
      const v = draft.answers[q.id]
      if (q.type === 'scale' && typeof v === 'number') answers[q.id] = v
      if (q.type === 'text') answers[q.id] = typeof v === 'string' ? v.trim() : ''
    }
    const scores = scaleQs.map((q) => draft.answers[q.id]).filter((v): v is number => typeof v === 'number')
    ingest.mutate(
      // Вторая сторона пары явно: у наставника с двумя стажёрами без неё анкета не найдёт пару.
      {
        role,
        person_id: person.id,
        ...(role === 'intern' ? { mentor_id: person.other } : { intern_id: person.other }),
        month,
        answers,
        source: 'form',
      },
      {
        onSuccess: () => {
          setSent({
            role,
            personId: person.id,
            month,
            avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
            last: month >= survey.months,
          })
          window.scrollTo(0, 0)
        },
      },
    )
  }

  // «Заполнить ещё одну анкету»: роль остаётся, ID и ответы этой роли с нуля.
  const again = () => {
    setDrafts((all) => ({ ...all, [role]: EMPTY_DRAFT }))
    setTried(false)
    setSent(null)
    ingest.reset()
    window.scrollTo(0, 0)
  }

  if (sent) {
    return (
      <div className={s.page}>
        <FormHeader />
        <Done sent={sent} label={survey.roles[sent.role].person_label} onAgain={again} />
      </div>
    )
  }

  const left: ReactNode[] = []
  if (!person) {
    left.push(
      <a key="id" href="#form-id" onClick={jump('form-id')}>
        выберите ID
      </a>,
    )
  }
  if (missing.length) {
    left.push(
      <Fragment key="q">
        ответьте на {missing.length === 1 ? 'вопрос' : 'вопросы'}{' '}
        {joinAnd(
          missing.map((q) => (
            <a key={q.id} href={`#form-q-${q.id}`} onClick={jump(`form-q-${q.id}`)} className="num">
              {def.questions.indexOf(q) + 1}
            </a>
          )),
        )}
      </Fragment>,
    )
  }

  const lead = `${scaleQs.length} ${plural(scaleQs.length, QUESTION_WORDS)} с оценкой${textQs.length ? ' и комментарий' : ''}, это около двух минут.`

  return (
    <div className={s.page}>
      <FormHeader progress={scaleQs.length ? answered / scaleQs.length : 0}>
        <span className={clsx(s.counter, 'num')}>
          Оценок <b>{answered}</b> из {scaleQs.length}
        </span>
      </FormHeader>

      <main className={s.wrap}>
        <div className={s.intro}>
          <h1>{month != null ? `Анкета за ${month}-й месяц` : 'Анкета за месяц стажировки'}</h1>
          <p>{lead}</p>
        </div>

        <form noValidate onSubmit={submit}>
          <section className={s.field} aria-labelledby="form-role-l">
            <h2 className={s.lbl} id="form-role-l">
              Кто заполняет
            </h2>
            <Segmented
              label="Кто заполняет"
              size="l"
              className={s['role-seg']}
              value={role}
              onChange={chooseRole}
              options={ROLE_OPTIONS}
            />
          </section>

          <section id="form-id" className={clsx(s.field, tried && !person && s.missing)} aria-labelledby="form-id-l">
            <h2 className={s.lbl} id="form-id-l">
              {def.person_label}
            </h2>
            {persons.length > 0 ? (
              <div className={s.row} role="radiogroup" aria-labelledby="form-id-l" style={cols(Math.min(persons.length, 5))}>
                {persons.map((p) => (
                  <Option key={p.key} name={`person-${role}`} checked={p.key === person?.key} onChange={() => patch((d) => ({ ...d, personKey: p.key, month: defaultMonth(p, survey) }))}>
                    {persons.filter((x) => x.id === p.id).length > 1 ? `${p.id} · ${p.other}` : p.id}
                  </Option>
                ))}
              </div>
            ) : (
              <p className={s.bind}>Список пока пуст. Анкета откроется, когда HR загрузит пары из Excel.</p>
            )}
            {person && month != null ? (
              <>
                <p className={s.bind}>
                  {OTHER_TITLE[role]} <b>{person.other}</b>. Анкета за {month}-й месяц.
                  {!draft.monthOpen && (
                    <>
                      {' '}
                      <button type="button" className={s['link-btn']} onClick={openMonths} aria-expanded={false} aria-controls="form-months">
                        Поменять месяц
                      </button>
                    </>
                  )}
                </p>
                {draft.monthOpen && (
                  <div id="form-months" className={s.months}>
                    <p className={s.sublbl} id="form-month-l">
                      Месяц стажировки
                    </p>
                    <div className={s.row} role="radiogroup" aria-labelledby="form-month-l" style={cols(Math.min(months.length, 6))}>
                      {months.map((m) => (
                        <Option key={m} name={`month-${role}`} checked={m === month} onChange={() => patch((d) => ({ ...d, month: m }))} label={`${m}-й месяц`}>
                          {m}
                        </Option>
                      ))}
                    </div>
                    {person.next !== 1 && (
                      <p className={s.hint}>
                        {person.next == null
                          ? 'Анкеты за все месяцы уже есть.'
                          : person.next === 2
                            ? 'Анкета за 1-й месяц уже есть.'
                            : `Анкеты за 1–${person.next - 1}-й месяц уже есть.`}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              persons.length > 0 && <p className={s.hint}>ID есть в письме о начале стажировки.</p>
            )}
            {tried && !person && persons.length > 0 && <p className={s.need}>Выберите свой ID</p>}
          </section>

          {persons.length > 0 && (
            <>
              <div className={s.privacy}>
                <Lock aria-hidden="true" strokeWidth={1.6} />
                <p>
                  <b>Ответы видит только HR программы.</b> {PRIVACY_REST[role]}
                </p>
              </div>

              {def.questions.map((q, i) => {
                const n = (
                  <span className={clsx(s.n, 'num')} aria-hidden="true">
                    {i + 1}
                  </span>
                )
                if (q.type === 'text') {
                  return (
                    <div key={`${role}-${q.id}`} id={`form-q-${q.id}`} className={s.q}>
                      <div className={s['q-head']}>
                        {n}
                        <label className={s.qt} htmlFor={`form-t-${q.id}`}>
                          {q.text}
                        </label>
                      </div>
                      <textarea
                        id={`form-t-${q.id}`}
                        className={s.text}
                        value={String(draft.answers[q.id] ?? '')}
                        onChange={(e) => patch((d) => ({ ...d, answers: { ...d.answers, [q.id]: e.target.value } }))}
                        placeholder={PLACEHOLDER[role]}
                        aria-describedby={`form-th-${q.id}`}
                      />
                      <p className={s.hint} id={`form-th-${q.id}`}>
                        Пишите как есть. Можно коротко, можно пропустить.
                      </p>
                    </div>
                  )
                }
                const miss = tried && typeof draft.answers[q.id] !== 'number'
                return (
                  <section key={`${role}-${q.id}`} id={`form-q-${q.id}`} className={clsx(s.q, miss && s.missing)} aria-labelledby={`form-qt-${q.id}`}>
                    <div className={s['q-head']}>
                      {n}
                      <h2 className={s.qt} id={`form-qt-${q.id}`}>
                        {q.text}
                      </h2>
                    </div>
                    <div
                      className={clsx(s.row, s.scale)}
                      role="radiogroup"
                      aria-labelledby={`form-qt-${q.id}`}
                      aria-describedby={miss ? `form-need-${q.id}` : undefined}
                      style={cols(scale.length <= 6 ? scale.length : Math.ceil(scale.length / 2))}
                    >
                      {scale.map((v) => (
                        <Option
                          key={v}
                          name={`${role}-${q.id}`}
                          checked={draft.answers[q.id] === v}
                          onChange={() => patch((d) => ({ ...d, answers: { ...d.answers, [q.id]: v } }))}
                          label={`${v} из ${survey.scale.max}${v === survey.scale.min ? `, ${survey.scale.min_label}` : v === survey.scale.max ? `, ${survey.scale.max_label}` : ''}`}
                        >
                          {v}
                        </Option>
                      ))}
                    </div>
                    <div className={s.edges} aria-hidden="true">
                      <span>{survey.scale.min_label}</span>
                      <span>{survey.scale.max_label}</span>
                    </div>
                    {miss && (
                      <p className={s.need} id={`form-need-${q.id}`}>
                        Нужен ответ
                      </p>
                    )}
                  </section>
                )
              })}

              <div className={s.send}>
                {replaces && (
                  <p className={s.replace}>
                    Анкета {person.id} за {month}-й месяц уже есть. Новая заменит её.
                  </p>
                )}
                {ingest.isError && <SendError error={ingest.error} />}
                <Button type="submit" variant="brand" busy={ingest.isPending} className={s.submit}>
                  {ingest.isPending ? 'Отправляем…' : 'Отправить анкету'}
                </Button>
                <p className={s.left} aria-live="polite">
                  {left.length ? (
                    <>
                      Осталось:{' '}
                      {left.map((part, i) => (
                        <Fragment key={i}>
                          {i > 0 && ', '}
                          {part}
                        </Fragment>
                      ))}
                    </>
                  ) : textQs.length && commentEmpty ? (
                    'Всё готово. Комментарий по желанию.'
                  ) : (
                    'Всё готово.'
                  )}
                </p>
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  )
}

// Сеть упала или сервер не ответил: просим нажать ещё раз. 422: текст detail.
function SendError({ error }: { error: ApiError }) {
  const offline = !(error.status >= 400 && error.status < 500)
  return (
    <div className={s.error} role="alert">
      <CircleAlert aria-hidden="true" strokeWidth={1.7} />
      <p>
        <b>Не получилось отправить</b>
        {offline ? 'Нет связи с сервером. Ответы остались на экране, нажмите «Отправить анкету» ещё раз.' : error.message}
      </p>
    </div>
  )
}

// «Спасибо»: круг рисуется 700 мс, потом галочка 420 мс (CSS, при reduce сразу).
function Done({ sent, label, onAgain }: { sent: Sent; label: string; onAgain: () => void }) {
  const reduce = useReduced()
  const head = useRef<HTMLHeadingElement>(null)
  useEffect(() => head.current?.focus({ preventScroll: true }), [])

  return (
    <motion.main
      className={clsx(s.wrap, s.done)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition(reduce, { duration: dur.m, ease: ease.out })}
    >
      <svg className={s.check} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle className={s.ring} pathLength={1} cx={32} cy={32} r={29} />
        <path className={s.tick} pathLength={1} d="m20 33 8 8 16-17" />
      </svg>
      <h1 ref={head} tabIndex={-1}>
        Спасибо, анкета отправлена
      </h1>
      <p className={s['done-lead']}>
        {sent.last
          ? 'HR программы видит её сразу. Это была последняя анкета стажировки, спасибо, что заполняли их каждый месяц.'
          : 'HR программы видит её сразу. Следующая анкета через месяц.'}
      </p>
      <dl className={s.sum}>
        <div>
          <dt>{label}</dt>
          <dd>{sent.personId}</dd>
        </div>
        <div>
          <dt>Месяц</dt>
          <dd className="num">{sent.month}-й</dd>
        </div>
        {sent.avg != null && (
          <div>
            <dt>Средняя оценка</dt>
            <dd className="num">{formatNumber(sent.avg)}</dd>
          </div>
        )}
      </dl>
      <Button className={s.again} onClick={onAgain}>
        Заполнить ещё одну анкету
      </Button>
    </motion.main>
  )
}
