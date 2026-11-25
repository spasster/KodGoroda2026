// «Разговоры»: первый экран HR. Работа HR раз в месяц: понять, с кем говорить,
// о чём, и потом записать итог. Сверху графитовая лента с итогом месяца и
// эффектом, ниже карточки «Пора поговорить», строки «Присмотреться» и короткое
// «Всё ровно». Таблица «стажёр × месяц» живёт на экране «Программа».

import clsx from 'clsx'
import { ArrowRight, QrCode } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

import { useAnalytics, useOverview, usePeople, useSignals, useSurvey } from '../../api/queries'
import type { Analytics, Overview, Role } from '../../api/types'
import { Dot } from '../../app/status'
import { LoadError, Loading, Skeleton } from '../../components'
import { formatNumber, personName, plural } from '../../lib/format'
import { byModelOnly, calendarMonthName, collectMonth, situationMonths } from '../../lib/rules'
import { useLive } from '../../live/useLive'
import { explanationLine } from '../Pair/model'
import { EmptyOverview } from './EmptyOverview'
import { addFresh, freshKey, pruneFresh, useFreshEntries, type FreshEntry } from './fresh'
import { responsesIn, sortStories, storyOf, type Story } from './model'
import { StoryChart } from './StoryChart'
import s from './Talks.module.css'

const ROLES: Role[] = ['intern', 'mentor']

function hasResponse(o: Overview, key: string): boolean {
  const [pairId, role, month] = key.split(':')
  const cell = o.pairs.find((p) => p.pair_id === pairId)?.cells.find((c) => c.month === Number(month))
  return !!cell && (role === 'intern' || role === 'mentor') && !cell.missing[role]
}

export function OverviewPage() {
  const overview = useOverview()
  const signals = useSignals({ status: 'all' })
  const people = usePeople()
  const survey = useSurvey()
  const analytics = useAnalytics()
  const { last, isFreshResponse } = useLive()
  const fresh = useFreshEntries()

  // Метки «новая анкета» из src/live переносим в localStorage, чтобы пережили перезагрузку.
  const o = overview.data
  useEffect(() => {
    if (!o) return
    const add: FreshEntry[] = []
    for (const p of o.pairs) {
      for (const c of p.cells) {
        for (const role of ROLES) {
          if (!c.missing[role] && isFreshResponse(p.pair_id, role, c.month)) add.push({ key: freshKey(p.pair_id, role, c.month), at: Date.now() })
        }
      }
    }
    if (last && isFreshResponse(last.pair_id, last.role, last.month)) {
      add.push({ key: freshKey(last.pair_id, last.role, last.month), at: Date.parse(last.at) })
    }
    addFresh(add)
    pruneFresh((key) => hasResponse(o, key), overview.dataUpdatedAt)
  }, [o, overview.dataUpdatedAt, last, isFreshResponse])

  const freshPairs = useMemo(() => new Set(fresh.map((e) => e.key.split(':')[0])), [fresh])
  const stories = useMemo(
    () => sortStories((o?.pairs ?? []).map((p) => storyOf(p, signals.data ?? []))),
    [o, signals.data],
  )

  if (overview.isError && !o) {
    return (
      <div className="wrap">
        <LoadError query={overview} className={s.error} />
      </div>
    )
  }
  if (!o || people.isPending || survey.isPending) return <TalksSkeleton />
  if (o.totals.pairs === 0) return <EmptyOverview />

  const dataEnd = Math.max(0, ...o.months)
  const programMonths = survey.data?.months ?? dataEnd + 1
  const collect = collectMonth(people.data, programMonths)
  const month = collect ?? dataEnd
  const calendar = month > 0 ? calendarMonthName(month, o.recent) : null
  const total = o.pairs.length
  const got = month > 0 ? responsesIn(o.pairs, month) : 0
  const months = Array.from({ length: Math.max(dataEnd, 2) }, (_, i) => i + 1)

  const risk = stories.filter((st) => st.status === 'risk')
  const watch = stories.filter((st) => st.status === 'watch')
  const ok = stories.filter((st) => st.status === 'ok')

  return (
    <>
      <Hero
        total={total}
        risk={risk.length}
        month={month}
        calendar={calendar}
        got={got}
        expected={total * 2}
        collecting={collect != null}
        analytics={analytics.data}
      />
      <div className="wrap">
        {overview.isError && <LoadError query={overview} className={s.error} />}

        {risk.length > 0 && (
          <section className={s.section} aria-labelledby="talks-risk">
            <div className={s.sectionHead}>
              <h2 id="talks-risk" className={s.sectionTitle}>
                <Dot status="risk" />
                Пора поговорить
              </h2>
              <p className={s.legend} aria-hidden="true">
                <span><i className={s.keyIntern} /> стажёр</span>
                <span><i className={s.keyMentor} /> наставник</span>
              </p>
            </div>
            <ul className={s.cards}>
              {risk.map((st) => (
                <TalkCard key={st.pair.pair_id} story={st} months={months} scale={o.scale} fresh={freshPairs.has(st.pair.pair_id)} />
              ))}
            </ul>
          </section>
        )}

        {watch.length > 0 && (
          <section className={s.section} aria-labelledby="talks-watch">
            <h2 id="talks-watch" className={s.sectionTitle}>
              <Dot status="watch" />
              Присмотреться
            </h2>
            <ul className={s.rows}>
              {watch.map((st) => (
                <WatchRow key={st.pair.pair_id} story={st} fresh={freshPairs.has(st.pair.pair_id)} />
              ))}
            </ul>
          </section>
        )}

        {ok.length > 0 && (
          <section className={s.section} aria-labelledby="talks-ok">
            <h2 id="talks-ok" className={s.sectionTitle}>
              <Dot status="ok" />
              Всё ровно
            </h2>
            <p className={s.okLine}>
              {ok.map((st, i) => (
                <span key={st.pair.pair_id}>
                  {i > 0 && ', '}
                  <Link to={`/pairs/${st.pair.pair_id}`}>{personName(st.pair.intern_name, st.pair.intern_id)}</Link>
                </span>
              ))}
              <span className={s.okNote}>. Сигналов нет, но в именной анкете пишут не обо всём.</span>
            </p>
          </section>
        )}

        <p className={s.more}>
          <Link to="/analytics">
            Все стажёры по месяцам и эффект
            <ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} />
          </Link>
        </p>
      </div>
    </>
  )
}

