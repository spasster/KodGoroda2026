// Обзор: «с кем поговорить на этой неделе». Итоги, таблица «пара × месяц»,
// очередь разговоров и последние анкеты. docs/design/system.md, раздел «Обзор».

import { useEffect, useMemo, useState } from 'react'

import { useOverview, usePeople, useSignals, useSurvey } from '../../api/queries'
import type { Overview, RecentItem, Role, Signal } from '../../api/types'
import { LoadError, Loading, Skeleton } from '../../components'
import { arrival, useReduced } from '../../lib/motion'
import { calendarMonthName, collectMonth, gapDirection, isOpen, sortPairsByPriority } from '../../lib/rules'
import { useLive } from '../../live/useLive'
import { useArrivals, useStaged } from './arrival'
import { Board, type RowNow } from './Board'
import { EmptyOverview } from './EmptyOverview'
import { addFresh, freshKey, pruneFresh, useFreshEntries, type FreshEntry } from './fresh'
import { chipGroups, countStatuses, responsesIn, signalsByPair, splitRecent } from './model'
import s from './Overview.module.css'
import { Queue, type QueueItem } from './Queue'
import { Recent } from './Recent'
import { Summary, type CollectInfo } from './Summary'

const ROLES: Role[] = ['intern', 'mentor']
const NO_SIGNALS: Signal[] = []

