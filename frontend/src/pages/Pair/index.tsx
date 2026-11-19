// Карточка пары /pairs/:id: шапка со статусом, график и блок разрыва, сигналы,
// ответы по вопросам и комментарии по месяцам. Описание: system.md, раздел
// «Карточка пары (/pairs/:id)». Данные обновляются на месте после событий SSE.

import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api, ApiError } from '../../api/client'
import { queryKeys, useOverview, usePair, usePeople, useSurvey } from '../../api/queries'
import type { Overview, PairDetail, PairStatus } from '../../api/types'
import {
  EmptyState,
  LinkButton,
  LoadError,
  Loading,
  PairChip,
  RoleMark,
  SectionHead,
  Skeleton,
  StatusLabel,
  StatusSign,
} from '../../components'
import { PAIR_STATUS_LABEL } from '../../lib/format'
import { useReduced, variants } from '../../lib/motion'
import { calendarMonthName, collectMonth } from '../../lib/rules'
import { Comments } from './Comments'
import { clearFreshMarks } from './freshMarks'
import { GapBox } from './GapBox'
import { Heatmap } from './Heatmap'
import { neighbours, statusLine } from './model'
import s from './Pair.module.css'
import { ChartLegend, PairChart } from './PairChart'
import { PairSignals } from './PairSignals'

const DEFAULT_SCALE = { min: 1, max: 5 }

export function PairPage() {
  const params = useParams()
  const id = (params.id ?? '').trim().toUpperCase()
  const pair = usePair(id)
  const overview = useOverview()

  // Открытие пары снимает метки «новое» её клеток на обзоре (память снимает оболочка).
  useEffect(() => {
    if (id) clearFreshMarks(id)
  }, [id])

  // Новая пара открывается сверху, как новая страница.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    document.title = `${id}, Сверка`
    return () => {
      document.title = 'Сверка'
    }
  }, [id])

  if (pair.isPending) {
    return (
      <div className="wrap">
        <PairSkeleton />
      </div>
    )
  }

  if (!pair.data) {
    if (pair.error instanceof ApiError && pair.error.status === 404) return <NoPair id={id} overview={overview.data} />
    return (
      <div className="wrap">
        <Crumbs id={id} />
        <LoadError query={pair} className={s.loadError} />
      </div>
    )
  }

  // Другая пара: новый экран, график рисуется заново.
  return <PairView key={pair.data.pair_id} pair={pair.data} overview={overview.data} refresh={pair} />
}

function PairView({
  pair: p,
  overview,
  refresh,
}: {
  pair: PairDetail
  overview: Overview | undefined
  refresh: Parameters<typeof LoadError>[0]['query'] & { isError: boolean }
}) {
  const survey = useSurvey()
  const people = usePeople()
  const months = survey.data?.months ?? Math.max(p.last_month, ...p.cells.map((c) => c.month))
  const scale = overview?.scale ?? survey.data?.scale ?? DEFAULT_SCALE
  const collect = collectMonth(people.data, months)
  const monthName = (m: number) => (overview ? calendarMonthName(m, overview.recent) : null)

  return (
    <div className="wrap">
      <Crumbs id={p.pair_id} overview={overview} />
      {refresh.isError && <LoadError query={refresh} className={s.loadError} />}

      <header className={s.top}>
        <h1 className={s.id}>{p.pair_id}</h1>
        <div className={s.people}>
          <span>
            <RoleMark role="intern" />
            Стажёр <b>{p.intern_id}</b>
          </span>
          <span>
            <RoleMark role="mentor" />
            Наставник <b>{p.mentor_id}</b>
          </span>
        </div>
        <PairStatusBlock status={p.status} line={statusLine(p.signals)} />
      </header>

      <div className={s.grid}>
        <section aria-labelledby="chart-h" className={s.chartCol}>
          <SectionHead id="chart-h" title="Средняя оценка по месяцам" aside={<ChartLegend />} />
          <PairChart pair={p} months={months} scale={scale} collect={collect} monthName={monthName} />
        </section>
        <GapBox pair={p} scale={scale} collect={collect} survey={survey.data} />
      </div>

      <PairSignals pair={p} />
      {survey.data && <Heatmap pair={p} survey={survey.data} scale={scale} months={months} collect={collect} />}
      <Comments pair={p} collect={collect} />
    </div>
  )
}

