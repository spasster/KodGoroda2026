// Блок разрыва справа от графика: последний разрыв крупно, пояснение с порогом,
// цепочка разрыва по месяцам и вопросы, которые сильнее всего изменились.

import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { useThresholds } from '../../api/queries'
import type { PairDetail, Survey } from '../../api/types'
import { GapChain } from '../../components'
import { formatNumber } from '../../lib/format'
import { arrival, roll, useReduced } from '../../lib/motion'
import type { Scale } from '../../lib/rules'
import { biggestChanges, formatScore, gapSummary } from './model'
import s from './Pair.module.css'

export function GapBox({
  pair,
  scale,
  collect,
  survey,
}: {
  pair: PairDetail
  scale: Scale
  collect: number | null
  survey: Survey | undefined
}) {
  const th = useThresholds()
  const { gaps, last, lead } = gapSummary(pair, scale, collect, th)
  const changes = survey ? biggestChanges(pair.series, survey) : []

  return (
    <section className={s.gapbox} aria-labelledby="gap-h">
      <h2 id="gap-h" className="sr-only">
        Разрыв
      </h2>
      <div className={s.gapnum}>
        <RollingNumber text={last ? formatNumber(Math.abs(last.gap)) : 'нет'} />
        {last && <small>балла</small>}
      </div>
      <p className={s.gapLead}>{lead}</p>
      {gaps.length > 1 && (
        <div className={s.gapChain}>
          <span className="sr-only">Разрыв по месяцам</span>
          <GapChain values={gaps.map((g) => g.gap)} label={null} />
        </div>
      )}
      {changes.length > 0 && (
        <div className={s.changes}>
          <h3>Сильнее всего изменились с первой анкеты до последней</h3>
          <ul>
            {changes.map((c) => (
              <li key={`${c.role}:${c.question.id}`}>
                <span>
                  {c.question.text}
                  <small>
                    {c.role === 'mentor' ? 'наставник, ' : ''}
                    {c.fromMonth}-й → {c.toMonth}-й месяц
                  </small>
                </span>
                <span className={clsx(s.changeValue, 'num')}>
                  {formatScore(c.from)} → {formatScore(c.to)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// Число перекатывается: старое уходит вверх, новое приходит снизу, под ним на
// 2,4 с черта бренда. При reduced motion число меняется сразу, черта остаётся.
function RollingNumber({ text }: { text: string }) {
  const reduce = useReduced()
  const prev = useRef(text)
  const [changed, setChanged] = useState(false)

  useEffect(() => {
    if (prev.current === text) return
    prev.current = text
    setChanged(true)
    const t = window.setTimeout(() => setChanged(false), arrival.underline * 1000)
    return () => window.clearTimeout(t)
  }, [text])

  return (
    <span className={clsx(s.roll, changed && s.changed)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={text}
          className={s.rollValue}
          initial={reduce ? false : roll.enter}
          animate={roll.shown}
          exit={reduce ? undefined : roll.exit}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
