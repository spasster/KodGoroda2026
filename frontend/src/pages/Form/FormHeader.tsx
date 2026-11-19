// Шапка формы и страницы QR: знак и «Сверка», справа счётчик оценок и одна
// кнопка темы 40px. Под шапкой полоса прогресса 3px (system.md, «Мобильная форма»).

import clsx from 'clsx'
import { Moon, Sun } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

import { useTheme } from '../../lib/theme'
import s from './Form.module.css'

export function FormHeader({
  children,
  progress,
  wide = false,
}: {
  // Что встаёт справа перед кнопкой темы: «Оценок 3 из 5».
  children?: ReactNode
  // Доля ответов от 0 до 1. null: полосы нет (загрузка, «Спасибо», QR).
  progress?: number | null
  // Страница QR: шапка по ширине дашборда, а не колонки формы.
  wide?: boolean
}) {
  const { resolved, toggle } = useTheme()
  const dark = resolved === 'dark'
  return (
    <header className={s.bar}>
      <div className={clsx(wide ? 'wrap' : s.wrap, s['bar-row'])}>
        <span className={s.logo}>
          <i aria-hidden="true" />
          Сверка
        </span>
        {children}
        <button type="button" className={s['theme-btn']} onClick={toggle} aria-label={dark ? 'Светлая тема' : 'Тёмная тема'}>
          {dark ? <Sun aria-hidden="true" strokeWidth={1.6} /> : <Moon aria-hidden="true" strokeWidth={1.6} />}
        </button>
      </div>
      {progress != null && (
        <div className={s.track} aria-hidden="true">
          <i style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
    </header>
  )
}

// Заголовок вкладки, пока страница открыта.
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title
    return () => {
      document.title = prev
    }
  }, [title])
}
