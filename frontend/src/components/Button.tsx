// Кнопки: обычная (40px, рамка), брендовая (единственное главное действие на
// экране или в уведомлении) и тихая (текст цвета ссылки, «Снять отметку»).
// Значки lucide-react внутри сами получают 16px.

import clsx from 'clsx'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

import s from './Controls.module.css'

export type ButtonVariant = 'default' | 'brand' | 'quiet'
export type ButtonSize = 'm' | 's'

export function buttonClass(variant: ButtonVariant = 'default', size: ButtonSize = 'm'): string {
  return clsx(s.btn, variant === 'brand' && s.brand, variant === 'quiet' && s.quiet, size === 's' && s.s)
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  // Идёт запрос: aria-busy, повторное нажатие игнорируется, текст не меняется.
  busy?: boolean
}

export function Button({ variant, size, busy, className, type = 'button', onClick, ...rest }: ButtonProps) {
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
      className={clsx(buttonClass(variant, size), className)}
      aria-busy={busy || undefined}
      onClick={click}
      {...rest}
    />
  )
}

// Ссылка в виде кнопки. to: переход внутри приложения; href: внешняя ссылка или
// /form в новой вкладке (target="_blank" ставьте сами).
type LinkButtonProps =
  | ({ to: LinkProps['to']; href?: never } & Omit<LinkProps, 'to'>)
  | ({ href: string; to?: never } & AnchorHTMLAttributes<HTMLAnchorElement>)

export function LinkButton({
  variant,
  size,
  className,
  ...rest
}: LinkButtonProps & { variant?: ButtonVariant; size?: ButtonSize }) {
  const cls = clsx(buttonClass(variant, size), className)
  if (rest.to !== undefined) return <Link className={cls} {...(rest as LinkProps)} />
  const anchor = rest as AnchorHTMLAttributes<HTMLAnchorElement>
  return <a className={cls} rel={anchor.target === '_blank' ? 'noopener' : undefined} {...anchor} />
}
