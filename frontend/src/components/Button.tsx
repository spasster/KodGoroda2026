// Кнопки из дизайн-системы МГТС: основная (синяя заливка, одна на экран) и
// второстепенная (синяя рамка). LinkButton выглядит так же, но это ссылка.

import clsx from 'clsx'
import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

import { Button as DsButton } from '../ds/components/core/Button'
import s from './Controls.module.css'

type Variant = 'default' | 'brand'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  // Идёт запрос: aria-busy, повторное нажатие игнорируется, текст не меняется.
  busy?: boolean
}

export function Button({ variant, busy, type = 'button', onClick, ...rest }: ButtonProps) {
  const click = (e: MouseEvent<HTMLButtonElement>) => {
    if (busy) {
      e.preventDefault()
      return
    }
    onClick?.(e)
  }
  return <DsButton variant={variant === 'brand' ? 'primary' : 'secondary'} type={type} aria-busy={busy || undefined} onClick={click} {...rest} />
}

// Переход внутри приложения в виде кнопки.
export function LinkButton({ variant, className, ...rest }: LinkProps & { variant?: Variant }) {
  return <Link className={clsx(s.btn, variant === 'brand' && s.brand, className)} {...rest} />
}
