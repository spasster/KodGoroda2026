// Истории стажёров: карточка на человека. Вывод одной фразой, график двух оценок, цитата.

import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'

import type { PairStatus } from '../../api/types'
import { ROLE_LABEL, formatCount, personName } from '../../lib/format'
import { layoutSpring } from '../../lib/motion'
import type { Story } from './model'
import s from './Stories.module.css'
import { StoryChart } from './StoryChart'

const SECTIONS: { status: PairStatus; title: string }[] = [
  { status: 'risk', title: 'Пора поговорить' },
  { status: 'watch', title: 'Присмотреться' },
  { status: 'ok', title: 'Всё ровно' },
]

const SIGNAL_FORMS = ['сигнал', 'сигнала', 'сигналов'] as const

interface Props {
  stories: Story[]
  months: number[]
  scale: { min: number; max: number }
  isFresh: (pairId: string) => boolean
}

export function Stories({ stories, months, scale, isFresh }: Props) {
  return (
    <div className={s.sections}>
      {SECTIONS.map(({ status, title }) => {
        const list = stories.filter((st) => st.status === status)
        if (list.length === 0) return null
        return (
          <section key={status} className={s.section}>
            <h2 className={s.sectionTitle}>
              <i className={clsx(s.dot, s[status])} aria-hidden="true" />
              {title}
              <span className={s.count}>{list.length}</span>
            </h2>
            <div className={clsx(s.grid, status === 'ok' && s.gridCompact)}>
              <AnimatePresence initial={false}>
                {list.map((st) => (
                  <StoryCard key={st.pair.pair_id} story={st} months={months} scale={scale} fresh={isFresh(st.pair.pair_id)} />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )
      })}
    </div>
  )
}

function StoryCard({ story, months, scale, fresh }: { story: Story; months: number[]; scale: Props['scale']; fresh: boolean }) {
  const { pair, status, title, quote, signals } = story
  const compact = status === 'ok'
  return (
    <motion.div layout="position" layoutId={pair.pair_id} transition={layoutSpring} className={s.cardWrap}>
      <Link to={`/pairs/${pair.pair_id}`} className={clsx(s.card, compact && s.cardCompact, fresh && s.fresh)} data-status={status}>
        <header className={s.cardHead}>
          <div className={s.person}>
            <span className={s.name}>{personName(pair.intern_name, pair.intern_id)}</span>
            <span className={s.mentor}>наставник {personName(pair.mentor_name, pair.mentor_id)}</span>
          </div>
          {fresh ? <span className={s.new}>новая анкета</span> : !compact && signals > 0 && <span className={s.signals}>{formatCount(signals, SIGNAL_FORMS)}</span>}
        </header>
        {!compact && <p className={s.verdict}>{title ?? 'Всё ровно'}</p>}
        <StoryChart cells={pair.cells} months={months} scale={scale} status={status} compact={compact} />
        {!compact && quote && (
          <blockquote className={s.quote}>
            «{/^[а-яё]/.test(quote.text) ? '…' : ''}{quote.text}»<cite>{ROLE_LABEL[quote.role]}, {quote.month}-й месяц</cite>
          </blockquote>
        )}
      </Link>
    </motion.div>
  )
}