// ---------- Графитовая лента ----------

interface HeroProps {
  total: number
  risk: number
  month: number
  calendar: string | null
  got: number
  expected: number
  collecting: boolean
  analytics: Analytics | undefined
}

function Hero({ total, risk, month, calendar, got, expected, collecting, analytics }: HeroProps) {
  const title =
    risk === 0
      ? 'Все стажёры в порядке'
      : `${risk} из ${total} ${total === 1 ? 'стажёра' : 'стажёров'} ${risk === 1 ? 'ждёт' : 'ждут'} разговора`
  const over = [calendar, month > 0 ? `${month}-й месяц` : null].filter(Boolean).join(' · ')

  // Средняя по программе: то, на что HR смотрит без дашборда. Берём последний
  // месяц, где собраны все анкеты: средняя по одной анкете из десяти врёт.
  const program = analytics?.program.filter((p) => p.intern != null || p.mentor != null) ?? []
  const complete = program.filter((p) => p.expected > 0 && p.responses >= p.expected)
  const lastAvg = complete[complete.length - 1] ?? program[program.length - 1]
  const avg = lastAvg ? mean([lastAvg.intern, lastAvg.mentor]) : null
  const effect = analytics?.effect
  const baseline = effect?.baseline_score ?? null

  return (
    <section className={s.hero} aria-labelledby="talks-title">
      <div className={clsx('wrap', s.heroInner)}>
        <div className={s.heroHead}>
          {over && <span className={clsx('overline', s.heroOver)}>{over}</span>}
          <h1 id="talks-title" className={s.heroTitle}>
            {title}
          </h1>
          <p className={s.heroCollect}>
            {collecting ? (
              <>
                Анкеты за {month}-й месяц: {got} из {expected}
                {got < expected && (
                  <>
                    {' · '}
                    <Link to="/analytics#collect">кто не заполнил</Link>
                  </>
                )}
              </>
            ) : (
              'Все анкеты программы собраны'
            )}
          </p>
          <Link to="/form/qr" className={s.heroQr}>
            <QrCode aria-hidden="true" size={18} strokeWidth={1.8} />
            QR-код анкеты
          </Link>
        </div>

        <dl className={s.kpis}>
          {avg != null && lastAvg && baseline != null && (
            <div className={s.kpi}>
              <dt className={s.kpiLabel}>
                средняя оценка за {lastAvg.month}-й месяц. {avg >= baseline ? 'По ней тревоги нет' : `Ниже порога ${formatNumber(baseline)}`}
              </dt>
              <dd className={s.kpiValue}>{formatNumber(avg)}</dd>
            </div>
          )}
          <div className={s.kpi}>
            <dt className={s.kpiLabel}>{risk === 1 ? 'стажёр ждёт' : 'стажёров ждут'} разговора по сигналам</dt>
            <dd className={s.kpiValue}>
              {risk}
              <span className={s.kpiOf}> из {total}</span>
            </dd>
          </div>
          {effect && effect.avg_lead != null && effect.earlier > 0 && (
            <div className={s.kpi}>
              <dt className={s.kpiLabel}>
                раньше видим проблему, чем по средней ниже {formatNumber(effect.baseline_score)}. У {effect.earlier} из{' '}
                {effect.pairs_with_signals} {plural(effect.pairs_with_signals, ['стажёра', 'стажёров', 'стажёров'])}
              </dt>
              <dd className={s.kpiValue}>
                <span className={s.kpiOf}>на </span>
                {formatNumber(effect.avg_lead)}
                <span className={s.kpiOf}> мес.</span>
              </dd>
            </div>
          )}
        </dl>
      </div>
      <Trace />
    </section>
  )
}

