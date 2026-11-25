// Шапка страницы на фоне страницы: заголовок, строка фактов, справа действие.
// Стиль: docs/design/v2.md, раздел «Шапка страницы».

import type { ReactNode } from 'react'

import s from './PageHeader.module.css'

interface Props {
  title: ReactNode
  /** Одна строка фактов под заголовком. */
  facts?: ReactNode
  /** Над заголовком: «← Обзор» и подобное. */
  top?: ReactNode
  aside?: ReactNode
}

export function PageHeader({ title, facts, top, aside }: Props) {
  return (
    <header className={`wrap ${s.head}`}>
      {top && <div className={s.top}>{top}</div>}
      <div className={s.row}>
        <div className={s.text}>
          <h1 className={s.title}>{title}</h1>
          {facts && <p className={s.facts}>{facts}</p>}
        </div>
        {aside && <div className={s.aside}>{aside}</div>}
      </div>
    </header>
  )
}