// Статус справа в шапке. Сменился после анкеты или отметки: новое проявляется
// со сдвигом 6px, как колонка «Сейчас» на обзоре.
function PairStatusBlock({ status, line }: { status: PairStatus; line: string }) {
  const reduce = useReduced()
  const first = useRef(true)
  useEffect(() => {
    first.current = false
  }, [])
  return (
    <div className={s.status} aria-live="polite">
      <motion.div
        key={`${status}:${line}`}
        variants={variants.swap}
        initial={first.current || reduce ? false : 'hidden'}
        animate="shown"
      >
        <StatusLabel status={status} size="l" />
        <p>{line}</p>
      </motion.div>
    </div>
  )
}

// «Обзор / P-03» и справа переход к соседним парам.
function Crumbs({ id, overview }: { id: string; overview?: Overview }) {
  const qc = useQueryClient()
  const ids = overview?.pairs.map((x) => x.pair_id) ?? []
  const { prev, next } = neighbours(ids, id)
  const statusOf = (pid: string) => overview?.pairs.find((x) => x.pair_id === pid)?.status ?? 'ok'

  // Соседей грузим заранее, чтобы переход был мгновенным, без пустого экрана.
  useEffect(() => {
    for (const n of [prev, next]) {
      if (n) void qc.prefetchQuery({ queryKey: queryKeys.pair(n), queryFn: () => api.pair(n), staleTime: 10_000 })
    }
  }, [qc, prev, next])

  return (
    <div className={s.crumbsRow}>
      <nav className={s.crumbs} aria-label="Путь">
        <Link to="/">Обзор</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{id}</span>
      </nav>
      {(prev || next) && (
        <nav className={s.neigh} aria-label="Соседние пары">
          {prev && (
            <Link to={`/pairs/${prev}`} aria-label={`Предыдущая пара ${prev}, ${PAIR_STATUS_LABEL[statusOf(prev)].toLowerCase()}`}>
              <ArrowLeft aria-hidden="true" strokeWidth={1.8} />
              {prev}
              <StatusSign status={statusOf(prev)} small />
            </Link>
          )}
          {next && (
            <Link to={`/pairs/${next}`} aria-label={`Следующая пара ${next}, ${PAIR_STATUS_LABEL[statusOf(next)].toLowerCase()}`}>
              <StatusSign status={statusOf(next)} small />
              {next}
              <ArrowRight aria-hidden="true" strokeWidth={1.8} />
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}

// Пары нет: 404 от бэкенда. Рядом плашки тех пар, что есть.
function NoPair({ id, overview }: { id: string; overview: Overview | undefined }) {
  const pairs = overview?.pairs ?? []
  return (
    <div className="wrap">
      <Crumbs id={id} />
      <EmptyState
        className={s.noPair}
        title={`Пары ${id} нет`}
        text="Проверьте ID или вернитесь к обзору."
        actions={<LinkButton to="/">К обзору</LinkButton>}
      />
      {pairs.length > 0 && (
        <div className={s.noPairList}>
          <p>Пары в программе</p>
          <div className={s.chips}>
            {[...pairs]
              .sort((a, b) => a.pair_id.localeCompare(b.pair_id))
              .map((x) => (
                <PairChip key={x.pair_id} pairId={x.pair_id} status={x.status} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Скелет по форме экрана: путь, шапка, график и блок разрыва.
function PairSkeleton() {
  return (
    <Loading className={s.skeleton}>
      <Skeleton width={110} height={16} />
      <div className={s.skelTop}>
        <Skeleton width={176} height={58} />
        <div className={s.skelPeople}>
          <Skeleton width={150} height={20} />
          <Skeleton width={180} height={20} />
        </div>
        <div className={s.skelStatus}>
          <Skeleton width={200} height={24} />
          <Skeleton width={290} height={18} />
        </div>
      </div>
      <div className={s.grid}>
        <div className={s.skelCol}>
          <Skeleton width={280} height={24} />
          <Skeleton height={300} />
        </div>
        <div className={s.skelCol}>
          <Skeleton width={150} height={64} />
          <Skeleton height={72} />
          <Skeleton width={260} height={32} />
          <Skeleton height={150} />
        </div>
      </div>
    </Loading>
  )
}
