// Таблица «стажёр × месяц» на странице «Программа». Два режима:
// «С сигналами» (гантель стажёр/наставник в клетке, группы по статусу)
// и «Как видит HR сейчас» (одна средняя за месяц и порог, как без дашборда).

import clsx from 'clsx'
import { Fragment, useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import type { Cell, PairStatus } from '../../api/types'
import { Dot } from '../../app/status'
import { EMPTY, PAIR_STATUS_LABEL, formatNumber, personName } from '../../lib/format'
import { situationMonths } from '../../lib/rules'
import { sortStories, type Story } from './model'
import s from './ProgramTable.module.css'

const STATUSES: PairStatus[] = ['risk', 'watch', 'ok']

type Mode = 'signals' | 'hr'

interface Props {
  stories: Story[]
  /** Месяцы с данными. */
  months: number[]
  /** Месяц текущего сбора: показываем столбцом, даже если данных нет. */
  collect: number | null
  scale: { min: number; max: number }
  /** Порог «как видит HR»: средняя ниже него — тревога. */
  baseline: number
}

// Средняя за месяц, как её видит HR без дашборда: среднее двух индексов, какие есть.
// Как бэкенд считает базовый способ (backend/app/extra.py): HR смотрит среднюю
// оценку каждой анкеты за месяц и реагирует, если хоть одна ниже порога. В клетке
// поэтому меньшая из двух средних: стажёра и наставника.
function monthAverage(cell: Cell | undefined): number | null {
  if (!cell) return null
  const v = [cell.intern_index, cell.mentor_index].filter((x): x is number => x != null)
  return v.length ? Math.min(...v) : null
}

function lastCell(story: Story, months: number[]): Cell | undefined {
  return [...months]
    .reverse()
    .map((m) => story.pair.cells.find((c) => c.month === m))
    .find((c) => c && monthAverage(c) != null)
}

export function ProgramTable({ stories, months, collect, scale, baseline }: Props) {
  const [mode, setMode] = useState<Mode>('signals')
  const shown = collect != null && !months.includes(collect) ? [...months, collect] : months
  const flat = sortStories(stories)
  const cols = shown.length + 3
  const ctx = { months: shown, collect, scale, baseline, mode }

  return (
    <>
      <div className={s.bar}>
        <div className={s.toggle} role="group" aria-label="Режим таблицы">
          <button type="button" aria-pressed={mode === 'signals'} onClick={() => setMode('signals')}>
            С сигналами
          </button>
          <button type="button" aria-pressed={mode === 'hr'} onClick={() => setMode('hr')}>
            Как видит HR сейчас
          </button>
        </div>
        {mode === 'hr' ? (
          <p className={s.caption}>Так HR видит программу без дашборда: средняя оценка каждой анкеты за месяц, в клетке меньшая из двух. Порог {formatNumber(baseline)} выбрали мы</p>
        ) : (
          <p className={s.caption}>
            {/* Светофор клетки словами ТЗ. */}
            <span>
              <i className={clsx(s.swatch, s.risk)} aria-hidden="true" /> критичный сигнал
            </span>
            <span>
              <i className={clsx(s.swatch, s.watch)} aria-hidden="true" /> зона внимания
            </span>
            <span>
              <i className={clsx(s.swatch, s.ok)} aria-hidden="true" /> положительная оценка
            </span>
            <span>
              <i className={s.keyIntern} aria-hidden="true" /> стажёр
            </span>
            <span>
              <i className={s.keyMentor} aria-hidden="true" /> наставник
            </span>
            <span>красная черта: разрыв от 1 балла</span>
          </p>
        )}
      </div>

      <div className={s.scroll}>
        <table className={s.table} data-mode={mode}>
          <thead>
            <tr>
              <th scope="col" className={s.thWho}>
                Стажёр
              </th>
              {shown.map((m) => (
                <th key={m} scope="col" className={clsx(s.thMonth, m === collect && s.collect)}>
                  {m === collect ? `${m} · сбор` : m}
                </th>
              ))}
              <th scope="col" className={s.thMain}>
                Главное
              </th>
              <th scope="col" className={s.thDone}>
                {mode === 'signals' ? 'Разобрано' : ''}
              </th>
            </tr>
          </thead>
          <tbody key={mode} className={s.body}>
            {mode === 'signals' ? (
              STATUSES.map((status) => {
                const list = flat.filter((st) => st.status === status)
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
                      <Row key={st.pair.pair_id} story={st} {...ctx} />
                    ))}
                  </Fragment>
                )
              })
            ) : (
              flat.map((st) => <Row key={st.pair.pair_id} story={st} {...ctx} />)
            )}
          </tbody>
        </table>
      </div>

      <ul className={s.cards}>
        {flat.map((st) => (
          <PairCard key={st.pair.pair_id} story={st} months={months} baseline={baseline} mode={mode} />
        ))}
      </ul>
    </>
  )
}

