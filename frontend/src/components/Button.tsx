// Кнопки: второстепенная (серая заливка) и основная (синяя, одно главное действие).

import clsx from 'clsx'
import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

import s from './Controls.module.css'

type Variant = 'default' | 'brand'

function buttonClass(variant: Variant = 'default'): string {
  return clsx(s.btn, variant === 'brand' && s.brand)
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  // Идёт запрос: aria-busy, повторное нажатие игнорируется, текст не меняется.
  busy?: boolean
}

export function Button({ variant, busy, className, type = 'button', onClick, ...rest }: ButtonProps) {
  const click = (e: MouseEvent<HTMLButtonElement>) => {
    if (busy) {
      e.preventDefault()
      return
    }
    onClick?.(e)
  }
  return (
    <button
      type={type}
      className={clsx(buttonClass(variant), className)}
      aria-busy={busy || undefined}
      onClick={click}
      {...rest}
    />
  )
}

// Переход внутри приложения в виде кнопки.
export function LinkButton({ variant, className, ...rest }: LinkProps & { variant?: Variant }) {
  return <Link className={clsx(buttonClass(variant), className)} {...rest} />
}
