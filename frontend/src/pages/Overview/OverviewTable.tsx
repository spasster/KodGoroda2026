// Светофор «стажёр × месяц» на первом экране: две оценки в клетке (стажёр сверху,
// наставник снизу), заливка по статусу месяца, главное по паре. Строки по порядку ID,
// вся строка ведёт на карточку стажёра.

import clsx from 'clsx'
import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import type { Cell, PairStatus } from '../../api/types'
import { Dot } from '../../app/status'
import { StatusPill } from '../../ds/components/data-display/StatusPill'
import { PAIR_STATUS_LABEL, formatNumber, monthsPhrase, personName } from '../../lib/format'
import { dueMonths, situationMonths } from '../../lib/rules'
import type { Story } from './model'
import s from './Overview.module.css'

interface Props {
  stories: Story[]
  months: number[]
  /** `${pair_id}:${month}` у анкет, пришедших при открытом дашборде. */
  freshCells: ReadonlySet<string>
}

export function OverviewTable({ stories, months, freshCells }: Props) {
  const rows = [...stories].sort((a, b) => (a.pair.pair_id < b.pair.pair_id ? -1 : 1))
  const showDone = rows.some((st) => st.active > 0)
  return (
    <section className={s.block} aria-labelledby="program-months">
      <div className={s.head}>
        <h2 id="program-months" className={s.title}>
          Программа по месяцам
        </h2>
        <div className={s.legend}>
          <StatusPill tone="positive">положительная оценка</StatusPill>
          <StatusPill tone="warning">зона внимания</StatusPill>
          <StatusPill tone="negative">критичный сигнал</StatusPill>
          <span className={s.legendPair}>
            <b>4,5</b> стажёр
            <br />
            <span>4,0</span> наставник
          </span>
        </div>
      </div>
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
                    {m}-й мес.
                  </th>
                ))}
                <th scope="col" className={s.thMain}>
                  Главное
                </th>
                {showDone && (
                  <th scope="col" className={s.thDone}>
                    Разобрано
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((st) => (
                <Row key={st.pair.pair_id} story={st} months={months} freshCells={freshCells} showDone={showDone} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function Row({
  story,
  months,
  freshCells,
  showDone,
}: {
  story: Story
  months: number[]
  freshCells: ReadonlySet<string>
  showDone: boolean
}) {
  const { pair, status, main, past, active, reviewed } = story
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
          <span className="sr-only">. Сейчас: {PAIR_STATUS_LABEL[status]}</span>
        </Link>
      </th>
      {months.map((m) => (
        <MonthCell key={m} cell={pair.cells.find((c) => c.month === m)} month={m} due={m <= dueMonths(pair)} fresh={freshCells.has(`${pair.pair_id}:${m}`)} />
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
        ) : past ? (
          <>
            <span className={s.mainTitle}>{past.title}</span>
            <span className={s.mainSub}>{monthsPhrase(past.months)} · выправилось</span>
          </>
        ) : (
          <span className={s.mainTitle}>{pair.last_month === 0 ? 'Ждём первую анкету' : 'Сигналов не было'}</span>
        )}
      </td>
      {showDone && <td className={s.done}>{active > 0 ? `${reviewed} из ${active}` : ''}</td>}
    </tr>
  )
}

const CELL_CLASS: Record<PairStatus, string | undefined> = { ok: s.ok, watch: s.watch, risk: s.risk }

function MonthCell({ cell, month, due, fresh }: { cell: Cell | undefined; month: number; due: boolean; fresh: boolean }) {
  const none = !cell || (cell.missing.intern && cell.missing.mentor)
  // Пара до этого месяца ещё не дошла: клетка пустая, это не пропуск.
  if (none && !due) return <td className={s.monthTd} />
  if (!cell || none) {
    return (
      <td className={clsx(s.monthTd, s.none, fresh && s.fresh)} title={`${month}-й месяц: анкет нет`}>
        <div className={s.cellEmpty}>нет анкет</div>
      </td>
    )
  }
  const intern = cell.missing.intern ? 'не ответил' : formatNumber(cell.intern_index)
  const mentor = cell.missing.mentor ? 'не ответил' : formatNumber(cell.mentor_index)
  const label = `${month}-й месяц, ${PAIR_STATUS_LABEL[cell.status].toLowerCase()}. Стажёр ${intern}, наставник ${mentor}`
  return (
    <td className={clsx(s.monthTd, CELL_CLASS[cell.status], fresh && s.fresh)} title={label}>
      <div className={s.cell}>
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className={clsx(s.vIntern, cell.missing.intern && s.vNone)}>
          {cell.missing.intern ? 'нет' : intern}
        </span>
        <span aria-hidden="true" className={clsx(s.vMentor, cell.missing.mentor && s.vNone)}>
          {cell.missing.mentor ? 'нет' : mentor}
        </span>
      </div>
    </td>
  )
}
