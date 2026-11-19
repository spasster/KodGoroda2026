// «Ответы по вопросам»: тепловая карта, строки вопросы стажёра и наставника,
// колонки месяцы. Читать можно по цифрам, цвет только помогает: 1 и 2 резко
// темнее, потому что они и значат проблему.

import clsx from 'clsx'
import { useLayoutEffect, useRef } from 'react'

import type { PairDetail, Role, Survey } from '../../api/types'
import { RoleLabel, SectionHead } from '../../components'
import type { Scale } from '../../lib/rules'
import { formatScore, heatStep } from './model'
import s from './Pair.module.css'

export function Heatmap({
  pair,
  survey,
  scale,
  months,
  collect,
}: {
  pair: PairDetail
  survey: Survey
  scale: Scale
  months: number
  collect: number | null
}) {
  const monthsList = Array.from({ length: months }, (_, i) => i + 1)
  // На телефоне карта шире экрана: открываем её на свежих месяцах, старые слева.
  const scroller = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth
  }, [])

  const rows = (role: Role) =>
    survey.roles[role].questions
      .filter((q) => q.type === 'scale')
      .map((q) => (
        <tr key={`${role}:${q.id}`}>
          <th scope="row" className={s.heatQ}>
            {q.text}
          </th>
          {monthsList.map((m) => {
            const v = pair.series.find((p) => p.month === m)?.[role]?.[q.id] ?? null
            if (v == null) {
              // Месяц сбора ещё идёт: «ждём», прошедший месяц без ответа: «нет».
              const word = m === collect ? 'ждём' : m <= pair.last_month ? 'нет' : ''
              return (
                <td key={m} className={clsx(s.heatCell, word && s.heatNone)}>
                  {word}
                </td>
              )
            }
            return (
              <td key={m} className={clsx(s.heatCell, s[`h${heatStep(v, scale)}`])}>
                {formatScore(v)}
              </td>
            )
          })}
        </tr>
      ))

  return (
    <section className={s.block} aria-labelledby="heat-h">
      <SectionHead id="heat-h" title="Ответы по вопросам" note={<HeatLegend />} />
      <div className={s.heatScroll} ref={scroller}>
        <table className={clsx(s.heat, 'num')}>
          <caption className="sr-only">Оценки по каждому вопросу анкеты, по месяцам</caption>
          <thead>
            <tr>
              <td />
              {monthsList.map((m) => (
                <th key={m} scope="col">
                  <span className="sr-only">Месяц </span>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th colSpan={months + 1} scope="rowgroup" className={s.heatGroup}>
                <RoleLabel role="intern" id={pair.intern_id} />
              </th>
            </tr>
            {rows('intern')}
            <tr>
              <th colSpan={months + 1} scope="rowgroup" className={s.heatGroup}>
                <RoleLabel role="mentor" id={pair.mentor_id} />
              </th>
            </tr>
            {rows('mentor')}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// «ниже 1 2 3 4 5 выше».
function HeatLegend() {
  return (
    <span className={s.heatLegend} aria-hidden="true">
      ниже
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={s[`h${n}`]}>
          {n}
        </i>
      ))}
      выше
    </span>
  )
}
