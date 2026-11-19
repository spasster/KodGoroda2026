// Статус пары и месяца по v2: цветная точка и слово. Текст всегда --text-1.
// Подписи в lib/format.ts, PAIR_STATUS_LABEL (docs/design/v2.md, «Стиль»).

import clsx from 'clsx'

import type { PairStatus } from '../api/types'
import { PAIR_STATUS_LABEL } from '../lib/format'
import s from './status.module.css'

export function Dot({ status, className }: { status: PairStatus; className?: string }) {
  return <i aria-hidden="true" className={clsx(s.dot, s[status], className)} />
}

export function StatusText({ status, className }: { status: PairStatus; className?: string }) {
  return (
    <span className={clsx(s.label, className)}>
      <Dot status={status} />
      {PAIR_STATUS_LABEL[status]}
    </span>
  )
}
