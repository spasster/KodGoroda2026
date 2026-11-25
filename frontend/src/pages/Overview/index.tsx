// Обзор «Истории»: герой с главным числом и карточки стажёров.

import { QrCode } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

import { useOverview, usePeople, useSignals, useSurvey } from '../../api/queries'
import type { Overview, Role } from '../../api/types'
import { Hero, LoadError, Loading, Skeleton } from '../../components'
import { calendarMonthName, collectMonth } from '../../lib/rules'
import { useLive } from '../../live/useLive'
import { EmptyOverview } from './EmptyOverview'
import { addFresh, freshKey, pruneFresh, useFreshEntries, type FreshEntry } from './fresh'
import { responsesIn, sortStories, storyOf } from './model'
import s from './Overview.module.css'
import { Stories } from './Stories'
import h from './Stories.module.css'

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

  const dataEnd = o ? Math.max(0, ...o.months) : 0
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
  if (!o || people.isPending || survey.isPending) return <OverviewSkeleton />
  if (o.totals.pairs === 0) return <EmptyOverview />

  const programMonths = survey.data?.months ?? dataEnd + 1
  const collect = collectMonth(people.data, programMonths)
  const months = Array.from({ length: Math.max(programMonths, collect ?? 0, dataEnd) }, (_, i) => i + 1)
  const month = collect ?? dataEnd
  const calendar = month > 0 ? calendarMonthName(month, o.recent) : null

  const total = o.pairs.length
  const risk = stories.filter((st) => st.status === 'risk').length
  const got = month > 0 ? responsesIn(o.pairs, month) : 0

  return (
    <>
      <Hero
        top={month > 0 ? `${calendar ? `${capitalize(calendar)} · ` : ''}${month}-й месяц стажировки` : undefined}
        title={
          risk === 0 ? (
            'Все стажировки идут ровно'
          ) : (
            <>
              <em>
                {risk} из {total}
              </em>{' '}
              {total === 1 ? 'стажёра' : 'стажёров'} {risk === 1 ? 'ждёт' : 'ждут'} разговора
            </>
          )
        }
        aside={
          <div className={h.collect}>
            <div className={h.collectLine}>
              Анкеты за месяц
              <span className={h.collectNum}>
                {got} из {total * 2}
              </span>
            </div>
            <div className={h.bar}>
              <div className={h.barFill} style={{ width: `${total ? (got / (total * 2)) * 100 : 0}%` }} />
            </div>
            {got < total * 2 && (
              <Link to="/analytics#collect" className={h.missing}>
                Кто не заполнил
              </Link>
            )}
            <Link to="/form/qr" className={h.qr}>
              <QrCode size={18} aria-hidden="true" />
              QR-код анкеты
            </Link>
          </div>
        }
      />
      <div className="wrap">
        {overview.isError && <LoadError query={overview} className={s.error} />}
        <Stories stories={stories} months={months} scale={o.scale} isFresh={(id) => freshPairs.has(id)} />
      </div>
    </>
  )
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function OverviewSkeleton() {
  return (
    <div className="wrap">
      <Loading className={s.skeleton}>
        <Skeleton width={420} height={56} />
        <div className={s.skelCards}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={220} radius="var(--r-card)" />
          ))}
        </div>
      </Loading>
    </div>
  )
}
