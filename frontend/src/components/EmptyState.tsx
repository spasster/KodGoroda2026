// Пустой экран говорит, что сделать: заголовок 24px, текст 16px, кнопки.
// Тексты для каждого места в system.md, раздел «Пустые состояния».

import clsx from 'clsx'
import type { ReactNode } from 'react'

import s from './States.module.css'

export interface EmptyStateProps {
  // Без заголовка: «Активных сигналов нет…» в карточке пары.
  title?: string
  text?: ReactNode
  // Кнопки: Button или LinkButton.
  actions?: ReactNode
  className?: string
}

export function EmptyState({ title, text, actions, className }: EmptyStateProps) {
  return (
    <div className={clsx(s.empty, className)}>
      {title && <h3>{title}</h3>}
      {text && <p>{text}</p>}
      {actions && <div className={s.row}>{actions}</div>}
    </div>
  )
}
