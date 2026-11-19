// Уведомление о новой анкете (docs/design/v2.md): карточка в правом нижнем углу,
// кто прислал и за какой месяц, смена статуса пары, если она была, и «Открыть».
// Исчезает через 8 секунд, пока курсор не над ним и фокус не внутри. Если HR
// открыл эту пару любым путём, AppShell снимает уведомление сразу.

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useOverview } from '../api/queries'
import { personName, ROLE_LABEL } from '../lib/format'
import { layoutSpring, useReduced, variants } from '../lib/motion'
import { useLive, type LiveNotification } from '../live/useLive'
import s from './AppShell.module.css'
import { StatusText } from './status'

const AUTO_HIDE_MS = 8_000

export function Toasts() {
  const { notifications } = useLive()
  return (
    <div className={s.toasts} aria-live="polite">
      <AnimatePresence initial={false}>
        {notifications.map((n) => (
          <Toast key={n.id} n={n} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function Toast({ n }: { n: LiveNotification }) {
  const { dismiss } = useLive()
  const reduce = useReduced()
  const overview = useOverview()
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const hold = hover || focus

  useEffect(() => {
    if (hold) return
    const t = window.setTimeout(() => dismiss(n.id), AUTO_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [hold, n.id, dismiss])

  const pair = overview.data?.pairs.find((p) => p.pair_id === n.pair_id)
  const name = personName(n.role === 'intern' ? pair?.intern_name : pair?.mentor_name, n.person_id)
  // Статус после анкеты берём, только когда обзор пришёл позже события.
  const after = pair && overview.dataUpdatedAt >= Date.parse(n.at) ? pair.status : null
  const changed = n.before != null && after != null && n.before !== after

  return (
    <motion.div
      layout={!reduce}
      role="status"
      className={s.toast}
      variants={variants.toast}
      initial={reduce ? false : 'hidden'}
      animate="shown"
      exit={reduce ? undefined : 'gone'}
      transition={{ layout: layoutSpring }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false)
      }}
    >
      <div className={s.toastHead}>
        <b className={s.toastTitle}>Новая анкета</b>
        <Link to={`/pairs/${n.pair_id}`} className={s.toastBtn} onClick={() => dismiss(n.id)}>
          Открыть
        </Link>
      </div>
      <p className={s.toastWho}>
        {name}, {ROLE_LABEL[n.role]}, {n.month}-й месяц
      </p>
      {changed && (
        <p className={s.change}>
          <StatusText status={n.before!} />
          <span className={s.arrow} aria-label="стало">
            →
          </span>
          <StatusText status={after} />
        </p>
      )}
    </motion.div>
  )
}
