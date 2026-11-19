// Раздел «Сигналы» карточки пары: сигналы последних двух месяцев целиком, повторы
// одного условия свёрнуты под свежий, ниже строка «Раньше» со старыми сигналами.
// Отмеченный сигнал остаётся на своём месте в свёрнутом виде, даже «ложная
// тревога»: список не прыгает под рукой.

import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'

import { useThresholds } from '../../api/queries'
import type { PairDetail, Signal } from '../../api/types'
import { SectionHead, SeverityBars, SignalBlock } from '../../components'
import { recentWindow, REVIEW_STATUS_LABEL } from '../../lib/format'
import { dur, ease, useReduced, variants } from '../../lib/motion'
import { inWindow, olderLine, olderSignals, signalGroups } from './model'
import s from './Pair.module.css'

export function PairSignals({ pair }: { pair: PairDetail }) {
  const { active_months: months } = useThresholds()
  const current = pair.signals.filter((sig) => inWindow(sig, pair.last_month, months))
  const groups = signalGroups(current)
  const older = olderSignals(pair.signals, pair.last_month, months)

  // Сигналы, которые были при открытии. Новые (пришла анкета) проявляются.
  const known = useRef<Set<string> | null>(null)
  if (known.current == null) known.current = new Set(pair.signals.map((sig) => sig.key))
  const isNew = (key: string) => !known.current!.has(key)

  return (
    <section className={s.block} aria-labelledby="signals-h" id="signals">
      <SectionHead
        id="signals-h"
        title="Сигналы"
        note="Сигнал предлагает разговор, решение за вами. Отметка не меняет оценки, она убирает сигнал из очереди."
      />
      {groups.length === 0 ? (
        <p className={s.calm}>
          Активных сигналов нет. Оценки и комментарии этой пары {recentWindow(months)} спокойные.
        </p>
      ) : (
        groups.map((g) => (
          <Appear key={g.head.key} fresh={isNew(g.head.key)}>
            <SignalBlock signal={g.head} repeats={g.repeats} pair={pair} />
          </Appear>
        ))
      )}
      {older.length > 0 && <Older signals={older} pair={pair} months={months} />}
    </section>
  )
}

// Новый сигнал после анкеты: проявляется снизу на 8px.
function Appear({ fresh, children }: { fresh: boolean; children: ReactNode }) {
  const reduce = useReduced()
  return (
    <motion.div
      initial={fresh && !reduce ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.m, ease: ease.out, delay: 0.4 }}
    >
      {children}
    </motion.div>
  )
}

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text
}

// «Раньше»: одна строка и короткий список. Любой старый сигнал раскрывается целиком.
function Older({ signals, pair, months }: { signals: Signal[]; pair: PairDetail; months: number }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (key: string) =>
    setOpen((set) => {
      const next = new Set(set)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className={s.older}>
      <span className={s.olderLabel}>Раньше</span>
      <div className={s.olderBody}>
        <p>{olderLine(signals, months)}</p>
        <ul className={s.olderList}>
          {signals.map((sig) => {
            const expanded = open.has(sig.key)
            const panel = `older-${sig.key}`
            return (
              <li key={sig.key}>
                <button
                  type="button"
                  className={s.olderRow}
                  aria-expanded={expanded}
                  aria-controls={expanded ? panel : undefined}
                  onClick={() => toggle(sig.key)}
                >
                  <SeverityBars severity={sig.severity} />
                  <span className={s.olderText}>
                    {sig.month}-й месяц: {lowerFirst(sig.title)}
                    {sig.review.status !== 'open' && (
                      <span className={s.olderMark}>, {REVIEW_STATUS_LABEL[sig.review.status]}</span>
                    )}
                  </span>
                  <ChevronDown aria-hidden="true" className={clsx(s.chevron, expanded && s.chevronOpen)} />
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      id={panel}
                      key="panel"
                      className={s.olderPanel}
                      variants={variants.collapse}
                      initial="hidden"
                      animate="shown"
                      exit="gone"
                    >
                      <SignalBlock signal={sig} pair={pair} className={s.olderSignal} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
