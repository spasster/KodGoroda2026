// Программа: эффект, таблица «стажёр × месяц», общая динамика, вопросы по месяцам, темы комментариев, сбор анкет.

import clsx from 'clsx'
import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'

import { useAnalytics, useOverview, usePeople, useSignals, useSurvey } from '../../api/queries'
import type { Analytics, Role } from '../../api/types'
import { LoadError, Loading, PageHeader, QuestionTable, Skeleton, type Tone } from '../../components'
import { formatNumber, plural } from '../../lib/format'
import { collectMonth } from '../../lib/rules'
import { Collect } from './Collect'
import { Effect } from './Effect'
import { storyOf } from './model'
import { ProgramChart } from './ProgramChart'
import { ProgramTable } from './ProgramTable'
import s from './Analytics.module.css'

export function AnalyticsPage() {
  const analytics = useAnalytics()
  const overview = useOverview()
  const signals = useSignals({ status: 'all' })
  const people = usePeople()
  const survey = useSurvey()
  const a = analytics.data
  const o = overview.data
  const { hash } = useLocation()

  // Ссылка с якорем: блок появляется после загрузки, поэтому прокручиваем, когда данные есть.
  useEffect(() => {
    if (a && o && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [a, o, hash])

  const stories = useMemo(() => (o?.pairs ?? []).map((p) => storyOf(p, signals.data ?? [])), [o, signals.data])

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

  // Средние только по месяцам, где собраны все анкеты: средняя по одной анкете из
  // десяти выглядит как обвал программы. Неполный месяц подписываем под графиком.
  const complete = a.program.filter((p) => p.expected > 0 && p.responses >= p.expected)
  const partial = a.program.filter((p) => p.responses > 0 && p.responses < p.expected)
  const last = complete[complete.length - 1] ?? a.program[a.program.length - 1]
  const responses = o?.totals.responses ?? 0
  const programMonths = Math.max(survey.data?.months ?? 0, a.months.length)
  const months = Array.from({ length: programMonths }, (_, i) => i + 1)
  const collect = collectMonth(people.data, survey.data?.months ?? months.length)
  // Месяцы, за которые есть хоть одна оценка.
  const dataMonths = o ? o.months.filter((m) => o.pairs.some((p) => p.cells.some((c) => c.month === m && (c.intern_index != null || c.mentor_index != null)))) : []

  return (
    <>
      <PageHeader
        title="Программа"
        facts={[
          `${a.pairs} ${plural(a.pairs, ['пара', 'пары', 'пар'])}`,
          `${responses} ${plural(responses, ['анкета', 'анкеты', 'анкет'])}`,
          last && `средняя за ${last.month}-й месяц: стажёров ${formatNumber(last.intern)}`,
          last && `наставников ${formatNumber(last.mentor)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      />
      <div className={clsx('wrap', s.page)}>
        <Effect analytics={a} />

        <section className={clsx(s.card, s.full)}>
          <span className="overline">Все пары</span>
          <h2 className={s.title}>Стажёр × месяц</h2>
          {o ? (
            <ProgramTable stories={stories} months={dataMonths} collect={collect} scale={o.scale} baseline={a.effect.baseline_score} />
          ) : overview.isError ? (
            <LoadError query={overview} />
          ) : (
            <Skeleton height={240} radius="var(--r-m)" />
          )}
        </section>

        <section className={clsx(s.card, s.wide)}>
          <span className="overline">Динамика</span>
          <h2 className={s.title}>Средняя оценка по месяцам</h2>
          <div className={s.scrollX}>
            <ProgramChart points={complete.length ? complete : a.program} months={months} scale={a.scale} />
          </div>
          {complete.length > 0 &&
            partial.map((p) => (
              <p key={p.month} className={s.chartNote}>
                {p.month}-й месяц не показан: собрано {p.responses} из {p.expected} анкет.
              </p>
            ))}
        </section>

        <section className={s.card}>
          <span className="overline">Комментарии</span>
          <h2 className={s.title}>О чём пишут</h2>
          <Topics topics={a.topics} />
        </section>

        <section className={clsx(s.card, s.full)}>
          <span className="overline">Опросник</span>
          <h2 className={s.title}>Вопросы по месяцам</h2>
          <div className={s.scrollX}>
            <Heat analytics={a} />
          </div>
        </section>

        <section className={clsx(s.card, s.full)} id="collect">
          <span className="overline">Анкеты</span>
          <h2 className={s.title}>Сбор анкет</h2>
          <Collect overview={o} months={months} fallback={collect} />
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
    <>
      <p className={s.legend}>
        <span>
          <i className={s.barIntern} /> стажёры
        </span>
        <span>
          <i className={s.barMentor} /> наставники
        </span>
      </p>
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
      </ul>
    </>
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

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}
