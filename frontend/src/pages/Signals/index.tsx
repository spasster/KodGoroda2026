// Экран «С кем поговорить» (/signals): очередь сигналов, сгруппированная по
// парам. Сначала пары с сигналами высокой важности, повторы одного условия
// свёрнуты в один сигнал с одним решением. Фильтры живут в адресной строке.
// Вид и тексты: docs/design/system.md, «Экран „С кем поговорить“», «Сигнал
// целиком», «Пустые состояния»; эталон docs/design/reference.html#/signals.

import { useQueries } from '@tanstack/react-query'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../../api/client'
import { queryKeys, useOverview, useSignals, useThresholds } from '../../api/queries'
import type { PairDetail, PairSummary, Severity, Signal } from '../../api/types'
import {
  Button,
  EmptyState,
  LoadError,
  Loading,
  PageHeader,
  PairChip,
  PairPeople,
  Segmented,
  SignalBlock,
  Skeleton,
  StatusLabel,
} from '../../components'
import { formatCount, PAIR_STATUS_LABEL, plural, recentWindow, WORDS, type Forms } from '../../lib/format'
import { useReduced, variants } from '../../lib/motion'
import { sortPairsByPriority } from '../../lib/rules'
import { useLive } from '../../live/useLive'
import {
  buildView,
  filtersKey,
  isNarrowed,
  itemsOf,
  stableOrder,
  type Filters,
  type Item,
  type SeverityFilter,
  type SignalsView,
  type StatusFilter,
} from './model'
import s from './Signals.module.css'
import { UndoBar } from './UndoBar'
import { useFilters } from './useFilters'
import { useMarkedBatch } from './useUndo'

const LEAD =
  'Сигналы сгруппированы по парам. Сначала пары с сигналами высокой важности. Сигнал предлагает разговор, решение за вами.'


// «у 1 пары», «у 4 пар».
const PAIRS_GEN: Forms = ['пары', 'пар', 'пар']

