// Карточка пары /pairs/:id: имя стажёра и статус, слева график и комментарии,
// справа сигналы. Описание: docs/design/v2.md, раздел «Карточка пары».
// Данные обновляются на месте после событий SSE.

import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api, ApiError } from '../../api/client'
import { queryKeys, useOverview, usePair, usePeople, useSurvey } from '../../api/queries'
import type { Overview, PairDetail, PairStatus } from '../../api/types'
import { PAIR_STATUS_LABEL, personName } from '../../lib/format'
import { Hero, QuestionTable } from '../../components'
import { useReduced, variants } from '../../lib/motion'
import { collectMonth } from '../../lib/rules'
import { BriefCard } from './BriefCard'
import { Chart } from './Chart'
import { Comments } from './Comments'
import { clearFreshMarks } from './freshMarks'
import { lowTone, neighbours, pairOrder, questionGroups } from './model'
import s from './Pair.module.css'
import { SignalList } from './SignalList'

const DEFAULT_SCALE = { min: 1, max: 5 }

export function PairPage() {
  const params = useParams()
  const id = (params.id ?? '').trim().toUpperCase()
  const pair = usePair(id)
  const overview = useOverview()

  // Открытие пары снимает её метки «новое» на обзоре (память снимает оболочка).
  useEffect(() => {
    if (id) clearFreshMarks(id)
  }, [id])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  const name = pair.data ? personName(pair.data.intern_name, pair.data.intern_id) : null
  useEffect(() => {
    if (!name) return
    const prev = document.title
    document.title = `${name}, стажировки`
    return () => {
      document.title = prev
    }
  }, [name])

  if (pair.isPending) return <Skeleton />

  if (!pair.data) {
    const missing = pair.error instanceof ApiError && pair.error.status === 404
    return (
      <div className="wrap">
        <div className={s.page}>
          <Top id={id} overview={overview.data} />
          <div className={s.stateCard}>
            <p>{missing ? 'Такой пары нет' : 'Не удалось загрузить пару'}</p>
            {missing ? (
              <Link to="/" className={s.btnBrand}>
                К обзору
              </Link>
            ) : (
              <button type="button" className={s.btnBrand} onClick={() => void pair.refetch()}>
                Повторить
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Другая пара: новый экран, график рисуется заново.
  return <PairView key={pair.data.pair_id} pair={pair.data} overview={overview.data} />
}

function PairView({ pair: p, overview }: { pair: PairDetail; overview: Overview | undefined }) {
  const survey = useSurvey()
  const people = usePeople()
  const months = survey.data?.months ?? Math.max(p.last_month, ...p.cells.map((c) => c.month))
  const scale = overview?.scale ?? survey.data?.scale ?? DEFAULT_SCALE
  const collect = collectMonth(people.data, months)
  const monthList = Array.from({ length: months }, (_, i) => i + 1)

  return (
    <>
      <Hero
        top={
          <div className={s.heroNav}>
            <Top id={p.pair_id} overview={overview} />
          </div>
        }
        title={personName(p.intern_name, p.intern_id)}
        sub={`наставник ${personName(p.mentor_name, p.mentor_id)}`}
        aside={<Status status={p.status} />}
      />
      <div className="wrap">
        <div className={s.page}>
          <BriefCard pairId={p.pair_id} />
          <div className={s.grid}>
          <div className={s.main}>
            <section className={`${s.card} ${s.chartCard}`} aria-labelledby="pair-chart">
              <h2 id="pair-chart" className={s.cardTitle}>
                Оценки по месяцам
              </h2>
              <Chart cells={p.cells} months={months} scale={scale} />
              {survey.data && (
                <div className={s.grades}>
                  <QuestionTable
                    compact
                    months={monthList}
                    groups={questionGroups(survey.data, p.series, monthList)}
                    tone={lowTone(scale, survey.data.thresholds.low_question.max_score)}
                  />
                </div>
              )}
            </section>
            <Comments pair={p} collect={collect} className={s.commentsCard} />
          </div>
          <SignalList pair={p} className={s.signalsCard} />
          </div>
        </div>
      </div>
    </>
  )
}

// Статус пары. Сменился после анкеты или отметки: новый проявляется со сдвигом.
function Status({ status }: { status: PairStatus }) {
  const reduce = useReduced()
  const first = useRef(true)
  useEffect(() => {
    first.current = false
  }, [])
  return (
    <div className={s.statusBox} aria-live="polite">
      <motion.p
        key={status}
        className={s.status}
        variants={variants.swap}
        initial={first.current || reduce ? false : 'hidden'}
        animate="shown"
      >
        <span className={s.statusDot} data-status={status} aria-hidden="true" />
        {PAIR_STATUS_LABEL[status]}
      </motion.p>
    </div>
  )
}

// «← Обзор» и справа соседние пары в порядке обзора.
function Top({ id, overview }: { id: string; overview: Overview | undefined }) {
  const qc = useQueryClient()
  const order = overview ? pairOrder(overview.pairs) : []
  const { prev, next } = neighbours(order, id)
  const nameOf = (pid: string) => {
    const x = overview?.pairs.find((q) => q.pair_id === pid)
    return x ? personName(x.intern_name, x.intern_id) : pid
  }

  // Соседей грузим заранее, чтобы переход был мгновенным.
  useEffect(() => {
    for (const n of [prev, next]) {
      if (n) void qc.prefetchQuery({ queryKey: queryKeys.pair(n), queryFn: () => api.pair(n), staleTime: 10_000 })
    }
  }, [qc, prev, next])

  return (
    <nav className={s.top} aria-label="Навигация по парам">
      <Link to="/" className={s.back}>
        <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} />
        Обзор
      </Link>
      {(prev || next) && (
        <div className={s.neigh}>
          {prev && (
            <Link to={`/pairs/${prev}`} aria-label={`Предыдущая пара: ${nameOf(prev)}`}>
              <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
              <span className={s.neighName}>{nameOf(prev)}</span>
            </Link>
          )}
          {next && (
            <Link to={`/pairs/${next}`} aria-label={`Следующая пара: ${nameOf(next)}`}>
              <span className={s.neighName}>{nameOf(next)}</span>
              <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} />
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}

// Скелет по форме экрана, пока пара грузится.
function Skeleton() {
  return (
    <div className="wrap">
      <div className={s.page} aria-busy="true" aria-label="Загрузка">
        <div className={s.top}>
          <span className={s.skel} style={{ width: 90, height: 20 }} />
        </div>
        <div className={s.head}>
          <div>
            <span className={s.skel} style={{ width: 260, height: 36 }} />
            <span className={s.skel} style={{ width: 200, height: 18, marginTop: 10 }} />
          </div>
        </div>
        <div className={s.grid}>
          <div className={s.main}>
            <div className={`${s.card} ${s.skelCard}`} style={{ height: 340 }} />
            <div className={`${s.card} ${s.skelCard}`} style={{ height: 260 }} />
          </div>
          <div className={`${s.card} ${s.skelCard}`} style={{ height: 420 }} />
        </div>
      </div>
    </div>
  )
}
