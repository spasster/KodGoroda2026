// Таблица «пара × месяц»: строки стоят на местах по pair_id, в клетке оценки
// стажёра и наставника и гантель разрыва, справа колонка «Сейчас».
// Новая анкета: клетка появляется с кольцом бренда и меткой «новое», потом
// заливается чернилами (arrival.ts). Клик по строке открывает пару.

import clsx from 'clsx'
import { motion } from 'motion/react'
import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import type { Cell, PairStatus, PairSummary, Role, Signal } from '../../api/types'
import { Dumbbell, PairPeople, RoleMark, SectionHead, StatusLabel, StatusSign } from '../../components'
import { formatCount, formatNumber, PAIR_STATUS_LABEL, WORDS } from '../../lib/format'
import { ease, useReduced, variants } from '../../lib/motion'
import { APPEAR_AT, FILL_AT, FILL_END, type Arrivals } from './arrival'
import s from './Board.module.css'

// Колонка «Сейчас» и строка-причина: их значения держатся до 1,5 с после анкеты.
export interface RowNow {
  status: PairStatus
  signals: number
  direction: string | null
  reason: string | null
}

export interface BoardProps {
  pairs: PairSummary[]
  months: number[]
  collect: number | null
  scale: { min: number; max: number }
  nowOf: (pairId: string) => RowNow
  signalByKey: Map<string, Signal>
  arrivals: Arrivals
  isFresh: (pairId: string, month: number) => boolean
  // Первая загрузка за сеанс: чернила растут по месяцам.
  first: boolean
}

