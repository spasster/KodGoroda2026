// Обзор (docs/design/v2.md, «Обзор»): заголовок — месяц сбора, четыре итога
// и таблица пар по месяцам. Больше на обзоре ничего нет.

import { useEffect, useMemo, useState } from 'react'

import { useOverview, usePeople, useSignals, useSurvey } from '../../api/queries'
import type { Overview, PairStatus, Role } from '../../api/types'
import { LoadError, Loading, Skeleton } from '../../components'
import { calendarMonthName, collectMonth } from '../../lib/rules'
import { useLive } from '../../live/useLive'
import { EmptyOverview } from './EmptyOverview'
import { addFresh, freshKey, pruneFresh, useFreshEntries, type FreshEntry } from './fresh'
import { mainTitles, responsesIn, rowOrder } from './model'
import s from './Overview.module.css'
import { PairsTable } from './PairsTable'
import { Totals } from './Totals'

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
  const [filter, setFilter] = useState<PairStatus | null>(null)

  // Метки «новое» из src/live переносим в localStorage, чтобы пережили перезагрузку.
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
    // Последняя анкета может ещё не дойти до обзора: помечаем её временем события.
    if (last && isFreshResponse(last.pair_id, last.role, last.month)) {
      add.push({ key: freshKey(last.pair_id, last.role, last.month), at: Date.parse(last.at) })
    }
    addFresh(add)
    pruneFresh((key) => hasResponse(o, key), overview.dataUpdatedAt)
  }, [o, overview.dataUpdatedAt, last, isFreshResponse])

  const freshKeys = useMemo(() => new Set(fresh.map((e) => e.key)), [fresh])
  const titles = useMemo(() => mainTitles(signals.data ?? []), [signals.data])

  if (overview.isError && !o) {
    return (
      <div className="wrap">
        <LoadError query={overview} className={s.error} />
      </div>
    )
  }
  if (!o || people.isPending || survey.isPending) return <OverviewSkeleton />
  if (o.totals.pairs === 0) return <EmptyOverview />

  const programMonths = survey.data?.months ?? Math.max(0, ...o.months) + 1
  const collect = collectMonth(people.data, programMonths)
  const lastMonth = Math.max(programMonths, collect ?? 0, ...o.months)
  const months = Array.from({ length: lastMonth }, (_, i) => i + 1)
  // Месяц сбора; когда собрано всё, последний месяц программы.
  const month = collect ?? Math.max(0, ...o.months)
  const calendar = month > 0 ? calendarMonthName(month, o.recent) : null

  const counts: Record<PairStatus, number> = { risk: o.totals.risk, watch: o.totals.watch, ok: o.totals.ok }
  const order = rowOrder(o.pairs, o.totals.responses)
  const byId = new Map(o.pairs.map((p) => [p.pair_id, p]))
  const rows = order.flatMap((id) => {
    const p = byId.get(id)
    return p && (!filter || p.status === filter) ? [p] : []
  })

  const isFresh = (pairId: string, month: number) => {
    const cell = byId.get(pairId)?.cells.find((c) => c.month === month)
    return (
      !!cell &&
      ROLES.some((role) => !cell.missing[role] && (freshKeys.has(freshKey(pairId, role, month)) || isFreshResponse(pairId, role, month)))
    )
  }

  return (
    <div className="wrap">
      {overview.isError && <LoadError query={overview} className={s.error} />}
      <header className={s.head}>
        <h1 className={s.title}>Обзор</h1>
        {month > 0 && <span className={s.when}>{calendar ? `${capitalize(calendar)} · ` : ''}{month}-й месяц</span>}
      </header>
      <Totals
        counts={counts}
        filter={filter}
        onFilter={(st) => setFilter((f) => (f === st ? null : st))}
        month={month}
        got={month > 0 ? responsesIn(o.pairs, month) : 0}
        total={o.pairs.length * 2}
      />
      <PairsTable pairs={rows} months={months} collect={collect} titles={titles} isFresh={isFresh} />
    </div>
  )
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function OverviewSkeleton() {
  return (
    <div className="wrap">
      <Loading className={s.skeleton}>
        <Skeleton width={220} height={36} />
        <div className={s.skelCards}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={120} radius="var(--r-card)" />
          ))}
        </div>
        <Skeleton height={360} radius="var(--r-card)" />
      </Loading>
    </div>
  )
}
