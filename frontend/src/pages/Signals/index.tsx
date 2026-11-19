// Заглушка очереди сигналов: фильтры и отметки HR простым текстом.

import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useSignals, type SignalFilters } from '../../api/queries'
import type { ReviewStatus, Severity } from '../../api/types'
import { ReviewButtons } from '../../app/ReviewButtons'
import { formatCount, monthLabel, ROLE_LABEL, SEVERITY_LABEL, SIGNAL_TYPE_LABEL, WORDS } from '../../lib/format'

export function SignalsPage() {
  const [filters, setFilters] = useState<SignalFilters>({ status: 'open', active: true, severity: 'all' })
  const signals = useSignals(filters)

  return (
    <div>
      <h1>Сигналы</h1>
      <p>
        <label>
          Статус:{' '}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as ReviewStatus | 'all' })}
          >
            <option value="open">не разобраны</option>
            <option value="confirmed">подтвердились</option>
            <option value="rejected">ложная тревога</option>
            <option value="all">все</option>
          </select>
        </label>{' '}
        <label>
          Важность:{' '}
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value as Severity | 'all' })}
          >
            <option value="all">любая</option>
            <option value="high">высокая</option>
            <option value="medium">средняя</option>
            <option value="low">низкая</option>
          </select>
        </label>{' '}
        <label>
          <input
            type="checkbox"
            checked={filters.active === true}
            onChange={(e) => setFilters({ ...filters, active: e.target.checked ? true : undefined })}
          />{' '}
          только активные
        </label>
      </p>

      {signals.isPending && <p>Загружаем сигналы</p>}
      {signals.isError && <p>Ошибка: {signals.error.message}</p>}
      {signals.data && <p>{formatCount(signals.data.length, WORDS.signal)}</p>}
      <ul>
        {signals.data?.map((s) => (
          <li key={s.key}>
            [{SEVERITY_LABEL[s.severity]}] <Link to={`/pairs/${s.pair_id}`}>{s.pair_id}</Link>,{' '}
            {SIGNAL_TYPE_LABEL[s.type]}, {ROLE_LABEL[s.role]}, {monthLabel(s.month)}: {s.title}. {s.explanation}{' '}
            Что сделать: {s.action}
            {s.quotes.map((q) => (
              <span key={`${q.role}:${q.month}:${q.start}`}> «{q.text}»</span>
            ))}{' '}
            <ReviewButtons signal={s} />
          </li>
        ))}
      </ul>
    </div>
  )
}
