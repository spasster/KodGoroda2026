// Таблица «вопрос × месяц»: строки сгруппированы по тому, кто отвечает, клетка залита по оценке.
// Нужна аналитике (средняя по парам) и карточке стажёра (оценки одной пары).

import clsx from 'clsx'

import type { Role } from '../api/types'
import { ROLE_LABEL, formatNumber } from '../lib/format'
import s from './QuestionTable.module.css'

export type Tone = 'low' | 'mid' | 'fine' | 'none'

export interface QuestionRow {
  id: string
  text: string
  values: (number | null)[]
  /** Есть хотя бы у одной строки: появляется колонка «Изменение». */
  delta?: number | null
}

interface Props {
  months: number[]
  groups: { role: Role; rows: QuestionRow[] }[]
  tone: (value: number | null) => Tone
  compact?: boolean
}

export function QuestionTable({ months, groups, tone, compact }: Props) {
  const withDelta = groups.some((g) => g.rows.some((r) => r.delta !== undefined))
  return (
    <div className={s.scroll}>
      <table className={clsx(s.table, compact && s.compact)}>
        <thead>
          <tr>
            <th />
            {months.map((m) => (
              <th key={m}>{m}</th>
            ))}
            {withDelta && <th>Изменение</th>}
          </tr>
        </thead>
        {groups.map(({ role, rows }) => (
          <tbody key={role}>
            <tr>
              <th colSpan={months.length + 1 + Number(withDelta)} className={s.role}>
                Отвечает {ROLE_LABEL[role]}
              </th>
            </tr>
            {rows.map((q) => (
              <tr key={q.id}>
                <th scope="row">{q.text}</th>
                {months.map((m, i) => {
                  const v = q.values[i] ?? null
                  return (
                    <td key={m}>
                      <span className={clsx(s.cell, s[tone(v)])}>{v == null ? '—' : formatNumber(v)}</span>
                    </td>
                  )
                })}
                {withDelta && (
                  <td className={clsx(s.delta, q.delta != null && q.delta <= -0.5 && s.deltaBad)}>
                    {q.delta == null ? '—' : `${q.delta > 0 ? '+' : q.delta < 0 ? '−' : ''}${formatNumber(Math.abs(q.delta))}`}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