export function SignalsPage() {
  const [filters, setFilters] = useFilters()
  const fkey = filtersKey(filters)
  const reduce = useReduced()
  const { isFreshCell } = useLive()
  const { active_months: months } = useThresholds()

  // Все сигналы одним запросом: счётчики сегментов, окно и отметки считаем здесь.
  const signals = useSignals({ status: 'all' })
  const overview = useOverview()
  const all = signals.data

  // Карточки пар нужны для реплик обеих сторон и цепочки разрыва в сигнале.
  const pairIds = useMemo(() => [...new Set((all ?? []).map((x) => x.pair_id))].sort(), [all])
  const pairQueries = useQueries({
    queries: pairIds.map((id) => ({ queryKey: queryKeys.pair(id), queryFn: () => api.pair(id) })),
  })
  const details = new Map<string, { data?: PairDetail; settled: boolean }>()
  pairIds.forEach((id, i) => details.set(id, { data: pairQueries[i]?.data, settled: !pairQueries[i]?.isPending }))

  const summaries = useMemo(
    () => new Map((overview.data?.pairs ?? []).map((p) => [p.pair_id, p] as const)),
    [overview.data],
  )
  const lastMonth = useMemo(
    () => new Map([...summaries.values()].map((p) => [p.pair_id, p.last_month] as const)),
    [summaries],
  )

  // Что стояло на экране при этих фильтрах: отмеченное на глазах не исчезает, а
  // пары не меняются местами, пока фильтр тот же (system.md: «чтобы список не
  // прыгал под рукой»).
  const memo = useRef({ fkey, keep: new Set<string>(), order: [] as string[] })
  if (memo.current.fkey !== fkey) memo.current = { fkey, keep: new Set(), order: [] }

  const view = all && overview.data ? buildView(all, filters, lastMonth, months, memo.current.keep) : null
  let order: string[] = []
  if (view && all) {
    view.list.forEach((x) => memo.current.keep.add(x.key))
    const ids = [...new Set(view.list.map((x) => x.pair_id))]
    order = stableOrder(memo.current.order, sortPairsByPriority(ids, all))
    memo.current.order = order
  }

  // Первый показ ждёт карточки пар, иначе реплики сторон появятся рывком.
  const ready = useRef(false)
  if (view && pairIds.every((id) => details.get(id)?.settled)) ready.current = true

  // Фильтр сменился, а полоса фильтров прилипла: возвращаемся к началу списка.
  const anchor = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = anchor.current
    if (!el) return
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0
    const top = el.getBoundingClientRect().top + window.scrollY - header
    if (window.scrollY > top) window.scrollTo({ top })
  }, [fkey])

  const resetFilters = () => setFilters({ severity: 'all', recent: true })

  // Отмена отметки в течение нескольких секунд.
  const [batch, setBatch] = useMarkedBatch()
  const closeUndo = useCallback(() => setBatch(null), [setBatch])
  const statusOf = useMemo(() => new Map((all ?? []).map((x) => [x.key, x.review.status] as const)), [all])
  const undoStale = batch != null && batch.keys.every((k) => statusOf.get(k) !== batch.status)

  const failed = [signals, overview].find((q) => q.isError && !q.data)
  const outdated = [signals, overview].find((q) => q.isError && q.data)

  let body: ReactNode
  if (failed && !ready.current) {
    body = <LoadError query={failed} className={s.banner} />
  } else if (!view || !ready.current) {
    body = <SignalsSkeleton />
  } else {
    const groups = order
      .map((id) => ({
        id,
        summary: summaries.get(id),
        detail: details.get(id),
        items: itemsOf(view.list.filter((x) => x.pair_id === id)),
      }))
      // Пара появилась после первого показа: ждём её карточку, чтобы не дёргалась.
      .filter((g) => g.detail?.settled !== false)
    const allDone = view.list.length > 0 && view.openInList === 0 && filters.status === 'open'
    const empty = emptyCopy(filters, view, months)

    body = (
      <>
        <div ref={anchor} />
        <div className={s.filters} role="group" aria-label="Фильтры">
          <Segmented<StatusFilter>
            label="Отметка"
            className={s.seg}
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            options={[
              { value: 'open', label: 'Открытые', count: view.statusCounts.open },
              { value: 'confirmed', label: 'Подтвердились', count: view.statusCounts.confirmed },
              { value: 'rejected', label: 'Ложная тревога', count: view.statusCounts.rejected },
              { value: 'all', label: 'Все', count: view.statusCounts.all },
            ]}
          />
          <Segmented<SeverityFilter>
            label="Важность"
            className={s.seg}
            value={filters.severity}
            onChange={(severity) => setFilters({ severity })}
            options={[
              { value: 'all', label: 'Любая важность' },
              { value: 'high', label: 'Высокая', count: view.severityCounts.high },
              { value: 'medium', label: 'Средняя', count: view.severityCounts.medium },
              { value: 'low', label: 'Низкая', count: view.severityCounts.low },
            ]}
          />
          <label className={s.check}>
            <input type="checkbox" checked={filters.recent} onChange={(e) => setFilters({ recent: e.target.checked })} />
            Только последние {formatCount(months, WORDS.month)}
          </label>
        </div>
        <p className="sr-only" aria-live="polite">
          {view.list.length > 0
            ? `Показано ${formatCount(view.list.length, WORDS.signal)} у ${groups.length} ${plural(groups.length, PAIRS_GEN)}`
            : empty.title}
        </p>

        <AnimatePresence initial={false}>
          {outdated && (
            <motion.div
              key="outdated"
              className={s.collapse}
              variants={variants.collapse}
              initial={reduce ? false : 'hidden'}
              animate="shown"
              exit={reduce ? undefined : 'gone'}
            >
              <LoadError query={outdated} className={s.banner} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Смена фильтра пересобирает список сразу, без анимации. */}
        <div key={fkey}>
          {/* Последний открытый сигнал отметили на глазах: плашка раздвигает список
              плавно, а не сдвигает его рывком под рукой. */}
          <AnimatePresence initial={false}>
            {(allDone || view.list.length === 0) && (
              <motion.div
                key="empty"
                className={s.collapse}
                variants={variants.collapse}
                initial={reduce ? false : 'hidden'}
                animate="shown"
                exit={reduce ? undefined : 'gone'}
              >
                <EmptyState
                  className={s.empty}
                  title={empty.title}
                  text={empty.text}
                  actions={isNarrowed(filters) && <Button onClick={resetFilters}>Сбросить фильтры</Button>}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {groups.map((g) => (
              <PairGroup
                key={g.id}
                id={g.id}
                summary={g.summary}
                detail={g.detail?.data}
                items={g.items}
                reduce={reduce}
                isFresh={(x) => isFreshCell(x.pair_id, x.month)}
              />
            ))}
          </AnimatePresence>
        </div>
      </>
    )
  }

  return (
    <div className={clsx('wrap', s.page)}>
      <PageHeader title="С кем поговорить" lead={LEAD} />
      {body}
      <UndoBar batch={batch} stale={undoStale} onClose={closeUndo} />
    </div>
  )
}

function PairGroup({
  id,
  summary,
  detail,
  items,
  reduce,
  isFresh,
}: {
  id: string
  summary?: PairSummary
  detail?: PairDetail
  items: Item[]
  reduce: boolean
  isFresh: (s: Signal) => boolean
}) {
  const pair = summary ?? detail
  const status = pair?.status ?? 'ok'
  return (
    <motion.section
      className={s.group}
      aria-labelledby={`pair-${id}`}
      variants={variants.swap}
      initial={reduce ? false : 'hidden'}
      animate="shown"
    >
      <header className={s.head}>
        <h2 id={`pair-${id}`} className="sr-only">
          Пара {id}, {PAIR_STATUS_LABEL[status].toLowerCase()}
        </h2>
        <PairChip pairId={id} status={status} />
        {pair && <PairPeople internId={pair.intern_id} mentorId={pair.mentor_id} className={s.people} />}
        <StatusLabel status={status} />
        <Link to={`/pairs/${id}`} className={clsx('link', s.open)}>
          Открыть пару
        </Link>
      </header>
      <AnimatePresence initial={false}>
        {items.map(({ signal, repeats }) => {
          const fresh = isFresh(signal)
          return (
            <motion.div
              key={signal.key}
              className={clsx(s.item, fresh && s.fresh)}
              variants={variants.swap}
              initial={reduce ? false : 'hidden'}
              animate="shown"
            >
              {fresh && <span className={s.newTag}>новое</span>}
              <SignalBlock signal={signal} repeats={repeats} pair={detail} />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </motion.section>
  )
}

// Серые блоки по форме экрана: полоса фильтров, заголовок группы, один сигнал.
function SignalsSkeleton() {
  return (
    <Loading>
      <div className={s.skelFilters}>
        <Skeleton width={540} height={40} radius={8} />
        <Skeleton width={470} height={40} radius={8} />
        <Skeleton width={230} height={22} />
      </div>
      <div className={s.skelHead}>
        <Skeleton width={78} height={44} radius={6} />
        <Skeleton width={120} height={18} />
        <Skeleton width={150} height={18} />
      </div>
      <div className={s.skelSignal}>
        <div className={s.skelSide}>
          <Skeleton width={84} height={16} />
          <Skeleton width={72} height={24} radius={4} />
          <Skeleton width={70} height={16} />
        </div>
        <div className={s.skelBody}>
          <Skeleton width="62%" height={28} />
          <Skeleton width="78%" height={20} />
          <Skeleton width="45%" height={32} />
          <Skeleton height={110} />
          <div className={s.skelButtons}>
            <Skeleton width={150} height={40} radius={8} />
            <Skeleton width={160} height={40} radius={8} />
          </div>
        </div>
      </div>
    </Loading>
  )
}

const NONE_OF: Record<StatusFilter, string> = {
  open: 'Открытых сигналов',
  confirmed: 'Подтверждённых сигналов',
  rejected: 'Ложных тревог',
  all: 'Сигналов',
}

const SEVERITY_GEN: Record<Severity, string> = { high: 'высокой', medium: 'средней', low: 'низкой' }

// Тексты пустого списка из system.md, «Пустые состояния». Если всё спрятал
// фильтр важности, говорим, сколько осталось за ним.
function emptyCopy(f: Filters, v: SignalsView, months: number): { title: string; text: string } {
  const hidden = v.byStatus - v.list.length
  if (f.severity !== 'all' && hidden > 0) {
    return {
      title: `${NONE_OF[f.status]} ${SEVERITY_GEN[f.severity]} важности нет`,
      text: `Ещё ${formatCount(hidden, WORDS.signal)} другой важности.`,
    }
  }
  switch (f.status) {
    case 'open':
      return {
        title: 'Открытых сигналов нет',
        text: `Новые появятся, когда придут анкеты.${v.statusCounts.all > 0 ? ' Сейчас все сигналы отмечены.' : ''}`,
      }
    case 'confirmed':
      return {
        title: 'Подтверждённых сигналов пока нет',
        text: 'Сигнал попадёт сюда, когда вы нажмёте «Подтвердилось».',
      }
    case 'rejected':
      return {
        title: 'Ложных тревог пока нет',
        text: 'Сигнал попадёт сюда, когда вы нажмёте «Ложная тревога».',
      }
    case 'all':
      return {
        title: 'Сигналов нет',
        text: f.recent
          ? `${recentWindow(months).replace(/^за/, 'За')} анкеты не дали ни одного сигнала.`
          : 'Анкеты пока не дали ни одного сигнала.',
      }
  }
}
