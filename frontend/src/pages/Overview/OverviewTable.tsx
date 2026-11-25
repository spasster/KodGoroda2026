// Таблица «стажёр × месяц»: две оценки в клетке, главное по паре, сколько ситуаций разобрано.
// Строки сгруппированы по статусу, вся строка ведёт на карточку стажёра.

import clsx from 'clsx'
import { Fragment, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import type { Cell, PairStatus } from '../../api/types'
import { Dot } from '../../app/status'
import { EMPTY, PAIR_STATUS_LABEL, formatNumber, personName } from '../../lib/format'
import { situationMonths } from '../../lib/rules'
import type { Story } from './model'
import s from './Overview.module.css'

const STATUSES: PairStatus[] = ['risk', 'watch', 'ok']

interface Props {
  stories: Story[]
  months: number[]
  /** `${pair_id}:${month}` у анкет, пришедших при открытом дашборде. */
  freshCells: ReadonlySet<string>
}

export function OverviewTable({ stories, months, freshCells }: Props) {
  const cols = months.length + 3
  return (
    <>
      <div className={s.card}>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col" className={s.thWho}>
                  Стажёр
                </th>
                {months.map((m) => (
                  <th key={m} scope="col" className={s.thMonth}>
                    {m}
                  </th>
                ))}
                <th scope="col" className={s.thMain}>
                  Главное
                </th>
                <th scope="col" className={s.thDone}>
                  Разобрано
                </th>
              </tr>
            </thead>
            <tbody>
              {STATUSES.map((status) => {
                const list = stories.filter((st) => st.status === status)
                if (list.length === 0) return null
                return (
                  <Fragment key={status}>
                    <tr className={s.group}>
                      <td colSpan={cols}>
                        <span className={s.groupLabel}>
                          {PAIR_STATUS_LABEL[status]} · {list.length}
                        </span>
                      </td>
                    </tr>
                    {list.map((st) => (
                      <Row key={st.pair.pair_id} story={st} months={months} freshCells={freshCells} />
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className={s.legend}>
        <span>
          <i className={s.keyIntern} aria-hidden="true" /> стажёр
        </span>
        <span>
          <i className={s.keyMentor} aria-hidden="true" /> наставник
        </span>
      </p>
    </>
  )
}

function Row({ story, months, freshCells }: { story: Story; months: number[]; freshCells: ReadonlySet<string> }) {
  const { pair, status, main, active, reviewed } = story
  const navigate = useNavigate()
  const to = `/pairs/${pair.pair_id}`
  const fresh = months.some((m) => freshCells.has(`${pair.pair_id}:${m}`))
  // Клик по строке открывает стажёра; ссылка в первой клетке работает с клавиатуры и сама.
  const open = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('a')) return
    navigate(to)
  }
  return (
    <tr className={s.row} onClick={open}>
      <th scope="row" className={s.who}>
        <Link to={to} className={s.link} data-status={status}>
          <span className={s.nameLine}>
            <Dot status={status} />
            <span className={s.name}>{personName(pair.intern_name, pair.intern_id)}</span>
            {fresh && <span className={s.newTag}>новая анкета</span>}
          </span>
          <span className={s.mentor}>наставник {personName(pair.mentor_name, pair.mentor_id)}</span>
        </Link>
      </th>
      {months.map((m) => (
        <MonthCell key={m} cell={pair.cells.find((c) => c.month === m)} fresh={freshCells.has(`${pair.pair_id}:${m}`)} />
      ))}
      <td className={s.main}>
        {main ? (
          <>
            <span className={s.mainTitle}>{main.title}</span>
            <span className={s.mainSub}>
              {situationMonths(main)}
              {active > 1 && ` · ещё ${active - 1}`}
            </span>
          </>
        ) : (
          <span className={s.mainTitle}>Всё ровно</span>
        )}
      </td>
      <td className={s.done}>{active > 0 ? `${reviewed} из ${active}` : ''}</td>
    </tr>
  )
}

function MonthCell({ cell, fresh }: { cell: Cell | undefined; fresh: boolean }) {
  if (!cell) return <td className={s.monthTd}><div className={s.cellEmpty} /></td>
  const title = `Стажёр ${formatNumber(cell.intern_index)}, наставник ${formatNumber(cell.mentor_index)}`
  return (
    <td className={clsx(s.monthTd, cell.status === 'risk' && s.risk, cell.status === 'watch' && s.watch, fresh && s.fresh)} title={title}>
      <div className={s.cell}>
        <span className={clsx(s.vIntern, cell.missing.intern && s.vNone)}>{cell.missing.intern ? EMPTY : formatNumber(cell.intern_index)}</span>
        <span className={clsx(s.vMentor, cell.missing.mentor && s.vNone)}>{cell.missing.mentor ? EMPTY : formatNumber(cell.mentor_index)}</span>
      </div>
    </td>
  )
}
