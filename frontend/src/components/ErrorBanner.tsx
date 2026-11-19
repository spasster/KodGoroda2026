// Ошибка: карточка с заголовком и кнопкой «Повторить», role="alert". Без красного.

import clsx from 'clsx'

import { ApiError } from '../api/client'
import { formatClock } from '../lib/format'
import { Button } from './Button'
import s from './States.module.css'

export function ErrorBanner({
  title,
  text,
  onRetry,
  retrying,
  className,
}: {
  title: string
  text?: string
  onRetry?: () => void
  // Повтор идёт: кнопка aria-busy.
  retrying?: boolean
  className?: string
}) {
  return (
    <div role="alert" className={clsx(s.card, className)}>
      <p className={s.title}>{title}</p>
      {text && <p className={s.text}>{text}</p>}
      {onRetry && (
        <Button onClick={onRetry} busy={retrying}>
          Повторить
        </Button>
      )}
    </div>
  )
}

// dataUpdatedAt из useQuery: 0, если данных ещё не было.
function loadErrorText(error: unknown, dataUpdatedAt: number): { title: string; text?: string } {
  // Бэкенд ответил и объяснил (422 и прочие 4xx): показываем его detail.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return { title: error.message }
  if (dataUpdatedAt > 0) return { title: 'Сервер не отвечает', text: `Данные на экране от ${formatClock(dataUpdatedAt)}` }
  return { title: 'Не удалось загрузить данные' }
}

// Ошибка запроса react-query целиком: <LoadError query={overview} />.
export function LoadError({
  query,
  className,
}: {
  query: { error: unknown; dataUpdatedAt: number; refetch: () => unknown; isFetching: boolean }
  className?: string
}) {
  const { title, text } = loadErrorText(query.error, query.dataUpdatedAt)
  return <ErrorBanner title={title} text={text} onRetry={() => void query.refetch()} retrying={query.isFetching} className={className} />
}
