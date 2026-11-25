// Аналитика программы: общая динамика, вопросы по месяцам, темы комментариев, сбор анкет, эффект.

import clsx from 'clsx'
import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useAnalytics, useMethod, useOverview, usePeople, useSurvey } from '../../api/queries'
import type { Analytics, People, Role } from '../../api/types'
import { Avatar, Hero, LoadError, Loading, QuestionTable, Skeleton, type Tone } from '../../components'
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
  const months = Array.from({ length: Math.max(survey.data?.months ?? 0, a.months.length) }, (_, i) => i + 1)
  const collect = collectMonth(people.data, survey.data?.months ?? months.length)

  return (
    <>
      <Hero
        top={`${a.pairs} ${plural(a.pairs, ['пара', 'пары', 'пар'])} · ${overview.data?.totals.responses ?? 0} ${plural(overview.data?.totals.responses ?? 0, ['анкета', 'анкеты', 'анкет'])}`}
        title="Аналитика программы"
        aside={
          last && (
            <div className={s.kpis}>
              <Kpi label="Стажёры" value={formatNumber(last.intern)} />
              <Kpi label="Наставники" value={formatNumber(last.mentor)} />
            </div>
          )
        }
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

        <section className={s.card} id="collect">
          <h2 className={s.title}>Сбор анкет</h2>
          <Collect analytics={a} people={people.data} month={collect} />
        </section>

        <section className={clsx(s.card, s.wide)}>
          <h2 className={s.title}>Эффект</h2>
          <Effect analytics={a} />
        </section>
      </div>
    </>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.kpi}>
      <span className={s.kpiValue}>{value}</span>
      <span className={s.kpiLabel}>{label}</span>
    </div>
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

// Сколько анкет пришло по месяцам и кто ещё не заполнил текущий.
function Collect({ analytics: a, people, month }: { analytics: Analytics; people: People | undefined; month: number | null }) {
  const missing = month
    ? [
        ...(people?.interns ?? []).filter((p) => p.next_month != null && p.next_month <= month).map((p) => ({ ...p, role: 'intern' as Role })),
        ...(people?.mentors ?? []).filter((p) => p.next_month != null && p.next_month <= month).map((p) => ({ ...p, role: 'mentor' as Role })),
      ]
    : []
  return (
    <>
      <div className={s.rates}>
        {a.program.map((p) => (
          <div key={p.month} className={s.rate} title={`${p.responses} из ${p.expected}`}>
            <span className={s.rateBar}>
              <i style={{ height: `${p.expected ? (p.responses / p.expected) * 100 : 0}%` }} />
            </span>
            <span className={s.rateNum}>{p.month}</span>
          </div>
        ))}
      </div>
      {month && missing.length > 0 && (
        <>
          <p className={s.sub}>
            Не заполнили за {month}-й месяц: {missing.length}
          </p>
          <ul className={s.missing}>
            {missing.map((p) => (
              <li key={`${p.role}-${p.id}`}>
                <Avatar name={personName(p.name, p.id)} id={p.id} size={32} />
                <span className={s.missName}>
                  {personName(p.name, p.id)}
                  <small>{ROLE_LABEL[p.role]}</small>
                </span>
                <CopyLink role={p.role} id={p.id} />
              </li>
            ))}
          </ul>
        </>
      )}
      {month && missing.length === 0 && <p className={s.sub}>За {month}-й месяц заполнили все</p>}
    </>
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
      {done ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      {done ? 'Скопировано' : 'Ссылка на анкету'}
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
  const parts = [`У ${e.earlier} из ${e.pairs_with_signals} стажёров сигнал появился раньше, чем средняя оценка упала ниже ${score}.`]
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
  return `${signal}, по средней оценке видно с ${e.baseline_month}-го: ${by}`
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}
