// Четыре итога: три статуса и анкеты за месяц сбора. Клик по статусу фильтрует
// таблицу, повторный снимает фильтр. Числа перекатываются при живом обновлении.

import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'

import type { PairStatus } from '../../api/types'
import { Dot } from '../../app/status'
import { PAIR_STATUS_LABEL, plural, type Forms } from '../../lib/format'
import { roll, useReduced } from '../../lib/motion'
import s from './Overview.module.css'

const STATUSES: PairStatus[] = ['risk', 'watch', 'ok']
// «из 10 анкет», «из 21 анкеты».
const OF_RESPONSES: Forms = ['анкеты', 'анкет', 'анкет']

export interface TotalsProps {
  counts: Record<PairStatus, number>
  filter: PairStatus | null
  onFilter: (status: PairStatus) => void
  month: number
  got: number
  total: number
}

export function Totals({ counts, filter, onFilter, month, got, total }: TotalsProps) {
  return (
    <div className={s.totals}>
      {STATUSES.map((st) => (
        <button
          key={st}
          type="button"
          className={clsx(s.total, s.pick)}
          aria-pressed={filter === st}
          disabled={counts[st] === 0 && filter !== st}
          onClick={() => onFilter(st)}
        >
          <span className={s.totalNum}>
            <Roll value={counts[st]} />
          </span>
          <span className={s.totalLabel}>
            <Dot status={st} />
            {PAIR_STATUS_LABEL[st]}
          </span>
        </button>
      ))}
      {month > 0 && (
        <div className={s.total}>
          <span className={s.totalNum}>
            <Roll value={got} />
            <span className={s.of}>из {total}</span>
          </span>
          <span className={s.totalLabel}>
            {plural(total, OF_RESPONSES)} за месяц
          </span>
        </div>
      )}
    </div>
  )
}

// Старое число уходит вверх, новое приходит снизу.
function Roll({ value }: { value: number }) {
  const reduce = useReduced()
  return (
    <span className={s.roll}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={reduce ? false : roll.enter} animate={roll.shown} exit={reduce ? undefined : roll.exit}>
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
