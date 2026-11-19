// Пустой экран: короткий заголовок и кнопка, что делать дальше.

import clsx from 'clsx'
import type { ReactNode } from 'react'

import s from './States.module.css'

export function EmptyState({ title, actions, className }: { title: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={clsx(s.card, className)}>
      <h1 className={s.title}>{title}</h1>
      {actions && <div className={s.row}>{actions}</div>}
    </div>
  )
}
