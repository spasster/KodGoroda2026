// Важность сигнала: три столбика 4×4, 4×9, 4×14px, как уровень сети, плюс слово.

import clsx from 'clsx'

import type { Severity } from '../api/types'
import { SEVERITY_LABEL } from '../lib/format'
import s from './Marks.module.css'

const FILLED: Record<Severity, number> = { high: 3, medium: 2, low: 1 }

export function SeverityBars({ severity, className }: { severity: Severity; className?: string }) {
  const on = FILLED[severity]
  return (
    <svg viewBox="0 0 16 14" className={clsx(s.bars, className)} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={i * 6} y={10 - i * 5} width={4} height={4 + i * 5} rx={1} className={i < on ? s.on : s.off} />
      ))}
    </svg>
  )
}

// «▮▮▮ высокая». Слово читается скринридером, столбики нет.
export function SeverityLabel({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span className={clsx(s.sev, className)}>
      <SeverityBars severity={severity} />
      {SEVERITY_LABEL[severity]}
    </span>
  )
}
