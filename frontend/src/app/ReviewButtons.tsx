// Временные кнопки отметки HR для заглушек страниц.

import type { Signal } from '../api/types'
import { useReview } from '../api/queries'
import { REVIEW_STATUS_LABEL } from '../lib/format'

export function ReviewButtons({ signal }: { signal: Signal }) {
  const review = useReview()
  const current = signal.review.status

  return (
    <span>
      Отметка: {REVIEW_STATUS_LABEL[current]}.{' '}
      {current !== 'confirmed' && (
        <button type="button" onClick={() => review.mutate({ key: signal.key, status: 'confirmed' })}>Подтвердилось</button>
      )}{' '}
      {current !== 'rejected' && (
        <button type="button" onClick={() => review.mutate({ key: signal.key, status: 'rejected' })}>Ложная тревога</button>
      )}{' '}
      {current !== 'open' && (
        <button type="button" onClick={() => review.mutate({ key: signal.key, status: 'open' })}>Вернуть</button>
      )}
      {review.isError && <span> Ошибка: {review.error.message}</span>}
    </span>
  )
}
