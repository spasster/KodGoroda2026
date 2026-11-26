// Статус пары и месяца, светофор из ТЗ: positive / warning / negative дизайн-системы МГТС.
// Dot — точка в строках и легендах, StatusText — пилюля StatusPill со словом.
// Подписи в lib/format.ts, PAIR_STATUS_LABEL.

import clsx from 'clsx'

import type { PairStatus } from '../api/types'
import { StatusPill } from '../ds/components/data-display/StatusPill'
import { PAIR_STATUS_LABEL } from '../lib/format'
import s from './status.module.css'

export function Dot({ status, className }: { status: PairStatus; className?: string }) {
  return <i aria-hidden="true" className={clsx(s.dot, s[status], className)} />
}

const TONE = { risk: 'negative', watch: 'warning', ok: 'positive' } as const

export function StatusText({ status }: { status: PairStatus }) {
  return <StatusPill tone={TONE[status]}>{PAIR_STATUS_LABEL[status]}</StatusPill>
}