export function Board({ pairs, months, collect, scale, nowOf, signalByKey, arrivals, isFresh, first }: BoardProps) {
  const navigate = useNavigate()
  const mounted = useRef(false)
  // На телефоне из месяцев остаётся один: последний закрытый, где анкеты есть у
  // всех. Шесть месяцев в 390px не влезают, а с телефона смотрят, что сейчас.
  const lastData = Math.max(0, ...pairs.flatMap((p) => p.cells.filter((c) => !(c.missing.intern && c.missing.mentor)).map((c) => c.month)))
  const phoneMonth = collect != null && collect > 1 ? collect - 1 : lastData
  const phone = (m: number) => (m === phoneMonth ? undefined : s.notPhone)
  useEffect(() => {
    mounted.current = true
  }, [])

  // Клик мимо ссылок в строке тоже открывает пару.
  const openRow = (e: MouseEvent<HTMLTableRowElement>, pairId: string) => {
    if (e.defaultPrevented || (e.target as HTMLElement).closest('a, button')) return
    if (window.getSelection()?.toString()) return
    navigate(`/pairs/${pairId}`)
  }

  return (
    <section className={s.board} aria-labelledby="board-h">
      <SectionHead
        id="board-h"
        title="Пары по месяцам"
        note={`Средняя оценка по шкале ${scale.min}–${scale.max}`}
        aside={<Legend />}
      />
      <div className={s.scroll}>
        <table className={clsx(s.table, first && s.first)}>
          <colgroup>
            <col className={s.colPair} />
            {months.map((m) => (
              <col key={m} className={phone(m)} />
            ))}
            <col className={s.colNow} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Пара</th>
              {months.map((m) =>
                m === collect ? (
                  <th key={m} scope="col" className={clsx(s.thCollect, phone(m))}>
                    <span>
                      <StatusSign status="collect" />
                      Месяц {m}, сбор
                    </span>
                  </th>
                ) : (
                  <th key={m} scope="col" className={phone(m)}>
                    Месяц {m}
                  </th>
                ),
              )}
              <th scope="col" className={s.thNow}>
                Сейчас
              </th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => {
              const now = nowOf(p.pair_id)
              return (
                <tr key={p.pair_id} className={s.row} onClick={(e) => openRow(e, p.pair_id)}>
                  <th scope="row" className={s.pairCell}>
                    <div className={s.pairHead}>
                      <Link className={s.pairId} to={`/pairs/${p.pair_id}`}>
                        {p.pair_id}
                      </Link>
                      <PairPeople internId={p.intern_id} mentorId={p.mentor_id} />
                    </div>
                    {now.reason && <p className={clsx(s.reason, 'clamp-2')}>{now.reason}</p>}
                  </th>
                  {months.map((m) => (
                    <td key={m} className={clsx(m === collect && s.colCollect, phone(m))}>
                      <MonthCell
                        pair={p}
                        month={m}
                        collect={collect}
                        scale={scale}
                        signalByKey={signalByKey}
                        arrivals={arrivals}
                        fresh={isFresh(p.pair_id, m)}
                      />
                    </td>
                  ))}
                  <td className={s.nowCell}>
                    <Now now={now} animate={mounted.current} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Legend() {
  return (
    <div className={s.legend} aria-hidden="true">
      <span>
        <RoleMark role="intern" />
        стажёр
      </span>
      <span>
        <RoleMark role="mentor" />
        наставник
      </span>
      <span>
        <svg width="26" height="10" viewBox="0 0 26 10">
          <line x1="4" x2="22" y1="5" y2="5" stroke="currentColor" strokeWidth="4" />
        </svg>
        разрыв
      </span>
      <span>
        <StatusSign status="risk" />
        пора поговорить
      </span>
      <span>
        <StatusSign status="watch" />
        присмотреться
      </span>
      <span>
        <StatusSign status="ok" />
        спокойно
      </span>
    </div>
  )
}

// Колонка «Сейчас»: статус, число сигналов, направление. Новое содержимое
// проявляется со сдвигом 6px.
function Now({ now, animate }: { now: RowNow; animate: boolean }) {
  const reduce = useReduced()
  const key = `${now.status}|${now.signals}|${now.direction ?? ''}`
  return (
    <motion.div key={key} variants={variants.swap} initial={animate && !reduce ? 'hidden' : false} animate="shown">
      <StatusLabel status={now.status} />
      <span className={s.nowSub}>{now.signals ? formatCount(now.signals, WORDS.signal) : 'сигналов нет'}</span>
      {now.direction && <span className={s.nowDir}>{now.direction}</span>}
    </motion.div>
  )
}

// «Месяц 4. Стажёр 3,0, наставник 4,8. Пора поговорить, 1 сигнал.»
const LABEL_ROLE: Record<Role, string> = { intern: 'Стажёр', mentor: 'наставник' }

function cellLabel(c: Cell, signals: number, fresh: boolean): string {
  const side = (role: Role, v: number | null) =>
    c.missing[role] ? `${LABEL_ROLE[role]} анкету не прислал` : `${LABEL_ROLE[role]} ${formatNumber(v)}`
  const count = signals ? `, ${formatCount(signals, WORDS.signal)}` : ''
  return `Месяц ${c.month}. ${side('intern', c.intern_index)}, ${side('mentor', c.mentor_index)}. ${PAIR_STATUS_LABEL[c.status]}${count}.${fresh ? ' Новое.' : ''}`
}

interface MonthCellProps {
  pair: PairSummary
  month: number
  collect: number | null
  scale: { min: number; max: number }
  signalByKey: Map<string, Signal>
  arrivals: Arrivals
  fresh: boolean
}

function MonthCell({ pair, month, collect, scale, signalByKey, arrivals, fresh }: MonthCellProps) {
  const reduce = useReduced()
  const c = pair.cells.find((cell) => cell.month === month)
  const empty = !c || (c.missing.intern && c.missing.mentor)
  const kind = empty ? (month === collect ? 'wait' : c ? 'none' : 'future') : 'cell'

  // Анимация поступления: клетка монтируется заново (ключ с id поступления),
  // проявляется на 0,3 с, до 1,1 с стоит без заливки, потом заливается. Только
  // если клетка изменилась на вид: появилась на месте «ждём анкеты» или сменила
  // статус. Вторая анкета в уже залитую клетку меняет одни цифры. Пока новых
  // данных нет, клетка держит прежний вид, а не пустеет.
  const a = arrivals.cell(pair.pair_id, month)
  const look = `${kind}:${kind === 'cell' ? c!.status : ''}`
  const settled = useRef(look)
  const replayId = useRef(0)
  if (!a) settled.current = look
  else if (replayId.current !== a.id && look !== settled.current) replayId.current = a.id
  const replay = a != null && replayId.current === a.id
  const elapsed = replay ? Date.now() - a.t0 : Infinity
  const phase = elapsed < FILL_AT ? 'arriving' : elapsed < FILL_END ? 'filling' : null
  // animate держим всегда: без него motion вернул бы клетку к initial.
  const appear = {
    initial: replay && elapsed < APPEAR_AT + 300 ? { opacity: 0, scale: 0.96 } : (false as const),
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.22, ease: ease.out, delay: replay ? Math.max(0, a.t0 + APPEAR_AT - Date.now()) / 1000 : 0 },
  }
  // id поступления остаётся в ключе и после анимации, иначе клетка смонтируется ещё раз.
  const key = `${kind}:${replayId.current}`
  // Цифры без перемонтажа клетки: новое значение проявляется за 0,2 с.
  const values = c ? `${c.intern_index}:${c.mentor_index}` : ''
  const fadeValues = a != null && !replay && !reduce
  const style = { '--m': month } as CSSProperties

  if (kind === 'future') return <div key={key} className={s.blank} aria-hidden="true" />
  if (kind === 'wait') {
    return (
      <motion.div key={key} {...appear} className={clsx(s.cell, s.wait)} style={style}>
        ждём анкеты
      </motion.div>
    )
  }

  const cell = c!
  const signals = cell.signal_keys.filter((k) => signalByKey.get(k)?.review.status !== 'rejected').length
  const status = cell.status
  // motion на обёртке: Link из react-router меняет ref на каждой перерисовке,
  // и motion принял бы это за новое появление клетки.
  return (
    <motion.div key={key} {...appear}>
      <Link
        to={`/pairs/${pair.pair_id}`}
        className={clsx(s.cell, s[status], phase && s[phase], fresh && s.fresh)}
        style={style}
        aria-label={cellLabel(cell, signals, fresh)}
      >
        {fresh && (
          <span className={s.newTag} aria-hidden="true">
            новое
          </span>
        )}
        <CellContent cell={cell} scale={scale} values={values} fade={fadeValues} />
        {/* Копия на чернилах для «Пора поговорить», см. .ink в Board.module.css. */}
        {status === 'risk' && (
          <span className={s.ink} aria-hidden="true">
            <CellContent cell={cell} scale={scale} values={values} fade={fadeValues} />
          </span>
        )}
      </Link>
    </motion.div>
  )
}

function CellContent({ cell, scale, values, fade }: { cell: Cell; scale: { min: number; max: number }; values: string; fade: boolean }) {
  return (
    <>
      <motion.span
        key={values}
        className={s.nums}
        aria-hidden="true"
        initial={fade ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: ease.out }}
      >
        <Value role="intern" value={cell.intern_index} missing={cell.missing.intern} />
        <Value role="mentor" value={cell.mentor_index} missing={cell.missing.mentor} />
      </motion.span>
      <Dumbbell className={s.db} intern={cell.intern_index} mentor={cell.mentor_index} scale={scale} />
    </>
  )
}

function Value({ role, value, missing }: { role: Role; value: number | null; missing: boolean }) {
  return (
    <span className={missing ? s.vNone : role === 'intern' ? s.vIntern : s.vMentor}>
      <RoleMark role={role} className={s.mk} />
      {missing ? 'нет' : formatNumber(value)}
    </span>
  )
}
