// Экран «Сигналы» (/signals): сигналы сгруппированы по стажёрам, сверху фильтры.
// Строка раскрывается на месте: объяснение, цитата, что сделать, отметка.

import { useQueries } from '@tanstack/react-query'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { api } from '../../api/client'
import { queryKeys, useOverview, useReview, useSignals } from '../../api/queries'
import type { PairDetail, PairStatus, PairSummary, ReviewStatus, Severity, Signal } from '../../api/types'
import { Hero } from '../../components'
import { PAIR_STATUS_LABEL, SEVERITY_LABEL, personName, plural } from '../../lib/format'
import { dur, ease, useReduced } from '../../lib/motion'
import { useLive } from '../../live/useLive'
import { KIND_LABEL, facet, kindOf, matches, segmentRows, type Filters, type Kind, type Segment } from './model'
import { SignalRow } from './SignalRow'
import s from './Signals.module.css'

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'open', label: 'Открытые' },
  { value: 'done', label: 'Разобранные' },
  { value: 'all', label: 'Все' },
]
const KINDS: Kind[] = ['gap', 'decline', 'text', 'silence']
const SEVERITIES: Severity[] = ['high', 'medium', 'low']
const STATUS_RANK: Record<PairStatus, number> = { risk: 0, watch: 1, ok: 2 }

const EMPTY: Record<Segment, string> = {
  open: 'Все сигналы разобраны',
  done: 'Разобранных пока нет',
  all: 'Сигналов нет',
}

const UNDO_MS = 5000

interface Notice {
  id: number
  key: string
  text: string
  undo: boolean
}

// Фильтры живут в адресе: ссылкой можно поделиться, «назад» возвращает прежний вид.
function useFilters() {
  const [params, setParams] = useSearchParams()
  const seg = params.get('show')
  const segment: Segment = seg === 'done' || seg === 'all' ? seg : 'open'
  const kind = params.get('kind') as Kind | null
  const severity = params.get('sev') as Severity | null
  const month = Number(params.get('month'))
  const filters: Filters = {
    person: params.get('person'),
    kind: kind && KINDS.includes(kind) ? kind : null,
    severity: severity && SEVERITIES.includes(severity) ? severity : null,
    month: Number.isInteger(month) && month > 0 ? month : null,
  }
  const set = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value == null || prev.get(key) === value) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  const reset = () => setParams(segment === 'open' ? {} : { show: segment }, { replace: true })
  return { segment, filters, set, reset }
}