interface RowProps {
  story: Story
  months: number[]
  collect: number | null
  scale: { min: number; max: number }
  baseline: number
  mode: Mode
}

function Row({ story, months, collect, scale, baseline, mode }: RowProps) {
  const { pair, status, active, reviewed } = story
  const navigate = useNavigate()
  const to = `/pairs/${pair.pair_id}`
  // Клик по строке открывает стажёра; ссылка в первой клетке работает с клавиатуры и сама.
  const open = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('a')) return
    navigate(to)
  }
  return (
    <tr className={s.row} onClick={open}>
      <th scope="row" className={s.who}>
        <Link to={to} className={s.link}>
          <span className={s.nameLine}>
            {mode === 'signals' && <Dot status={status} />}
            <span className={s.name}>{personName(pair.intern_name, pair.intern_id)}</span>
          </span>
          <span className={clsx(s.mentor, mode === 'signals' && s.indent)}>наставник {personName(pair.mentor_name, pair.mentor_id)}</span>
        </Link>
      </th>
      {months.map((m) => (
        <MonthCell
          key={m}
          cell={pair.cells.find((c) => c.month === m)}
          collecting={m === collect}
          scale={scale}
          baseline={baseline}
          mode={mode}
        />
      ))}
      <td className={s.main}>{mode === 'signals' ? <MainSignal story={story} /> : <MainHr story={story} months={months} baseline={baseline} />}</td>
      <td className={s.done}>{mode === 'signals' && active > 0 ? `${reviewed} из ${active}` : ''}</td>
    </tr>
  )

}

function MainSignal({ story }: { story: Story }) {
  const { main, active, past } = story
  if (!main && past) {
    return (
      <>
        <span className={s.mainTitle}>{past.title}</span>
        <span className={s.mainSub}>{situationMonths(past)} · выправилось</span>
      </>
    )
  }
  if (!main) return <span className={s.mainTitle}>Сигналов не было</span>
  return (
    <>
      <span className={s.mainTitle}>{main.title}</span>
      <span className={s.mainSub}>
        {situationMonths(main)}
        {active > 1 && ` · ещё ${active - 1}`}
      </span>
    </>
  )
}

function MainHr({ story, months, baseline }: { story: Story; months: number[]; baseline: number }) {
  const avg = monthAverage(lastCell(story, months))
  if (avg == null) return <span className={s.mainTitle}>{EMPTY}</span>
  const low = avg < baseline
  return (
    <span className={s.mainTitle}>
      {low ? `Средняя анкеты ${formatNumber(avg)}, ниже ${formatNumber(baseline)}` : `Обе анкеты выше ${formatNumber(baseline)}. Тревоги нет`}
    </span>
  )
}

