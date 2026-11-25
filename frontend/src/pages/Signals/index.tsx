// Экран «Все ситуации» (/signals): сверху фильтры списками, ниже одна таблица сигналов.
// Строка раскрывается на месте: объяснение, цитата, что сделать, отметка.

import { useQueries } from '@tanstack/react-query'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { api } from '../../api/client'
import { queryKeys, useOverview, useReview, useSignals } from '../../api/queries'
import type { PairDetail, ReviewStatus, Severity } from '../../api/types'
import { PageHeader } from '../../components'
import { SEVERITY_LABEL, personName, plural } from '../../lib/format'
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
const KINDS: Kind[] = ['gap', 'decline', 'low_question', 'text', 'silence']
const SEVERITIES: Severity[] = ['high', 'medium', 'low']
const COLS = 5

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

  const personCounts = facet(inSegment, filters, 'person', (x) => x.pair_id)
  const kindCounts = facet(inSegment, filters, 'kind', kindOf)
  const sevCounts = facet(inSegment, filters, 'severity', (x) => x.severity)
  const monthCounts = facet(inSegment, filters, 'month', (x) => x.months)
  const personIds = [...new Set(inSegment.map((x) => x.pair_id))].sort()
  const monthList = [...new Set(inSegment.flatMap((x) => x.months))].sort((a, b) => a - b)

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
  const done = bySegment.done.length

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
  } else if (list.length === 0) {
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
    body = (
      <div className={s.card}>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col" className={s.cDot}>
                  <span className="sr-only">Важность</span>
                </th>
                <th scope="col">Стажёр</th>
                <th scope="col">Что случилось</th>
                <th scope="col">Когда</th>
                <th scope="col">Отметка</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <SignalRow
                  key={x.key}
                  signal={x}
                  person={nameOf(x.pair_id)}
                  detail={details.get(x.pair_id)}
                  open={openId === x.key}
                  fresh={isFreshCell(x.pair_id, x.month)}
                  cols={COLS}
                  onToggle={() => setOpenId((id) => (id === x.key ? null : x.key))}
                  onMark={(status) => void mark(x.key, status)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        top={
          <Link to="/analytics" className={s.back}>
            ← Программа
          </Link>
        }
        title="Все ситуации"
        facts={all ? `${open} ${plural(open, ['открытый', 'открытых', 'открытых'])} · ${done} ${plural(done, ['разобранный', 'разобранных', 'разобранных'])}` : undefined}
        aside={
          <div className={s.segments} role="group" aria-label="Какие сигналы показать">
            {SEGMENTS.map((o) => (
              <button key={o.value} type="button" className={s.segment} aria-pressed={segment === o.value} onClick={() => set('show', o.value === 'open' ? null : o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        }
      />
      <div className={clsx('wrap', s.page)}>
        {all && inSegment.length > 0 && (
          <div className={s.filters}>
            <Pick label="Стажёр" any="Все стажёры" value={filters.person} onChange={(v) => set('person', v)}>
              {personIds.map((id) => (
                <Opt key={id} value={id} on={filters.person === id} count={personCounts.get(id) ?? 0}>
                  {nameOf(id)}
                </Opt>
              ))}
            </Pick>
            <Pick label="Тип" any="Все типы" value={filters.kind} onChange={(v) => set('kind', v)}>
              {KINDS.map((k) => (
                <Opt key={k} value={k} on={filters.kind === k} count={kindCounts.get(k) ?? 0}>
                  {KIND_LABEL[k]}
                </Opt>
              ))}
            </Pick>
            <Pick label="Важность" any="Любая важность" value={filters.severity} onChange={(v) => set('sev', v)}>
              {SEVERITIES.map((v) => (
                <Opt key={v} value={v} on={filters.severity === v} count={sevCounts.get(v) ?? 0}>
                  {capitalize(SEVERITY_LABEL[v])}
                </Opt>
              ))}
            </Pick>
            <Pick label="Месяц" any="Любой месяц" value={filters.month == null ? null : String(filters.month)} onChange={(v) => set('month', v)}>
              {monthList.map((m) => (
                <Opt key={m} value={String(m)} on={filters.month === m} count={monthCounts.get(m) ?? 0}>
                  {m}-й месяц
                </Opt>
              ))}
            </Pick>
            {active && (
              <button type="button" className={s.reset} onClick={reset}>
                Сбросить
              </button>
            )}
          </div>
        )}
        {body}
        <UndoBar notice={notice} reduce={reduce} onUndo={(n) => void undo(n)} onClose={() => setNotice(null)} />
      </div>
    </>
  )
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

// Выпадающий список фильтра. Первый вариант снимает фильтр.
function Pick({ label, any, value, onChange, children }: { label: string; any: string; value: string | null; onChange: (v: string | null) => void; children: React.ReactNode }) {
  return (
    <select className={s.select} aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{any}</option>
      {children}
    </select>
  )
}

function Opt({ value, on, count, children }: { value: string; on: boolean; count: number; children: React.ReactNode }) {
  return (
    <option value={value} disabled={count === 0 && !on}>
      {children} ({count})
    </option>
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
        <li key={i} className={s.skelRow}>
          <span className={s.skel} style={{ width: 10, height: 10, borderRadius: '50%' }} />
          <span className={s.skel} style={{ width: `${46 - i * 4}%` }} />
        </li>
      ))}
    </ul>
  )
}
