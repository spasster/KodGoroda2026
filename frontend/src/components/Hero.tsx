// Тёмная полоса вверху экрана: мелкая строка, крупный заголовок, справа место под действие.
// Цвета в токенах --hero-*, полоса тёмная в обеих темах.

import type { ReactNode } from 'react'

import s from './Hero.module.css'

interface Props {
  /** Строка над заголовком: навигация или контекст. */
  top?: ReactNode
  title: ReactNode
  /** Строка под заголовком. */
  sub?: ReactNode
  aside?: ReactNode
}

export function Hero({ top, title, sub, aside }: Props) {
  return (
    <section className={s.hero}>
      <div className={`wrap ${s.in}`}>
        <div className={s.text}>
          {top && <div className={s.top}>{top}</div>}
          <h1 className={s.title}>{title}</h1>
          {sub && <p className={s.sub}>{sub}</p>}
        </div>
        {aside && <div className={s.aside}>{aside}</div>}
      </div>
    </section>
  )
}