function MonthCell({ cell, collecting, scale, baseline, mode }: { cell: Cell | undefined; collecting: boolean; scale: { min: number; max: number }; baseline: number; mode: Mode }) {
  const answered = !!cell && (!cell.missing.intern || !cell.missing.mentor)
  // Месяц сбора без анкет: пустые кольца вместо оценок.
  if (collecting && !answered) {
    return (
      <td className={clsx(s.monthTd, s.collect)} title="Анкеты за этот месяц ещё собираем">
        <div className={s.cell}>
          <i className={s.ring} />
        </div>
      </td>
    )
  }
  if (!cell || !answered) {
    return (
      <td className={s.monthTd}>
        <div className={s.cell} />
      </td>
    )
  }
  const iv = cell.missing.intern ? null : cell.intern_index
  const mv = cell.missing.mentor ? null : cell.mentor_index

  if (mode === 'hr') {
    const avg = monthAverage({ ...cell, intern_index: iv, mentor_index: mv })
    const low = avg != null && avg < baseline
    return (
      <td className={clsx(s.monthTd, low && s.risk, collecting && s.collect)} title={`Средняя анкеты стажёра ${formatNumber(iv)}, наставника ${formatNumber(mv)}. Порог ${formatNumber(baseline)}`}>
        <div className={s.cell}>
          <span className={s.num}>{avg == null ? EMPTY : formatNumber(avg)}</span>
        </div>
      </td>
    )
  }

  return (
    <td
      className={clsx(s.monthTd, cell.status === 'risk' && s.risk, cell.status === 'watch' && s.watch, cell.status === 'ok' && s.ok, collecting && s.collect)}
      title={`Стажёр ${formatNumber(iv)}, наставник ${formatNumber(mv)}`}
    >
      <div className={s.cell}>
        <Dumbbell intern={iv} mentor={mv} scale={scale} />
        <span className={clsx(s.num, iv == null && s.none)}>{iv == null ? EMPTY : formatNumber(iv)}</span>
      </div>
    </td>
  )
}

// Мини-ось шкалы анкеты: точка стажёра, кольцо наставника, между ними линия. Разрыв от 1 балла красный.
export function Dumbbell({ intern, mentor, scale }: { intern: number | null; mentor: number | null; scale: { min: number; max: number } }) {
  // Ось клетки от 2 до верха шкалы: оценки живут в верхней половине, и на шкале
  // от 1 разрыв 4,8 против 3,0 сжимался до нескольких пикселей. Ниже 2 прижимаем к низу.
  const H = 44
  const pad = 5
  const lo = Math.min(Math.max(scale.min, 2), scale.max - 1)
  const clamp = (v: number) => Math.max(lo, Math.min(scale.max, v))
  const y = (v: number) => pad + ((scale.max - clamp(v)) / (scale.max - lo)) * (H - 2 * pad)
  const cx = 8
  const big = intern != null && mentor != null && Math.abs(intern - mentor) >= 1
  return (
    <svg className={s.dumbbell} width="16" height={H} viewBox={`0 0 16 ${H}`} aria-hidden="true">
      <line x1={cx} x2={cx} y1={y(scale.max)} y2={y(lo)} className={s.tick} />
      {intern != null && mentor != null && (
        <line x1={cx} x2={cx} y1={y(intern)} y2={y(mentor)} className={big ? s.linkBig : s.linkSmall} />
      )}
      {mentor != null && <circle cx={cx} cy={y(mentor)} r="4" className={s.dotMentor} />}
      {intern != null && <circle cx={cx} cy={y(intern)} r="4" className={s.dotIntern} />}
    </svg>
  )
}

// Список вместо таблицы на узком экране.
function PairCard({ story, months, baseline, mode }: { story: Story; months: number[]; baseline: number; mode: Mode }) {
  const { pair, status, main, past } = story
  const cell = lastCell(story, months)
  const avg = monthAverage(cell)
  const summary =
    mode === 'hr'
      ? avg == null
        ? null
        : avg < baseline
          ? `Средняя анкеты ${formatNumber(avg)}, ниже ${formatNumber(baseline)}`
          : `Обе анкеты выше ${formatNumber(baseline)}. Тревоги нет`
      : cell && `Последний месяц: стажёр ${formatNumber(cell.intern_index)} · наставник ${formatNumber(cell.mentor_index)}`
  return (
    <li>
      <Link to={`/pairs/${pair.pair_id}`} className={s.card}>
        <span className={s.nameLine}>
          {mode === 'signals' && <Dot status={status} />}
          <span className={s.name}>{personName(pair.intern_name, pair.intern_id)}</span>
        </span>
        <span className={s.mentor}>наставник {personName(pair.mentor_name, pair.mentor_id)}</span>
        {summary && <span className={s.cardSum}>{summary}</span>}
        {mode === 'signals' && <span className={s.mainTitle}>{main ? main.title : past ? `${past.title} · выправилось` : 'Сигналов не было'}</span>}
      </Link>
    </li>
  )
}
