// Ошибка: плашка с рамкой, значок круга с чертой, role="alert", кнопка «Повторить».
// Без извинений и без красного.

import clsx from 'clsx'
import { CircleAlert } from 'lucide-react'

import { ApiError } from '../api/client'
import { formatClock } from '../lib/format'
import { Button } from './Button'
import s from './States.module.css'

export interface ErrorBannerProps {
  title: string
  text?: string
  onRetry?: () => void
  // Повтор идёт: кнопка aria-busy.
  retrying?: boolean
  className?: string
}

export function ErrorBanner({ title, text, onRetry, retrying, className }: ErrorBannerProps) {
  return (
    <div role="alert" className={clsx(s.banner, className)}>
      <CircleAlert aria-hidden="true" strokeWidth={1.7} />
      <div>
        <b className={s['banner-title']}>{title}</b>
        {text && <p className={s['banner-text']}>{text}</p>}
        {onRetry && (
          <Button className={s['banner-btn']} onClick={onRetry} busy={retrying}>
            Повторить
          </Button>
        )}
      </div>
    </div>
  )
}

// Тексты ошибки запроса по system.md, раздел «Ошибка». dataUpdatedAt из useQuery:
// 0, если данных ещё не было.
export function loadErrorText(error: unknown, dataUpdatedAt = 0): { title: string; text?: string } {
  // Бэкенд ответил и объяснил (422 и прочие 4xx): показываем его detail.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return { title: error.message }
  if (dataUpdatedAt > 0) {
    return {
      title: 'Сервер не отвечает',
      text: `Данные на экране от ${formatClock(dataUpdatedAt)}. Проверьте, что сервер запущен (make up или make dev), и повторите.`,
    }
  }
  return {
    title: 'Не удалось загрузить данные',
    text: 'Сервер не ответил. Проверьте, что он запущен (make up или make dev), и повторите.',
  }
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
  return (
    <ErrorBanner
      title={title}
      text={text}
      onRetry={() => void query.refetch()}
      retrying={query.isFetching}
      className={className}
    />
  )
}