export function SignalsPage() {
  const reduce = useReduced()
  const { segment, filters, set, reset } = useFilters()
  const [openId, setOpenId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const noticeId = useRef(0)

  const signals = useSignals({ status: 'all' })
  const overview = useOverview()
  const review = useReview()
  const { isFreshCell } = useLive()
  const all = signals.data

  const bySegment = useMemo(
    () => ({
      open: all ? segmentRows(all, 'open') : [],
      done: all ? segmentRows(all, 'done') : [],
      all: all ? segmentRows(all, 'all') : [],
    }),
    [all],
  )
  const inSegment = bySegment[segment]
  const list = inSegment.filter((x) => matches(x, filters))
  const active = Object.values(filters).some((v) => v != null)

  const pairs = useMemo(() => new Map((overview.data?.pairs ?? []).map((p) => [p.pair_id, p])), [overview.data])
  const nameOf = (id: string) => {
    const p = pairs.get(id)
    return p ? personName(p.intern_name, p.intern_id) : id
  }

  // Карточки пар нужны для цитаты целиком: комментарий с подсвеченным местом.
  const pairIds = useMemo(() => [...new Set((all ?? []).map((x) => x.pair_id))].sort(), [all])
  const pairQueries = useQueries({
    queries: pairIds.map((id) => ({ queryKey: queryKeys.pair(id), queryFn: () => api.pair(id) })),
  })
  const details = new Map<string, PairDetail | undefined>(pairIds.map((id, i) => [id, pairQueries[i]?.data]))

  // Группы по стажёрам: сначала те, с кем пора говорить, внутри порядок строк уже задан.
  const groups = useMemo(() => {
    const map = new Map<string, Signal[]>()
    for (const x of list) {
      const g = map.get(x.pair_id)
      if (g) g.push(x)
      else map.set(x.pair_id, [x])
    }
    return [...map.entries()].sort(([a, ra], [b, rb]) => {
      const pa = pairs.get(a)
      const pb = pairs.get(b)
      return (pa ? STATUS_RANK[pa.status] : 3) - (pb ? STATUS_RANK[pb.status] : 3) || rb.length - ra.length || (a < b ? -1 : 1)
    })
  }, [list, pairs])

  const personCounts = facet(inSegment, filters, 'person', (x) => x.pair_id)
  const kindCounts = facet(inSegment, filters, 'kind', kindOf)
  const sevCounts = facet(inSegment, filters, 'severity', (x) => x.severity)
  const monthCounts = facet(inSegment, filters, 'month', (x) => x.month)
  const personIds = [...new Set(inSegment.map((x) => x.pair_id))].sort()
  const monthList = [...new Set(inSegment.map((x) => x.month))].sort((a, b) => a - b)

  const say = (n: Omit<Notice, 'id'>) => setNotice({ ...n, id: ++noticeId.current })

  const mark = async (key: string, status: ReviewStatus) => {
    if (status !== 'open') setNotice(null)
    try {
      await review.mutateAsync({ key, status })
      if (status !== 'open') say({ key, text: 'Отмечено', undo: true })
    } catch {
      say({ key, text: 'Отметка не сохранилась', undo: false })
    }
  }

  const undo = async (n: Notice) => {
    setNotice(null)
    try {
      await review.mutateAsync({ key: n.key, status: 'open' })
    } catch {
      say({ key: n.key, text: 'Не получилось отменить', undo: false })
    }
  }

  const open = bySegment.open.length
  const title =
    !all || open === 0 ? (
      'Сигналы'
    ) : (
      <>
        <em>{open}</em> {plural(open, ['открытый сигнал', 'открытых сигнала', 'открытых сигналов'])}
      </>
    )

  let body
  if (!all && signals.isError) {
    body = (
      <div className={clsx(s.card, s.empty)}>
        <p className={s.emptyText}>Не удалось загрузить сигналы</p>
        <button type="button" className={clsx(s.btn, s.secondary)} onClick={() => void signals.refetch()}>
          Повторить
        </button>
      </div>
    )
  } else if (!all) {
    body = (
      <div className={s.card}>
        <Skeleton />
      </div>
    )
  } else if (groups.length === 0) {
    body = (
      <div className={clsx(s.card, s.empty)}>
        <p className={s.emptyText}>{active ? 'Под такие фильтры ничего не подходит' : all.length === 0 ? EMPTY.all : EMPTY[segment]}</p>
        {active && (
          <button type="button" className={clsx(s.btn, s.secondary)} onClick={reset}>
            Сбросить фильтры
          </button>
        )}
      </div>
    )
  } else {
    body = groups.map(([pairId, rows]) => (
      <Group key={pairId} pair={pairs.get(pairId)} pairId={pairId} count={rows.length}>
        <ul className={s.list}>
          <AnimatePresence initial={false}>
            {rows.map((x) => (
              <SignalRow
                key={x.key}
                signal={x}
                kind={KIND_LABEL[kindOf(x)]}
                detail={details.get(x.pair_id)}
                open={openId === x.key}
                fresh={isFreshCell(x.pair_id, x.month)}
                reduce={reduce}
                onToggle={() => setOpenId((id) => (id === x.key ? null : x.key))}
                onMark={(status) => void mark(x.key, status)}
              />
            ))}
          </AnimatePresence>
        </ul>
      </Group>
    ))
  }

  return (
    <>
      <Hero
        title={title}
        aside={
          <div className={s.segments} role="group" aria-label="Какие сигналы показать">
            {SEGMENTS.map((o) => (
              <button key={o.value} type="button" className={s.segment} aria-pressed={segment === o.value} onClick={() => set('show', o.value === 'open' ? null : o.value)}>
                {o.label}
                {all && <span className={s.count}>{bySegment[o.value].length}</span>}
              </button>
            ))}
          </div>
        }
      />
      <div className={clsx('wrap', s.page)}>
        {all && inSegment.length > 0 && (
          <div className={s.filters}>
            <Facet label="Стажёр">
              {personIds.map((id) => (
                <Chip key={id} on={filters.person === id} count={personCounts.get(id) ?? 0} onClick={() => set('person', id)}>
                  {nameOf(id)}
                </Chip>
              ))}
            </Facet>
            <Facet label="Что случилось">
              {KINDS.map((k) => (
                <Chip key={k} on={filters.kind === k} count={kindCounts.get(k) ?? 0} onClick={() => set('kind', k)}>
                  {KIND_LABEL[k]}
                </Chip>
              ))}
            </Facet>
            <Facet label="Важность">
              {SEVERITIES.map((v) => (
                <Chip key={v} on={filters.severity === v} count={sevCounts.get(v) ?? 0} dot={v} onClick={() => set('sev', v)}>
                  {capitalize(SEVERITY_LABEL[v])}
                </Chip>
              ))}
            </Facet>
            <Facet label="Месяц">
              {monthList.map((m) => (
                <Chip key={m} on={filters.month === m} count={monthCounts.get(m) ?? 0} onClick={() => set('month', String(m))}>
                  {m}-й
                </Chip>
              ))}
            </Facet>
            {active && (
              <button type="button" className={s.reset} onClick={reset}>
                Сбросить
              </button>
            )}
          </div>
        )}
        <div className={s.groups}>{body}</div>
        <UndoBar notice={notice} reduce={reduce} onUndo={(n) => void undo(n)} onClose={() => setNotice(null)} />
      </div>
    </>
  )
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function Facet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.facet}>
      <span className={s.facetLabel}>{label}</span>
      <div className={s.chips}>{children}</div>
    </div>
  )
}

