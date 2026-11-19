// Заглушка карточки пары: данные из usePair простым текстом.

import { Link, useParams } from 'react-router-dom'

import { usePair } from '../../api/queries'
import { ReviewButtons } from '../../app/ReviewButtons'
import {
  formatNumber,
  monthLabel,
  PAIR_STATUS_LABEL,
  ROLE_LABEL,
  SEVERITY_LABEL,
  SIGNAL_TYPE_LABEL,
  TOPIC_LABEL,
} from '../../lib/format'

export function PairPage() {
  const { id } = useParams()
  const pair = usePair(id)

  if (pair.isPending) return <p>Загружаем пару</p>
  if (pair.isError) return <p>Ошибка: {pair.error.message}</p>
  const p = pair.data

  return (
    <div>
      <p>
        <Link to="/">К обзору</Link>
      </p>
      <h1>
        Пара {p.pair_id}: стажёр {p.intern_id}, наставник {p.mentor_id}
      </h1>
      <p>
        Статус: {PAIR_STATUS_LABEL[p.status]}. Последний месяц {p.last_month}. Индексы стажёра{' '}
        {formatNumber(p.intern_index_last)}, наставника {formatNumber(p.mentor_index_last)}.
      </p>

      <h2>Индексы по месяцам</h2>
      <ul data-testid="series">
        {p.series.map((s) => (
          <li key={s.month}>
            {monthLabel(s.month)}: стажёр {formatNumber(s.intern_index)}, наставник {formatNumber(s.mentor_index)}
          </li>
        ))}
      </ul>

      <h2>Сигналы</h2>
      <ul>
        {p.signals.map((s) => (
          <li key={s.key}>
            [{SEVERITY_LABEL[s.severity]}] {SIGNAL_TYPE_LABEL[s.type]}, {monthLabel(s.month)}
            {s.active ? '' : ', не активен'}: {s.title}. {s.explanation} Что сделать: {s.action}{' '}
            <ReviewButtons signal={s} />
          </li>
        ))}
      </ul>

      <h2>Комментарии</h2>
      <ul>
        {p.comments.map((c) => (
          <li key={`${c.role}:${c.month}:${c.question_id}`}>
            {monthLabel(c.month)}, {ROLE_LABEL[c.role]}: «{c.text}»
            {c.topics.length > 0 && <> Темы: {c.topics.map((t) => TOPIC_LABEL[t] ?? t).join(', ')}.</>}
            {c.highlights.map((h) => (
              <span key={`${h.signal_key}:${h.start}`}> Цитата для {h.signal_key}: «{c.text.slice(h.start, h.end)}».</span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}
