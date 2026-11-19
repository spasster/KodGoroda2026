// Обзор «Истории»: герой с главным числом и карточки стажёров.
// Кнопка «Показать динамику» проигрывает месяцы: линии растут, карточки переезжают между группами.

import { Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useOverview, usePeople, useSignals, useSurvey, useThresholds } from '../../api/queries'
import type { Overview, Role } from '../../api/types'
import { LoadError, Loading, Skeleton } from '../../components'
import { calendarMonthName, collectMonth } from '../../lib/rules'
import { useLive } from '../../live/useLive'
import { EmptyOverview } from './EmptyOverview'
import { addFresh, freshKey, pruneFresh, useFreshEntries, type FreshEntry } from './fresh'
import { responsesIn, sortStories, storyOf } from './model'
import s from './Overview.module.css'
import { Stories } from './Stories'
import h from './Stories.module.css'

const ROLES: Role[] = ['intern', 'mentor']
const STEP_MS = 1400

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
  const thresholds = useThresholds()
  const { last, isFreshResponse } = useLive()
  const fresh = useFreshEntries()
  // Проигрывание: месяц, на котором стоим; null — показываем как есть.
  const [play, setPlay] = useState<number | null>(null)

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
  useEffect(() => {
    if (play == null) return
    const id = setTimeout(() => setPlay(play >= dataEnd ? null : play + 1), play >= dataEnd ? STEP_MS * 1.5 : STEP_MS)
    return () => clearTimeout(id)
  }, [play, dataEnd])

  const freshPairs = useMemo(() => new Set(fresh.map((e) => e.key.split(':')[0])), [fresh])
  const stories = useMemo(
    () => sortStories((o?.pairs ?? []).map((p) => storyOf(p, signals.data ?? [], play, thresholds.active_months))),
    [o, signals.data, play, thresholds.active_months],
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
  const eyebrow =
    play != null
      ? `Месяц ${play} из ${dataEnd}`
      : `${calendar ? `${capitalize(calendar)} · ` : ''}${month}-й месяц · анкет ${responsesIn(o.pairs, month)} из ${total * 2}`

  return (
    <>
      <section className={h.hero}>
        <div className={`wrap ${h.heroIn}`}>
          <div>
            <p className={h.eyebrow}>{eyebrow}</p>
            <h1 className={h.headline}>
              {risk === 0 ? (
                'Все стажировки идут ровно'
              ) : (
                <>
                  <em>
                    {risk} из {total}
                  </em>{' '}
                  {total === 1 ? 'стажёра' : 'стажёров'} {risk === 1 ? 'ждёт' : 'ждут'} разговора
                </>
              )}
            </h1>
          </div>
          {dataEnd > 1 && (
            <div className={h.playBox}>
              <button type="button" className={h.play} onClick={() => setPlay(play == null ? 1 : null)}>
                {play == null ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
                {play == null ? 'Показать динамику' : 'Остановить'}
              </button>
              <div className={h.pips} aria-hidden="true">
                {Array.from({ length: dataEnd }, (_, i) => (
                  <i key={i} className={`${h.pip} ${play == null || i < play ? h.pipOn : ''}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      <div className="wrap">
        {overview.isError && <LoadError query={overview} className={s.error} />}
        <Stories stories={stories} months={months} scale={o.scale} upto={play} isFresh={(id) => play == null && freshPairs.has(id)} />
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
