// Временная оболочка дашборда: навигация, связь, тема, уведомления. Разметку
// заменит дизайн-система, логика останется в хуках.

import { Link, NavLink, Outlet } from 'react-router-dom'

import { formatRelative, LIVE_STATUS_LABEL, monthLabel, ROLE_LABEL, sourceLabel } from '../lib/format'
import { useTheme, type ThemePref } from '../lib/theme'
import { useLive } from '../live/useLive'

export function AppShell() {
  const { status, notifications, dismiss, clear } = useLive()
  const { pref, resolved, setPref } = useTheme()

  return (
    <div>
      <header>
        <nav>
          <NavLink to="/" end>Обзор</NavLink> | <NavLink to="/signals">Сигналы</NavLink> | <Link to="/form">Форма</Link>
        </nav>
        <p data-testid="live-status">Связь: {LIVE_STATUS_LABEL[status]}</p>
        <label>
          Тема:{' '}
          <select value={pref} onChange={(e) => setPref(e.target.value as ThemePref)}>
            <option value="system">как в системе</option>
            <option value="light">светлая</option>
            <option value="dark">тёмная</option>
          </select>{' '}
          (сейчас {resolved === 'dark' ? 'тёмная' : 'светлая'})
        </label>
      </header>

      {notifications.length > 0 && (
        <section data-testid="notifications">
          <h2>Новые анкеты</h2>
          <ul>
            {notifications.map((n) => (
              <li key={n.id}>
                {formatRelative(n.at)}: {ROLE_LABEL[n.role]} {n.person_id} прислал анкету, пара{' '}
                <Link to={`/pairs/${n.pair_id}`}>{n.pair_id}</Link>, {monthLabel(n.month)}, {sourceLabel(n.source)}.
                Новые сигналы: {n.new_signal_keys.length ? n.new_signal_keys.join(', ') : 'нет'}.{' '}
                <button type="button" onClick={() => dismiss(n.id)}>скрыть</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={clear}>Скрыть все</button>
        </section>
      )}

      <main>
        <Outlet />
      </main>
    </div>
  )
}
