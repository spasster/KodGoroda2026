// Оболочка дашборда: липкая шапка (логотип, меню, лампа связи, тема),
// уведомления о новых анкетах и демо-пульт. Страницы рендерятся в <main> и сами
// оборачивают себя в .wrap. Форма живёт без оболочки, см. router.tsx.

import clsx from 'clsx'
import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { useOverview } from '../api/queries'
import { ThemeSwitch } from '../components/ThemeSwitch'
import { DemoPanel } from '../demo/DemoPanel'
import { formatCount, WORDS } from '../lib/format'
import { useLive } from '../live/useLive'
import s from './AppShell.module.css'
import { LiveIndicator } from './LiveIndicator'
import { Toasts } from './Toasts'

// ID пары из адреса /pairs/:id, в том же виде, что в событиях: P-03.
function openedPair(pathname: string): string | null {
  const m = /^\/pairs\/([^/]+)/.exec(pathname)
  return m ? decodeURIComponent(m[1]).trim().toUpperCase() : null
}

export function AppShell() {
  const { pathname } = useLocation()
  const overview = useOverview()
  const { notifications, dismiss, markPairSeen } = useLive()

  // HR открыл пару любым путём: снимаем метки «новое» и её уведомления.
  const pairId = openedPair(pathname)
  useEffect(() => {
    if (!pairId) return
    markPairSeen(pairId)
    notifications.filter((n) => n.pair_id === pairId).forEach((n) => dismiss(n.id))
    // Только при переходе: анкета, пришедшая при открытой карточке, своё уведомление показывает.
  }, [pairId])

  // Карточка пары подсвечивает «Обзор».
  const section = pathname.startsWith('/signals') ? 'signals' : pathname === '/' || pairId ? 'overview' : null
  // Бейдж: пары, с которыми есть о чём поговорить, а не число сигналов. Ноль не показываем.
  const talk = overview.data ? overview.data.totals.risk + overview.data.totals.watch : null

  return (
    <>
      <header className={s.appbar}>
        <div className={clsx('wrap', s.bar)}>
          <Link to="/" className={s.logo}>
            <span className={s.mark} aria-hidden="true" />
            <span className={s.name}>Сверка</span>
            <span className={s.sub}>стажировки</span>
          </Link>
          <nav className={s.nav} aria-label="Разделы">
            <Link to="/" aria-current={section === 'overview' ? 'page' : undefined}>
              Обзор
            </Link>
            <Link
              to="/signals"
              aria-current={section === 'signals' ? 'page' : undefined}
              aria-label={talk ? `С кем поговорить: ${formatCount(talk, WORDS.pair)}` : 'С кем поговорить'}
            >
              <span className={s.long}>С кем поговорить</span>
              <span className={s.short}>Поговорить</span>
              {talk != null && talk > 0 && (
                <span className={s.badge} aria-hidden="true">
                  {talk}
                </span>
              )}
            </Link>
            <a href="/form" target="_blank" rel="noopener" className={s['form-link']}>
              Форма анкеты
            </a>
          </nav>
          <LiveIndicator updatedAt={overview.dataUpdatedAt} />
          <ThemeSwitch />
        </div>
      </header>
      <main className={s.main}>
        <Outlet />
      </main>
      <Toasts />
      <DemoPanel />
    </>
  )
}
