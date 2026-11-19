// Уведомления о новых анкетах: левый нижний угол, стопка до трёх, новое сверху.
// Скрывается само через 10 секунд, если курсор не над ним и фокус не внутри.
// Если HR открыл эту пару любым путём, AppShell снимает уведомление сразу.

import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

import { usePair, useSignals } from '../api/queries'
import { Button, LinkButton } from '../components/Button'
import { SeverityBars } from '../components/Severity'
import { PairChip, StatusSign } from '../components/Status'
import { PAIR_STATUS_LABEL, ROLE_TITLE, sourceLabel } from '../lib/format'
import { layoutSpring, useReduced, variants } from '../lib/motion'
import { compareSignals } from '../lib/rules'
import { useLive, type LiveNotification } from '../live/useLive'
import s from './AppShell.module.css'

const AUTO_HIDE_MS = 10_000

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
  const pair = usePair(n.pair_id)
  // Анкета одной пары может дать сигналы и другим (молчание остальных за месяц),
  // поэтому новые сигналы ищем во всём списке, а не в карточке пары.
  const signals = useSignals({ status: 'all' })
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const hold = hover || focus

  useEffect(() => {
    if (hold) return
    const t = window.setTimeout(() => dismiss(n.id), AUTO_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [hold, n.id, dismiss])

  // Данные пары считаем свежими, только если они пришли после события.
  const fresh = pair.data && pair.dataUpdatedAt >= Date.parse(n.at) ? pair.data : null
  const after = fresh?.status ?? n.before
  const changed = fresh != null && n.before != null && n.before !== fresh.status
  const list = signals.data && signals.dataUpdatedAt >= Date.parse(n.at) ? signals.data : null
  const added = list ? list.filter((sig) => n.new_signal_keys.includes(sig.key)).sort(compareSignals) : []
  const close = () => dismiss(n.id)

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
      <div className={s['toast-head']}>
        <b>Новая анкета</b>
        <span className={s['toast-when']}>только что</span>
        <button type="button" className={s['toast-close']} aria-label="Скрыть уведомление" onClick={close}>
          <X aria-hidden="true" strokeWidth={1.8} />
        </button>
      </div>
      <p className={s['toast-text']}>
        {ROLE_TITLE[n.role]} {n.person_id} прислал анкету за {n.month}-й месяц {sourceLabel(n.source)}.
      </p>
      {after && (
        <div className={s.change}>
          <PairChip pairId={n.pair_id} status={after} size="s" />
          {changed && n.before ? (
            <>
              <span className={s.was}>
                <StatusSign status={n.before} small />
                {PAIR_STATUS_LABEL[n.before]}
              </span>
              <span className={s.arrow} aria-label="стало">
                →
              </span>
              <span className={s.was}>
                <StatusSign status={after} small />
                {PAIR_STATUS_LABEL[after]}
              </span>
            </>
          ) : (
            fresh && <span>статус прежний</span>
          )}
        </div>
      )}
      {n.new_signal_keys.length === 0 ? (
        <ul className={s['new-signals']}>
          <li className="muted">Новых сигналов нет</li>
        </ul>
      ) : (
        added.length > 0 && (
          <ul className={s['new-signals']}>
            {added.map((sig) => (
              <li key={sig.key}>
                <SeverityBars severity={sig.severity} />
                <span>
                  {sig.pair_id !== n.pair_id && <span className={s['toast-pair']}>{sig.pair_id}</span>}
                  {sig.title}
                </span>
              </li>
            ))}
          </ul>
        )
      )}
      <div className={s['toast-actions']}>
        <LinkButton to={`/pairs/${n.pair_id}`} variant="brand" size="s">
          Открыть пару
        </LinkButton>
        <Button size="s" onClick={close}>
          Скрыть
        </Button>
      </div>
    </motion.div>
  )
}