// Светящаяся синяя линия по низу ленты, как трасса на studchamp.mgts.ru.
function Trace() {
  return (
    <svg className={s.trace} viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true">
      <path className={s.traceLine} d="M0 21 H600 Q612 21 618 15 L626 7 Q632 2 644 2 H1000" pathLength={1} />
    </svg>
  )
}

function mean(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

// ---------- Карточки ----------

function TalkCard({ story, months, scale, fresh }: { story: Story; months: number[]; scale: Overview['scale']; fresh: boolean }) {
  const { pair, main, active } = story
  const quote = main?.quotes[0]
  return (
    <li className={s.card} data-status={story.status}>
      <Link to={`/pairs/${pair.pair_id}`} className={s.cardLink}>
        <span className={s.cardHead}>
          <span className={s.cardName}>{personName(pair.intern_name, pair.intern_id)}</span>
          {fresh && <span className={s.newTag}>новая анкета</span>}
        </span>
        <span className={s.cardMentor}>наставник {personName(pair.mentor_name, pair.mentor_id)}</span>
        {main && (
          <>
            <span className={s.reason}>{main.title}</span>
            <span className={s.reasonLine}>
              {explanationLine(main)} <span className={s.when}>{situationMonths(main)}</span>
            </span>
            {quote && (
              <span className={s.quote}>
                {byModelOnly(main) && <span className={s.ai}>ИИ нашёл в комментарии</span>}
                <span className={s.quoteText}>«{trimQuote(quote.text)}»</span>
              </span>
            )}
          </>
        )}
        <span className={s.cardChart}>
          <StoryChart cells={pair.cells} months={months} scale={scale} status={story.status} compact />
        </span>
        <span className={s.cardFoot}>
          <span className={s.cardMore}>{active > 1 ? `ещё ${active - 1} ${plural(active - 1, ['повод', 'повода', 'поводов'])}` : ''}</span>
          <span className={s.prepare}>
            Готовиться к разговору
            <ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} />
          </span>
        </span>
      </Link>
    </li>
  )
}

function WatchRow({ story, fresh }: { story: Story; fresh: boolean }) {
  const { pair, main } = story
  return (
    <li>
      <Link to={`/pairs/${pair.pair_id}`} className={s.row}>
        <span className={s.rowWho}>
          <span className={s.rowName}>{personName(pair.intern_name, pair.intern_id)}</span>
          <span className={s.rowMentor}>наставник {personName(pair.mentor_name, pair.mentor_id)}</span>
        </span>
        <span className={s.rowWhat}>
          {main?.title ?? 'Есть повод присмотреться'}
          {main && <span className={s.when}> · {situationMonths(main)}</span>}
          {main && byModelOnly(main) && <span className={s.aiInline}>ИИ нашёл в комментарии</span>}
        </span>
        {fresh && <span className={s.newTag}>новая анкета</span>}
        <ArrowRight className={s.rowArrow} aria-hidden="true" size={18} strokeWidth={1.8} />
      </Link>
    </li>
  )
}

// Длинная цитата на карточке обрезается по слову.
function trimQuote(text: string, max = 140): string {
  const t = text.trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

function TalksSkeleton() {
  return (
    <>
      <div className={s.hero}>
        <div className={clsx('wrap', s.heroInner)}>
          <Loading className={s.skeleton}>
            <Skeleton width={420} height={40} />
          </Loading>
        </div>
      </div>
      <div className="wrap">
        <Loading className={s.skeleton}>
          <div className={s.cards}>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height={320} radius="var(--r-card)" />
            ))}
          </div>
        </Loading>
      </div>
    </>
  )
}