function Chip({ on, count, dot, onClick, children }: { on: boolean; count: number; dot?: Severity; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={s.chip} aria-pressed={on} disabled={count === 0 && !on} onClick={onClick}>
      {dot && <i className={clsx(s.dot, s[dot])} aria-hidden="true" />}
      {children}
      <span className={s.chipCount}>{count}</span>
    </button>
  )
}

// Карточка стажёра: имя, наставник, статус и его сигналы.
function Group({ pair, pairId, count, children }: { pair: PairSummary | undefined; pairId: string; count: number; children: React.ReactNode }) {
  return (
    <section className={s.card}>
      <header className={s.groupHead}>
        <div className={s.who2}>
          <span className={s.groupName}>{pair ? personName(pair.intern_name, pair.intern_id) : pairId}</span>
          {pair && <span className={s.groupMentor}>наставник {personName(pair.mentor_name, pair.mentor_id)}</span>}
        </div>
        {pair && (
          <span className={s.groupStatus}>
            <i className={clsx(s.dot, s[`st_${pair.status}`])} aria-hidden="true" />
            {PAIR_STATUS_LABEL[pair.status]}
          </span>
        )}
        <span className={s.groupCount}>{count}</span>
        <Link to={`/pairs/${pairId}`} className={s.groupLink}>
          Открыть
        </Link>
      </header>
      {children}
    </section>
  )
}

// Плашка внизу по центру: «Отмечено · Отменить». Держится 5 секунд, пока
// курсор не над ней и фокус не внутри.
function UndoBar({ notice, reduce, onUndo, onClose }: { notice: Notice | null; reduce: boolean; onUndo: (n: Notice) => void; onClose: () => void }) {
  const [hold, setHold] = useState(false)
  const id = notice?.id
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (id == null || hold) return
    const t = window.setTimeout(() => close.current(), UNDO_MS)
    return () => window.clearTimeout(t)
  }, [id, hold])

  useEffect(() => setHold(false), [id])

  return (
    <div className={s.dock} aria-live="polite">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            role="status"
            className={s.undo}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.m, ease: ease.out } }}
            exit={reduce ? undefined : { opacity: 0, y: 8, transition: { duration: dur.s, ease: ease.out } }}
            onMouseEnter={() => setHold(true)}
            onMouseLeave={() => setHold(false)}
            onFocus={() => setHold(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false)
            }}
          >
            <span>{notice.text}</span>
            {notice.undo && (
              <button type="button" className={s.undoBtn} onClick={() => onUndo(notice)}>
                Отменить
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Skeleton() {
  return (
    <ul className={s.list} aria-busy="true" aria-label="Загружаем сигналы">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className={s.item}>
          <div className={s.skelRow}>
            <span className={s.skel} style={{ width: 10, height: 10, borderRadius: '50%' }} />
            <span className={s.skel} style={{ width: `${46 - i * 4}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
