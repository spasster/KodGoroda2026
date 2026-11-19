// Итоги: фраза-заголовок, плашки пар по группам и два числа справа.
// Плашки переезжают между группами (layoutId), числа перекатываются.

import clsx from 'clsx'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import type { PairStatus } from '../../api/types'
import { pairChipClass } from '../../components'
import { PAIR_STATUS_LABEL, plural, type Forms } from '../../lib/format'
import { dur, ease, layoutSpring, roll, stagger, useReduced, variants } from '../../lib/motion'
import { headline, type ChipGroups, type StatusCounts } from './model'
import s from './Summary.module.css'

const OPEN: Forms = ['открытый сигнал', 'открытых сигнала', 'открытых сигналов']
const OF_RESPONSES: Forms = ['анкеты', 'анкет', 'анкет']

export interface CollectInfo {
  month: number
  got: number
  total: number
  // «ноябрь» или null, если анкет ещё нет.
  calendar: string | null
  // Все анкеты программы уже есть: месяц сбора закончился.
  done: boolean
}

export interface SummaryProps {
  counts: StatusCounts
  groups: ChipGroups
  open: number
  openHigh: number
  collect: CollectInfo | null
  // Первая загрузка за сеанс: плашки проявляются по очереди.
  first: boolean
}

export function Summary({ counts, groups, open, openHigh, collect, first }: SummaryProps) {
  const reduce = useReduced()
  const mounted = useMounted()
  const text = headline(counts)

  // Плашки, которых не было на экране: новая пара появляется с scale 0,9.
  const seen = useRef<Set<string> | null>(null)
  const known = seen.current
  useEffect(() => {
    seen.current = new Set([...groups.risk, ...groups.watch, ...groups.ok])
  })

  // Группа переносится на новую строку целиком. Пара, сменившая группу,
  // переезжает через layoutId, соседи сдвигаются через layout.
  const slide = reduce ? false : ('position' as const)
  let order = 0
  const chip = (id: string, status: PairStatus, cap: boolean) => {
    const i = order++
    const appear = reduce ? false : !known ? (first ? { opacity: 0 } : false) : known.has(id) ? false : { opacity: 0, scale: 0.9 }
    // motion на обёртке, а не на Link: Link из react-router меняет ref на каждой
    // перерисовке, и motion принял бы это за новое появление.
    return (
      <motion.span
        key={id}
        layoutId={reduce ? undefined : `chip-${id}`}
        layout={slide}
        className={clsx(s.chipBox, cap && s.capped)}
        initial={appear}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          layout: layoutSpring,
          default: { duration: dur.m, ease: ease.out, delay: !known && first ? stagger.chip(i) : 0 },
        }}
      >
        <Link
          to={`/pairs/${id}`}
          className={pairChipClass(status)}
          aria-label={`${id}, ${PAIR_STATUS_LABEL[status].toLowerCase()}${cap ? ', начать с неё' : ''}`}
        >
          {id}
        </Link>
        {cap && (
          <span className={s.cap} aria-hidden="true">
            начать с неё
          </span>
        )}
      </motion.span>
    )
  }

  const group = (label: string, ids: string[], status: PairStatus) => (
    <motion.div key={status} layout={slide} transition={{ layout: layoutSpring }} className={s.group}>
      <span className={s.label}>{label}</span>
      {ids.length ? ids.map((id) => chip(id, status, false)) : <span className={s.none}>никого</span>}
    </motion.div>
  )

  return (
    <section className={s.summary} aria-label="Итоги">
      <div className={s.main}>
        <motion.h1
          key={text}
          className={s.headline}
          variants={variants.headline}
          initial={mounted && !reduce ? 'hidden' : false}
          animate="shown"
        >
          {text}
        </motion.h1>
        <LayoutGroup>
          <div className={s.chips}>
            {groups.risk.length > 0 && (
              <motion.div key="risk" layout={slide} transition={{ layout: layoutSpring }} className={s.group}>
                {groups.risk.map((id, i) => chip(id, 'risk', i === 0 && groups.risk.length > 1))}
              </motion.div>
            )}
            {group('Присмотреться', groups.watch, 'watch')}
            {group('Спокойно', groups.ok, 'ok')}
          </div>
        </LayoutGroup>
      </div>

      <dl className={s.stats}>
        <div className={s.stat}>
          <dt>
            {plural(open, OPEN)}
            <small>{openHigh > 0 ? `${openHigh} высокой важности` : 'высокой важности нет'}</small>
          </dt>
          <Roll value={String(open)} />
        </div>
        {collect && (
          <div className={s.stat}>
            <dt>
              {plural(collect.total, OF_RESPONSES)} за {collect.month}-й месяц
              <small>
                {[collect.calendar, collect.done ? 'сбор закончен' : 'идёт сбор'].filter(Boolean).join(', ')}
              </small>
            </dt>
            <Roll value={`${collect.got} из ${collect.total}`} />
          </div>
        )}
      </dl>
    </section>
  )
}

// Число итогов: старое уходит вверх, новое приходит снизу, 2,4 с под ним черта бренда.
function Roll({ value }: { value: string }) {
  const reduce = useReduced()
  const prev = useRef(value)
  const [changed, setChanged] = useState(0)

  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    setChanged((n) => n + 1)
    const t = window.setTimeout(() => setChanged(0), 2400)
    return () => window.clearTimeout(t)
  }, [value])

  return (
    <dd className={clsx(s.value, changed > 0 && s.changed)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={value}
          className={s.roll}
          initial={reduce ? false : roll.enter}
          animate={roll.shown}
          exit={reduce ? undefined : roll.exit}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </dd>
  )
}

// true со второго рендера: смену текста анимируем, первое появление нет.
function useMounted(): boolean {
  const ref = useRef(false)
  useEffect(() => {
    ref.current = true
  }, [])
  return ref.current
}
