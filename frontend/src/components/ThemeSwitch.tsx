// Переключатель темы: капсула с кнопками «Светлая» и «Тёмная». Без выбора тема
// берётся из системы, выбор запоминается (lib/theme.ts). На телефоне только значки.

import clsx from 'clsx'
import { Moon, Sun } from 'lucide-react'

import { useTheme, type Theme } from '../lib/theme'
import s from './ThemeSwitch.module.css'

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Светлая', Icon: Sun },
  { value: 'dark', label: 'Тёмная', Icon: Moon },
]

export function ThemeSwitch({ className }: { className?: string }) {
  const { resolved, setPref } = useTheme()
  return (
    <div role="group" aria-label="Тема" className={clsx(s.theme, className)}>
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={resolved === value}
          aria-label={`${label} тема`}
          onClick={() => setPref(value)}
        >
          <Icon aria-hidden="true" strokeWidth={1.6} />
          <span aria-hidden="true">{label}</span>
        </button>
      ))}
    </div>
  )
}
