// Режим проектора: клавиша P включает крупный текст и насыщенные заливки
// (:root[data-projector] в styles/base.css). Выбор лежит в localStorage.

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'projector'

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function apply(on: boolean) {
  if (on) document.documentElement.setAttribute('data-projector', '')
  else document.documentElement.removeAttribute('data-projector')
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Хранилище закрыто: режим живёт до перезагрузки.
  }
}

// Поле ввода или редактор: там p печатает букву.
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

// Возвращает, включён ли режим. Клавишу слушает один раз, в оболочке.
export function useProjector(): boolean {
  const [on, setOn] = useState(() => document.documentElement.hasAttribute('data-projector') || read())

  useEffect(() => {
    apply(on)
  }, [on])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || typing(e.target)) return
      // e.code, а не e.key: в русской раскладке p печатает «з».
      if (e.code === 'KeyP') setOn((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return on
}
