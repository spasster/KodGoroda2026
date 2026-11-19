// Сегментированный переключатель: фильтры на экране сигналов («Открытые 12»),
// выбор роли в форме (size="l"). Кнопки с aria-pressed в группе с подписью.

import clsx from 'clsx'

import s from './Controls.module.css'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  // Счётчик табличными цифрами после подписи.
  count?: number
}

export interface SegmentedProps<T extends string> {
  // Подпись группы для скринридера: «Отметка», «Важность», «Кто заполняет».
  label: string
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  // m: 34px, фильтры. l: 48px на всю ширину, форма.
  size?: 'm' | 'l'
  className?: string
}

export function Segmented<T extends string>({ label, options, value, onChange, size = 'm', className }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={clsx(s.seg, size === 'l' && s['seg-l'], className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={s['seg-btn']}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count != null && <span className={s['seg-count']}>{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
