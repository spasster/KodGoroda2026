// Таблица пар по месяцам. Строка — пара: стажёр и под ним наставник. Клетка
// месяца — оценка стажёра синим и наставника серым на заливке статуса месяца.
// Последняя колонка — главный активный сигнал. Клик по строке открывает пару.

import clsx from 'clsx'
import { motion } from 'motion/react'
import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import type { Cell, PairSummary } from '../../api/types'
import { Dot } from '../../app/status'
import { EMPTY, formatNumber, PAIR_STATUS_LABEL, personName } from '../../lib/format'
import { dur, ease } from '../../lib/motion'
import s from './Overview.module.css'

export interface PairsTableProps {
  pairs: PairSummary[]
  months: number[]
  collect: number | null
  titles: Map<string, string>
  isFresh: (pairId: string, month: number) => boolean
}

export function PairsTable({ pairs, months, collect, titles, isFresh }: PairsTableProps) {
  const navigate = useNavigate()

  // На телефоне из месяцев остаётся один: последний, где анкеты есть у всех.
  const lastData = Math.max(0, ...pairs.flatMap((p) => p.cells.filter((c) => !(c.missing.intern && c.missing.mentor)).map((c) => c.month)))
  const phoneMonth = collect != null && collect > 1 ? collect - 1 : lastData
  const phone = (m: number) => (m === phoneMonth ? undefined : s.notPhone)

  // Клик мимо ссылки в строке тоже открывает пару.
  const openRow = (e: MouseEvent<HTMLTableRowElement>, pairId: string) => {
    if (e.defaultPrevented || (e.target as HTMLElement).closest('a, button')) return
    if (window.getSelection()?.toString()) return
    navigate(`/pairs/${pairId}`)
  }

  return (
    <>
      <div className={s.card}>
        <table className={s.table}>
          <colgroup>
            <col className={s.colWho} />
            {months.map((m) => (
              <col key={m} className={phone(m)} />
            ))}
            <col className={s.colMain} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Стажёр</th>
              {months.map((m) => (
                <th key={m} scope="col" className={clsx(s.thMonth, phone(m))}>
                  {m}
                </th>
              ))}
              <th scope="col">Главное</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => (
              <tr key={p.pair_id} className={s.row} onClick={(e) => openRow(e, p.pair_id)}>
                <th scope="row" className={s.who}>
                  <Link to={`/pairs/${p.pair_id}`} className={s.intern}>
                    {personName(p.intern_name, p.intern_id)}
                  </Link>
                  <span className={s.mentor}>наставник {personName(p.mentor_name, p.mentor_id)}</span>
                </th>
                {months.map((m) => (
                  <td key={m} className={phone(m)}>
                    <MonthCell cell={p.cells.find((c) => c.month === m)} month={m} collect={collect} fresh={isFresh(p.pair_id, m)} />
                  </td>
                ))}
                <td className={s.main}>
                  <Main status={p.status} title={titles.get(p.pair_id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={s.legend} aria-hidden="true">
        <span>
          <i className={s.keyIntern} />
          стажёр
        </span>
        <span>
          <i className={s.keyMentor} />
          наставник
        </span>
      </p>
    </>
  )
}

function MonthCell({ cell, month, collect, fresh }: { cell: Cell | undefined; month: number; collect: number | null; fresh: boolean }) {
  const empty = !cell || (cell.missing.intern && cell.missing.mentor)
  // Месяц сбора без анкет: точка-пустышка. Будущий месяц: пусто.
  if (empty && month === collect) return <div className={clsx(s.cell, s.wait)} role="img" aria-label={`${month}-й месяц: анкет пока нет`} />
  if (!cell) return <div className={s.cell} />

  const value = (v: number | null, missing: boolean) => (missing ? EMPTY : formatNumber(v))
  const label = `${month}-й месяц: стажёр ${value(cell.intern_index, cell.missing.intern)}, наставник ${value(cell.mentor_index, cell.missing.mentor)}. ${PAIR_STATUS_LABEL[cell.status]}.${fresh ? ' Новое.' : ''}`
  return (
    <div className={clsx(s.cell, s[cell.status], fresh && s.fresh)} role="img" aria-label={label}>
      <span className={clsx(s.vIntern, cell.missing.intern && s.vNone)} aria-hidden="true">
        {value(cell.intern_index, cell.missing.intern)}
      </span>
      <span className={clsx(s.vMentor, cell.missing.mentor && s.vNone)} aria-hidden="true">
        {value(cell.mentor_index, cell.missing.mentor)}
      </span>
      {fresh && (
        <span className={s.newTag} aria-hidden="true">
          новое
        </span>
      )}
    </div>
  )
}

// Точка статуса пары и заголовок главного сигнала. Новое проявляется на месте старого.
function Main({ status, title }: { status: PairSummary['status']; title: string | undefined }) {
  const text = status === 'ok' ? PAIR_STATUS_LABEL.ok : (title ?? PAIR_STATUS_LABEL[status])
  return (
    <motion.span
      key={`${status}|${text}`}
      className={s.mainInner}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: dur.m, ease: ease.out }}
    >
      <Dot status={status} className={s.mainDot} />
      <span className="clamp-2">{text}</span>
    </motion.span>
  )
}
