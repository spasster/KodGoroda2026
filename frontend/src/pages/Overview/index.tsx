// Заглушка обзора: данные из useOverview и useSignals простым текстом.

import { Link } from 'react-router-dom'

import { useOverview, useSignals } from '../../api/queries'
import {
  EMPTY,
  formatCount,
  formatNumber,
  formatRelative,
  monthLabel,
  PAIR_STATUS_LABEL,
  ROLE_LABEL,
  SEVERITY_LABEL,
  sourceLabel,
  WORDS,
} from '../../lib/format'

const TREND = { up: 'растёт', down: 'падает', flat: 'ровно' } as const

export function OverviewPage() {
  const overview = useOverview()
  const signals = useSignals({ status: 'open', active: true })

  if (overview.isPending) return <p>Загружаем обзор</p>
  if (overview.isError) return <p>Ошибка: {overview.error.message}</p>
  const o = overview.data
  const t = o.totals

  return (
    <div>
      <h1>Обзор</h1>
      <p data-testid="totals">
        {formatCount(t.pairs, WORDS.pair)}: риск {t.risk}, внимание {t.watch}, норма {t.ok}. Открыто{' '}
        {formatCount(t.open_signals, WORDS.signal)}, подтвердилось {t.confirmed}, ложная тревога {t.rejected}. В базе{' '}
        {formatCount(t.responses, WORDS.response)}. Обновлено {formatRelative(o.updated_at)}.
      </p>

      <h2>Пары по месяцам (стажёр / наставник)</h2>
      <table>
        <thead>
          <tr>
            <th>Пара</th>
            {o.months.map((m) => (
              <th key={m}>{monthLabel(m)}</th>
            ))}
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {o.pairs.map((p) => (
            <tr key={p.pair_id}>
              <td>
                <Link to={`/pairs/${p.pair_id}`}>{p.pair_id}</Link> {p.intern_id} / {p.mentor_id}
              </td>
              {o.months.map((m) => {
                const c = p.cells.find((cell) => cell.month === m)
                return (
                  <td key={m}>
                    {c ? `${formatNumber(c.intern_index)} / ${formatNumber(c.mentor_index)}, ${PAIR_STATUS_LABEL[c.status]}` : EMPTY}
                  </td>
                )
              })}
              <td>
                {PAIR_STATUS_LABEL[p.status]}, {TREND[p.trend]}, сигналов {p.open_signals}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Активные сигналы</h2>
      {signals.isPending && <p>Загружаем сигналы</p>}
      {signals.isError && <p>Ошибка: {signals.error.message}</p>}
      <ul>
        {signals.data?.map((s) => (
          <li key={s.key}>
            [{SEVERITY_LABEL[s.severity]}] <Link to={`/pairs/${s.pair_id}`}>{s.pair_id}</Link>, {monthLabel(s.month)}:{' '}
            {s.title}
          </li>
        ))}
      </ul>

      <h2>Последние поступления</h2>
      <ul data-testid="recent">
        {o.recent.map((r) => (
          <li key={`${r.pair_id}:${r.role}:${r.month}:${r.at}`}>
            {formatRelative(r.at)}: {ROLE_LABEL[r.role]} {r.person_id}, пара {r.pair_id}, {monthLabel(r.month)},{' '}
            {sourceLabel(r.source)}
          </li>
        ))}
      </ul>
    </div>
  )
}
