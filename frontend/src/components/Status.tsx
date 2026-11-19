// Статус пары и клетки месяца: знак, знак со словом, плашка пары.
// Статус всегда тремя каналами: заливка или обводка, знак и слово.

import clsx from 'clsx'
import type { AnchorHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

import type { PairStatus } from '../api/types'
import { PAIR_STATUS_LABEL } from '../lib/format'
import s from './Status.module.css'

// collect: месяц сбора без анкет, кольцо 10px.
export type SignKind = PairStatus | 'collect'

export function StatusSign({ status, small, className }: { status: SignKind; small?: boolean; className?: string }) {
  return <i aria-hidden="true" className={clsx(s.sign, s[status], small && s.small, className)} />
}

// s: 15px в уведомлении; m: 16px/600 в колонке «Сейчас»; l: 20px/600 в шапке карточки.
export function StatusLabel({
  status,
  size = 'm',
  className,
}: {
  status: PairStatus
  size?: 's' | 'm' | 'l'
  className?: string
}) {
  return (
    <span className={clsx(s.label, s[`label-${size}`], className)}>
      <StatusSign status={status} small={size === 's'} />
      {PAIR_STATUS_LABEL[status]}
    </span>
  )
}

// Классы плашки, чтобы собрать её на своём элементе: Link внутри motion.span
// с layout для переезда плашек в итогах.
export function pairChipClass(status: PairStatus, size: 's' | 'm' = 'm'): string {
  return clsx(s.chip, s[`chip-${status}`], size === 's' && s['chip-s'])
}

type ChipProps = {
  pairId: string
  status: PairStatus
  size?: 's' | 'm'
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'>

// Плашка пары, ссылка на карточку. aria-label со статусом словами.
export function PairChip({ pairId, status, size = 'm', className, ...rest }: ChipProps) {
  return (
    <Link
      to={`/pairs/${pairId}`}
      className={clsx(pairChipClass(status, size), className)}
      aria-label={`${pairId}, ${PAIR_STATUS_LABEL[status].toLowerCase()}`}
      {...rest}
    >
      {pairId}
    </Link>
  )
}
