// Тема: светлая, тёмная или как в системе. Выбор лежит в localStorage под ключом
// theme. Для явного выбора на <html> ставится data-theme, для системной атрибута
// нет и работает prefers-color-scheme (так устроен docs/design/tokens.css).
// Тот же выбор до загрузки React применяет скрипт в index.html.

import { useCallback, useSyncExternalStore } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

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
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, getThemePref)
  const dark = useSyncExternalStore(subscribe, systemDark)
  const resolved: Theme = pref === 'system' ? (dark ? 'dark' : 'light') : pref
  const toggle = useCallback(() => setThemePref(resolved === 'dark' ? 'light' : 'dark'), [resolved])
  return { pref, resolved, setPref: setThemePref, toggle }
}
