// Заголовок экрана и заголовок раздела.

import clsx from 'clsx'
import type { ReactNode } from 'react'

import s from './PageHeader.module.css'

// «С кем поговорить» и пояснение под ним. children: что-то ещё под пояснением.
export function PageHeader({
  title,
  lead,
  children,
  className,
}: {
  title: ReactNode
  lead?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={clsx(s.top, className)}>
      <h1>{title}</h1>
      {lead && <p className={s.lead}>{lead}</p>}
      {children}
    </header>
  )
}

// «Пары по месяцам» + «Средняя оценка по шкале 1–5» + легенда справа.
// id ставится на h2: секции удобно подписывать aria-labelledby.
export function SectionHead({
  title,
  note,
  aside,
  id,
  className,
}: {
  title: ReactNode
  note?: ReactNode
  aside?: ReactNode
  id?: string
  className?: string
}) {
  return (
    <div className={clsx(s.section, className)}>
      <h2 id={id}>{title}</h2>
      {note && <p className={s.note}>{note}</p>}
      {aside && <div className={s.aside}>{aside}</div>}
    </div>
  )
}
