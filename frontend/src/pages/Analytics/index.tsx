// Аналитика программы: общая динамика, вопросы по месяцам, темы комментариев, сбор анкет, эффект.

import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useAnalytics, useMethod, useOverview, usePeople, useSurvey } from '../../api/queries'
import type { Analytics, Overview, Role } from '../../api/types'
import { LoadError, Loading, PageHeader, QuestionTable, Skeleton, type Tone } from '../../components'
import { ROLE_LABEL, formatNumber, monthIn, personName, plural } from '../../lib/format'
import { collectMonth } from '../../lib/rules'
import { StoryChart } from '../Overview/StoryChart'
import s from './Analytics.module.css'

export function AnalyticsPage() {
  const analytics = useAnalytics()
  const overview = useOverview()
  const people = usePeople()
  const survey = useSurvey()
  const a = analytics.data
  const { hash } = useLocation()

  // Ссылка с якорем: блок появляется после загрузки, поэтому прокручиваем, когда данные есть.
  useEffect(() => {
    if (a && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [a, hash])

  if (analytics.isError && !a) {
    return (
      <div className="wrap">
        <LoadError query={analytics} className={s.error} />
      </div>
    )
  }
  if (!a) {
    return (
      <div className="wrap">
        <Loading className={s.skeleton}>
          <Skeleton height={300} radius="var(--r-card)" />
          <Skeleton height={300} radius="var(--r-card)" />
        </Loading>
      </div>
    )
  }

  const last = a.program[a.program.length - 1]
  const responses = overview.data?.totals.responses ?? 0
  const months = Array.from({ length: Math.max(survey.data?.months ?? 0, a.months.length) }, (_, i) => i + 1)
  const collect = collectMonth(people.data, survey.data?.months ?? months.length)

  return (
    <>
      <PageHeader
        title="Аналитика программы"
        facts={[
          `${a.pairs} ${plural(a.pairs, ['пара', 'пары', 'пар'])}`,
          `${responses} ${plural(responses, ['анкета', 'анкеты', 'анкет'])}`,
          last && `средняя оценка стажёров ${formatNumber(last.intern)}`,
          last && `наставников ${formatNumber(last.mentor)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      />
      <div className={clsx('wrap', s.page)}>
        <section className={clsx(s.card, s.wide)}>
          <h2 className={s.title}>Средняя оценка по месяцам</h2>
          <StoryChart
            cells={a.program.map((p) => ({ month: p.month, intern_index: p.intern, mentor_index: p.mentor }))}
            months={months}
            scale={a.scale}
            status="ok"
          />
        </section>

        <section className={s.card}>
          <h2 className={s.title}>О чём пишут</h2>
          <Topics topics={a.topics} />
        </section>

        <section className={clsx(s.card, s.full)}>
          <h2 className={s.title}>Вопросы по месяцам</h2>
          <Heat analytics={a} />
        </section>

        <section className={clsx(s.card, s.full)} id="collect">
          <h2 className={s.title}>Сбор анкет</h2>
          <Collect overview={overview.data} months={months} fallback={collect} />
        </section>

        <section className={clsx(s.card, s.full)}>
          <h2 className={s.title}>Эффект</h2>
          <Effect analytics={a} />
        </section>
      </div>
    </>
  )
}

// Темы комментариев: сколько раз о них писали стажёры и наставники.
function Topics({ topics }: { topics: Analytics['topics'] }) {
  const max = Math.max(1, ...topics.map((t) => t.intern + t.mentor))
  if (topics.length === 0) return <p className={s.muted}>В комментариях пока нет тем</p>
  return (
    <ul className={s.topics}>
      {topics.map((t) => (
        <li key={t.topic}>
          <span className={s.topicLabel}>{capitalize(t.label)}</span>
          <span className={s.topicBar}>
            <i className={s.barIntern} style={{ width: `${(t.intern / max) * 100}%` }} />
            <i className={s.barMentor} style={{ width: `${(t.mentor / max) * 100}%` }} />
          </span>
          <span className={s.topicNum}>{t.intern + t.mentor}</span>
        </li>
      ))}
      <li className={s.legend}>
        <span>
          <i className={s.barIntern} /> стажёры
        </span>
        <span>
          <i className={s.barMentor} /> наставники
        </span>
      </li>
    </ul>
  )
}

// Средняя оценка по всем парам, просевшие клетки залиты.
function Heat({ analytics: a }: { analytics: Analytics }) {
  const tone = (v: number | null): Tone => (v == null ? 'none' : v < 3.5 ? 'low' : v < 4.2 ? 'mid' : 'fine')
  const roles: Role[] = ['intern', 'mentor']
  const groups = roles.map((role) => ({
    role,
    rows: a.questions.filter((q) => q.role === role).map((q) => ({ id: q.question_id, text: q.text, values: q.values, delta: q.delta })),
  }))
  return <QuestionTable months={a.months} groups={groups} tone={tone} />
}

// Кто заполнил анкету за какой месяц. Месяц, за который анкет в программе ещё нет, считаем текущим сбором:
// у тех, кто не заполнил, в строке ссылка на анкету.
function Collect({ overview, months, fallback }: { overview: Overview | undefined; months: number[]; fallback: number | null }) {
  if (!overview) return <p className={s.muted}>Нет данных</p>
  const answered = (month: number) => overview.pairs.some((p) => p.cells.some((c) => c.month === month && (!c.missing.intern || !c.missing.mentor)))
  const current = months.find((m) => !answered(m)) ?? fallback
  const rows = [
    ...overview.pairs.map((p) => ({ role: 'intern' as Role, id: p.intern_id, name: personName(p.intern_name, p.intern_id), cells: p.cells, key: 'intern' as const })),
    ...overview.pairs.map((p) => ({ role: 'mentor' as Role, id: p.mentor_id, name: personName(p.mentor_name, p.mentor_id), cells: p.cells, key: 'mentor' as const })),
  ]
  return (
    <div className={s.matrixScroll}>
      <table className={s.matrix}>
        <thead>
          <tr>
            <th scope="col" className={s.mWho}>
              Кто
            </th>
            {months.map((m) => (
              <th key={m} scope="col" className={clsx(s.mMonth, m === current && s.mCurrent)}>
                {m}
              </th>
            ))}
            <th scope="col" className={s.mAct} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const has = (m: number) => {
              const c = r.cells.find((x) => x.month === m)
              return !!c && !c.missing[r.key]
            }
            return (
              <tr key={`${r.role}-${r.id}`}>
                <th scope="row" className={s.mWho}>
                  {r.name} <span className={s.mRole}>{ROLE_LABEL[r.role]}</span>
                </th>
                {months.map((m) => (
                  <td key={m} className={clsx(s.mMonth, m === current && s.mCurrent)}>
                    <i className={has(m) ? s.mFull : s.mRing} role="img" aria-label={has(m) ? 'заполнил' : 'не заполнил'} />
                  </td>
                ))}
                <td className={s.mAct}>{current != null && !has(current) && <CopyLink role={r.role} id={r.id} />}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CopyLink({ role, id }: { role: Role; id: string }) {
  const [done, setDone] = useState(false)
  const url = `${location.origin}/form?role=${role}&id=${encodeURIComponent(id)}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      window.prompt('Ссылка на анкету', url)
    }
  }
  return (
    <button type="button" className={s.copy} onClick={() => void copy()}>
      {done ? 'скопировано' : 'скопировать ссылку'}
    </button>
  )
}

// Раннее предупреждение и экономия времени HR. Минуты задаёт пользователь: своих цифр не выдумываем.
function Effect({ analytics: a }: { analytics: Analytics }) {
  const [manual, setManual] = useState(15)
  const [withTool, setWithTool] = useState(3)
  const surveysPerMonth = a.pairs * 2
  const saved = Math.max(0, ((manual - withTool) * surveysPerMonth) / 60)
  const months = a.months.length || 1
  const baseline = useMethod().data?.baseline
  return (
    <div className={s.effect}>
      <div>
        <p className={s.lead}>{leadSummary(a.effect)}</p>
        {baseline && <p className={s.baseline}>{baseline}</p>}
        <ul className={s.early}>
          {a.early.map((e) => (
            <li key={e.pair_id}>
              <Link to={`/pairs/${e.pair_id}`}>{personName(e.intern_name, e.intern_id)}</Link>
              <span>{leadLine(e)}</span>
            </li>
          ))}
          {a.early.length === 0 && <li className={s.muted}>Сигналов пока не было</li>}
        </ul>
      </div>
      <div>
        <p className={s.sub}>Время HR на анкеты</p>
        <label className={s.slider}>
          <span>
            Вручную на одну анкету <b>{manual} мин</b>
          </span>
          <input type="range" min={5} max={40} value={manual} onChange={(e) => setManual(Number(e.target.value))} />
        </label>
        <label className={s.slider}>
          <span>
            С дашбордом <b>{withTool} мин</b>
          </span>
          <input type="range" min={1} max={15} value={withTool} onChange={(e) => setWithTool(Number(e.target.value))} />
        </label>
        <p className={s.saved}>
          <b>{formatNumber(saved)} ч</b> в месяц при {surveysPerMonth} анкетах, <b>{formatNumber(saved * months)} ч</b> за {months} мес.
        </p>
      </div>
    </div>
  )
}

// Сколько стажёров получили сигнал раньше, чем средняя оценка упала ниже порога.
function leadSummary(e: Analytics['effect']): string {
  const score = formatNumber(e.baseline_score)
  const parts = [`У ${e.earlier} из ${e.pairs_with_signals} ${plural(e.pairs_with_signals, ['стажёра', 'стажёров', 'стажёров'])} сигнал появился раньше, чем средняя оценка упала ниже ${score}.`]
  if (e.avg_lead != null) parts.push(`В среднем на ${formatNumber(e.avg_lead)} мес.`)
  if (e.invisible > 0) parts.push(`У ${e.invisible} ${plural(e.invisible, ['стажёра', 'стажёров', 'стажёров'])} по средней оценке проблему не видно совсем.`)
  return parts.join(' ')
}

function leadLine(e: Analytics['early'][number]): string {
  const signal = `сигнал ${monthIn(e.first_signal_month)}`
  if (e.baseline_month == null || e.lead_months == null) return `${signal}, по средней оценке не видно`
  if (e.lead_months === 0) return `${signal}, одновременно со средней оценкой`
  const n = Math.abs(e.lead_months)
  const by = `на ${n} ${plural(n, ['месяц', 'месяца', 'месяцев'])} ${e.lead_months > 0 ? 'раньше' : 'позже'}`
  return `${signal}, по средней оценке видно ${e.baseline_month === 2 ? 'со' : 'с'} ${e.baseline_month}-го: ${by}`
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}
