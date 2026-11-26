// Карточка пары /pairs/:id: имя стажёра и статус, слева график и комментарии,
// справа сигналы. Описание: docs/design/v2.md, раздел «Карточка пары».
// Данные обновляются на месте после событий SSE.

import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api, ApiError } from '../../api/client'
import { queryKeys, useBrief, useOverview, usePair, usePeople, useSurvey } from '../../api/queries'
import type { Overview, PairDetail, PairStatus } from '../../api/types'
import { StatusText } from '../../app/status'
import { personName } from '../../lib/format'
import { PageHeader, QuestionTable } from '../../components'
import { useReduced, variants } from '../../lib/motion'
import { collectMonth } from '../../lib/rules'
import { Chart } from './Chart'
import { Comments } from './Comments'
import { clearFreshMarks } from './freshMarks'
import { hasData, neighbours, openSignals, pairedGroups, pairOrder, questionGroups, scoreTone } from './model'
import { Outcome } from './Outcome'
import s from './Pair.module.css'
import { Questions, Topics } from './Talk'
import t from './Talk.module.css'

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
    document.title = `${name} · Стажировка МГТС`
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
  const programMonths = survey.data?.months ?? Math.max(p.last_month, ...p.cells.map((c) => c.month))
  const scale = overview?.scale ?? survey.data?.scale ?? DEFAULT_SCALE
  const collect = collectMonth(people.data, programMonths)
  // На графике и в таблице только месяцы с анкетами: пустой хвост выглядит как обрыв.
  const dataEnd = Math.max(1, ...p.cells.filter(hasData).map((c) => c.month))
  const monthList = Array.from({ length: dataEnd }, (_, i) => i + 1)
  // Отметки на оси: месяцы, с которых тянутся открытые поводы.
  const marks = openSignals(p.signals).map((sig) => ({ month: sig.since_month, severity: sig.severity }))

  // Ссылка «весь комментарий» прокручивает к месяцу и подсвечивает его.
  const [flash, setFlash] = useState<number | null>(null)
  const toComment = (month: number) => {
    document.getElementById(`month-${month}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlash(month)
    window.setTimeout(() => setFlash(null), 1800)
  }

  const groups = survey.data ? questionGroups(survey.data, p.series, monthList) : []
  const paired = survey.data ? pairedGroups(survey.data, p.series, monthList) : []
  // Подписи вопросов анкеты для комментариев: короткое название показателя, нет его — формулировка.
  const labels: Record<string, string> = {}
  for (const role of ['intern', 'mentor'] as const) {
    for (const q of survey.data?.roles[role].questions ?? []) labels[`${role}:${q.id}`] = q.label ?? q.text
  }

  return (
    <>
      <PageHeader
        top={<Top id={p.pair_id} overview={overview} />}
        title={personName(p.intern_name, p.intern_id)}
        facts={`наставник ${personName(p.mentor_name, p.mentor_id)}`}
        aside={<Status status={p.status} />}
      />
      <div className="wrap">
        <div className={t.layout}>
          <div className={t.talk}>
            <Lead pair={p} />
            <Topics pair={p} onQuote={toComment} />
            <Questions pairId={p.pair_id} />
          </div>
          <aside className={t.aside}>
            <Outcome pair={p} />
          </aside>
          <div className={t.rest}>
            <section className={t.block} aria-labelledby="pair-chart">
              <h2 id="pair-chart" className={t.blockTitle}>
                Оценки по месяцам
              </h2>
              <Chart cells={p.cells} months={dataEnd} scale={scale} marks={marks} />
              {groups.length > 0 && (
                <div className={t.lowRows}>
                  <h3 className={t.subTitle}>Оценки по вопросам</h3>
                  <QuestionTable compact months={monthList} groups={groups} tone={scoreTone} />
                </div>
              )}
              {paired.length > 0 && (
                <div className={t.lowRows}>
                  <h3 className={t.subTitle}>Стажёр и наставник об одном и том же</h3>
                  <QuestionTable compact months={monthList} groups={paired} tone={scoreTone} />
                </div>
              )}
            </section>
            <Comments pair={p} collect={collect} flash={flash} labels={labels} className={t.block} />
          </div>
        </div>
      </div>
    </>
  )
}

// «Коротко»: резюме ситуации от бэкенда и что сделать по активным ситуациям.
function Lead({ pair }: { pair: PairDetail }) {
  const brief = useBrief(pair.pair_id)
  // Действия считает бэкенд: для активных поводов — что сделать, для выправившейся пары — как закрепить.
  // Старый бэкенд поля не отдаёт: тогда берём действия активных поводов, без заметок.
  const todo = brief.data?.next_steps ?? [
    ...new Set(pair.signals.filter((sig) => sig.active && sig.severity !== 'low' && sig.action).map((sig) => sig.action)),
  ]
  if (!brief.data?.summary && todo.length === 0) return null
  return (
    <section className={t.lead} aria-labelledby="pair-lead">
      <h2 id="pair-lead" className={t.leadTitle}>
        Коротко
      </h2>
      {brief.data?.summary && <p className={t.leadText}>{brief.data.summary}</p>}
      {todo.length > 0 && (
        <div className={t.leadTodo}>
          <span className={t.actionLabel}>Что делать дальше</span>
          {todo.length === 1 ? (
            <p>{todo[0]}</p>
          ) : (
            <ul>
              {todo.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
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
      <motion.div
        key={status}
        variants={variants.swap}
        initial={first.current || reduce ? false : 'hidden'}
        animate="shown"
      >
        <StatusText status={status} />
      </motion.div>
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
        Разговоры
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
