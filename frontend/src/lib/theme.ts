// Тема: светлая, тёмная или как в системе. Выбор лежит в localStorage под ключом
// theme. Для явного выбора на <html> ставится data-theme, для системной атрибута
// нет и работает prefers-color-scheme (так устроен src/styles/tokens.css).
// Тот же выбор до загрузки React применяет скрипт в index.html.

import { useCallback, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

export type ThemePref = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

function readStored(): ThemePref {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

let current: ThemePref = readStored()
const listeners = new Set<() => void>()

export function getThemePref(): ThemePref {
  return current
}

// Мгновенно, без перехода.
export function setThemePref(pref: ThemePref) {
  current = pref
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // Приватный режим: тема работает до перезагрузки.
  }
  listeners.forEach((fn) => fn())
}

// Смена темы перекрёстным затуханием View Transitions, если браузер умеет и
// человек не просил убрать движение. Иначе мгновенно.
export function changeThemePref(pref: ThemePref) {
  const reduce = window.matchMedia(REDUCE_QUERY).matches
  if (reduce || typeof document.startViewTransition !== 'function') {
    setThemePref(pref)
    return
  }
  // flushSync, чтобы в снимок «после» попала и разметка React (aria-pressed).
  document.startViewTransition(() => flushSync(() => setThemePref(pref)))
}

function systemDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches
}

function subscribe(fn: () => void) {
  const media = window.matchMedia(DARK_QUERY)
  listeners.add(fn)
  media.addEventListener('change', fn)
  return () => {
    listeners.delete(fn)
    media.removeEventListener('change', fn)
  }
}

// pref: что выбрал человек. resolved: что на экране сейчас, например для цветов графика.
// setPref и toggle меняют тему с переходом, см. changeThemePref.
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, getThemePref)
  const dark = useSyncExternalStore(subscribe, systemDark)
  const resolved: Theme = pref === 'system' ? (dark ? 'dark' : 'light') : pref
  const toggle = useCallback(() => changeThemePref(resolved === 'dark' ? 'light' : 'dark'), [resolved])
  return { pref, resolved, setPref: changeThemePref, toggle }
}
