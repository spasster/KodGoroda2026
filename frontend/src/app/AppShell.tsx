// Оболочка дашборда (docs/design/v2.md, «Шапка»): белая полоса 64px со знаком
// МГТС, меню, точкой связи и кнопкой темы. Ниже страница, уведомления о новых
// анкетах и демо-пульт. Форма живёт без оболочки, см. router.tsx.

import { ArrowUpRight, Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { useOverview } from '../api/queries'
import { DemoPanel } from '../demo/DemoPanel'
import { useTheme } from '../lib/theme'
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
  const section = pathname.startsWith('/signals') ? 'signals' : pathname.startsWith('/analytics') ? 'analytics' : pathname.startsWith('/method') ? 'method' : pathname === '/' || pairId ? 'overview' : null
  const open = overview.data?.totals.open_signals ?? 0

  return (
    <>
      <header className={s.appbar}>
        <div className={`wrap ${s.bar}`}>
          <Link to="/" className={s.logo} aria-label="МГТС, стажировки">
            <Mark />
            <span className={s.name}>Стажировки</span>
          </Link>
          <nav className={s.nav} aria-label="Разделы">
            <Link to="/" aria-current={section === 'overview' ? 'page' : undefined}>
              Обзор
            </Link>
            <Link to="/signals" aria-current={section === 'signals' ? 'page' : undefined}>
              Сигналы
              {open > 0 && <span>{open}</span>}
            </Link>
            <Link to="/analytics" aria-current={section === 'analytics' ? 'page' : undefined}>
              Аналитика
            </Link>
            <Link to="/method" aria-current={section === 'method' ? 'page' : undefined}>
              Как считаем
            </Link>
            <a href="/form" target="_blank" rel="noopener" className={s.formLink}>
              Форма
              <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
            </a>
          </nav>
          <LiveIndicator updatedAt={overview.dataUpdatedAt} />
          <ThemeButton />
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

// Знак МГТС: синий квадрат, «МГТС» шрифтом MTS Wide у нижнего края, как на studchamp.mgts.ru.
function Mark() {
  return (
    <svg className={s.mark} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="20" fill="var(--mgts-blue)" />
      <text x="10" y="84" textLength="78" lengthAdjust="spacingAndGlyphs" fill="#fff" fontFamily="MTS Wide, sans-serif" fontWeight="700" fontSize="22">
        МГТС
      </text>
    </svg>
  )
}

function ThemeButton() {
  const { resolved, toggle } = useTheme()
  const dark = resolved === 'dark'
  const Icon = dark ? Sun : Moon
  return (
    <button type="button" className={s.theme} onClick={toggle} aria-label={dark ? 'Светлая тема' : 'Тёмная тема'}>
      <Icon aria-hidden="true" strokeWidth={1.8} />
    </button>
  )
}