// Чернила первой загрузки играют один раз за сеанс, не при каждом возврате на обзор.
let firstLoadPlayed = false

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
  const live = useLive()
  const reduce = useReduced()
  const arrivals = useArrivals()
  const fresh = useFreshEntries()

  // Во время живого поступления итоги держат прежние значения: «Сейчас»,
  // фраза и плашки до 1,5 с, числа до 1,7 с.
  const holdNow = arrivals.holdUntil(arrival.now)
  const holdNumbers = arrivals.holdUntil(arrival.numbers)
  const ovNow = useStaged(overview.data, holdNow)
  const sigNow = useStaged(signals.data, holdNow)
  const ovNum = useStaged(overview.data, holdNumbers)
  const sigNum = useStaged(signals.data, holdNumbers)
  const peopleNum = useStaged(people.data, holdNumbers)

  const ready = !!overview.data && !signals.isPending && !people.isPending && !survey.isPending
  const [first, setFirst] = useState(() => !firstLoadPlayed && !reduce)
  useEffect(() => {
    if (!ready) return
    firstLoadPlayed = true
    if (!first) return
    const t = window.setTimeout(() => setFirst(false), 1400)
    return () => window.clearTimeout(t)
  }, [ready, first])

  // Метки «новое» из src/live переносим в localStorage, чтобы пережили перезагрузку.
  const o = overview.data
  const { last, isFreshResponse } = live
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
  const isFreshRole = (pairId: string, role: Role, month: number) =>
    freshKeys.has(freshKey(pairId, role, month)) || isFreshResponse(pairId, role, month)

  const signalByKey = useMemo(() => new Map((signals.data ?? []).map((x) => [x.key, x])), [signals.data])
  const byPairNow = useMemo(() => signalsByPair(sigNow ?? NO_SIGNALS), [sigNow])
  const signalsReady = sigNow !== undefined

  if (overview.isError && !o) {
    return (
      <div className="wrap">
        <div className={s.errorOnly}>
          <LoadError query={overview} />
        </div>
      </div>
    )
  }
  if (!ready || !o || !ovNow || !ovNum) return <OverviewSkeleton />
  if (o.totals.pairs === 0) return <EmptyOverview />

  const programMonths = survey.data?.months ?? Math.max(0, ...o.months) + 1
  const collect = collectMonth(peopleNum ?? people.data, programMonths)
  const lastMonth = Math.max(programMonths, collect ?? 0, ...o.months)
  const months = Array.from({ length: lastMonth }, (_, i) => i + 1)

  // Итоги.
  const counts = countStatuses(ovNow.pairs)
  const groups = chipGroups(ovNow.pairs, sigNow ?? NO_SIGNALS)
  const openList = (sigNum ?? NO_SIGNALS).filter(isOpen)
  const statMonth = collect ?? Math.max(0, ...ovNum.months)
  const collectInfo: CollectInfo | null =
    statMonth > 0
      ? {
          month: statMonth,
          got: responsesIn(ovNum.pairs, statMonth),
          total: ovNum.pairs.length * 2,
          calendar: calendarMonthName(statMonth, ovNum.recent),
          done: collect == null,
        }
      : null

  // «Сейчас» и строка-причина по каждой паре.
  const nowOf = (pairId: string): RowNow => {
    const p = ovNow.pairs.find((x) => x.pair_id === pairId) ?? o.pairs.find((x) => x.pair_id === pairId)!
    const sig = byPairNow(pairId)
    return {
      status: p.status,
      signals: signalsReady ? sig.active.length : p.open_signals,
      direction: gapDirection(p.cells.find((c) => c.month === p.last_month)),
      reason: sig.active[0]?.title ?? null,
    }
  }

  const isFreshCell = (pairId: string, month: number) => {
    const cell = o.pairs.find((p) => p.pair_id === pairId)?.cells.find((c) => c.month === month)
    return !!cell && ROLES.some((role) => !cell.missing[role] && isFreshRole(pairId, role, month))
  }

  // Очередь: пары с открытыми сигналами в порядке приоритета.
  const withOpen = ovNow.pairs.filter((p) => byPairNow(p.pair_id).open.length > 0)
  const queue: QueueItem[] = sortPairsByPriority(
    withOpen.map((p) => p.pair_id),
    sigNow ?? NO_SIGNALS,
  ).map((id) => {
    const pair = withOpen.find((p) => p.pair_id === id)!
    return { pair, status: pair.status, open: byPairNow(id).open }
  })

  const recent = splitRecent(o)

  return (
    <div className="wrap">
      {overview.isError && <LoadError query={overview} className={s.banner} />}
      <Summary
        counts={counts}
        groups={groups}
        open={ovNum.totals.open_signals}
        openHigh={openList.filter((x) => x.severity === 'high').length}
        collect={collectInfo}
        first={first}
      />
      <Board
        pairs={o.pairs}
        months={months}
        collect={collect}
        scale={o.scale}
        nowOf={nowOf}
        signalByKey={signalByKey}
        arrivals={arrivals}
        isFresh={isFreshCell}
        first={first}
      />
      <div className={s.lower}>
        {signals.isError && !signals.data ? (
          <section>
            <LoadError query={signals} />
          </section>
        ) : (
          <Queue items={queue} collect={collect} />
        )}
        <Recent
          live={recent.live}
          excel={recent.excel}
          collect={collect}
          collectEmpty={collect != null && responsesIn(o.pairs, collect) === 0}
          isFresh={(r: RecentItem) => isFreshRole(r.pair_id, r.role, r.month)}
        />
      </div>
    </div>
  )
}

// Загрузка: фраза, ряд плашек, числа справа и сетка таблицы.
function OverviewSkeleton() {
  return (
    <div className="wrap">
      <Loading className={s.skeleton}>
        <div className={s.skelSummary}>
          <div>
            <Skeleton width="min(620px, 80%)" height={40} />
            <div className={s.skelChips}>
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} width={78} height={44} />
              ))}
            </div>
          </div>
          <div className={s.skelStats}>
            <Skeleton width={230} height={34} />
            <Skeleton width={230} height={34} />
          </div>
        </div>
        <Skeleton width={260} height={24} />
        <div className={s.skelTable}>
          {Array.from({ length: 5 * 8 }, (_, i) => (
            <Skeleton key={i} height={72} />
          ))}
        </div>
      </Loading>
    </div>
  )
}
