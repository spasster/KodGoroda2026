import React, { useState } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';
import { Logo } from '../brand/Logo.jsx';

/**
 * МГТС App Header — шапка внутреннего продукта.
 * Знак МГТС и название продукта слева, поиск по центру, действия и профиль справа.
 * Без logoSrc берётся знак из brand/Logo.
 * Высота 64 (compact — 56). Действия принимают счётчик или точку-нотификацию.
 */
export function AppHeader({
  product,
  logoSrc,
  search = true,
  searchPlaceholder = 'Поиск',
  onSearch,
  actions = [],
  user,
  compact = false,
  children,
  style,
  ...rest
}) {
  const [q, setQ] = useState('');
  const h = compact ? 56 : 64;

  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 24, height: h, padding: '0 24px',
      boxSizing: 'border-box', background: 'var(--color-background-primary)',
      borderBottom: '1px solid var(--color-line)', ...style,
    }} {...rest}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {logoSrc ? (
          <img src={logoSrc} alt="МГТС" style={{
            width: compact ? 28 : 32, height: compact ? 28 : 32, display: 'block',
          }} />
        ) : (
          <Logo variant="mark" size={compact ? 28 : 32} />
        )}
        {product && (
          <span style={{
            fontFamily: 'var(--font-compact)', fontSize: 15, lineHeight: '20px',
            color: 'var(--color-text-secondary)', whiteSpace: 'nowrap',
          }}>{product}</span>
        )}
      </span>

      {search && (
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', flexGrow: 1, maxWidth: 420 }}>
          <span style={{ position: 'absolute', left: 12, display: 'inline-flex', color: 'var(--color-icons-secondary)', pointerEvents: 'none' }}>
            <Icon name="SearchSize24StyleOutline" size={20} />
          </span>
          <input value={q} placeholder={searchPlaceholder}
            onChange={(e) => { setQ(e.target.value); if (onSearch) onSearch(e.target.value); }}
            style={{
              width: '100%', height: 40, padding: '0 16px 0 40px', boxSizing: 'border-box',
              borderRadius: 'var(--radius-m)', border: '1px solid transparent',
              background: 'var(--color-background-secondary)', outline: 'none',
              fontFamily: 'var(--font-compact)', fontSize: 15, color: 'var(--color-text-primary)',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'transparent'; }} />
        </span>
      )}

      <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
        {children}
        {actions.map((a) => (
          <button key={a.id} type="button" title={a.title} aria-label={a.title} onClick={a.onClick}
            style={{
              position: 'relative', width: 40, height: 40, borderRadius: 'var(--radius-m)',
              border: 'none', background: 'transparent', color: 'var(--color-icons-secondary)',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 120ms var(--ease-standard), color 120ms var(--ease-standard)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-background-secondary)'; e.currentTarget.style.color = 'var(--color-icons-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-icons-secondary)'; }}
          >
            <Icon name={a.icon} size={24} />
            {a.count !== undefined && a.count !== null && (
              <span style={{
                position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, padding: '0 5px',
                borderRadius: 80, boxSizing: 'border-box', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', background: 'var(--color-brand)',
                color: '#fff', fontFamily: 'var(--font-compact)', fontSize: 11,
                fontWeight: 'var(--fw-medium)', boxShadow: '0 0 0 2px var(--color-background-primary)',
              }}>{a.count}</span>
            )}
            {a.dot && !a.count && (
              <span style={{
                position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 80,
                background: 'var(--color-brand)', boxShadow: '0 0 0 2px var(--color-background-primary)',
              }} />
            )}
          </button>
        ))}

        {user && (
          <span title={user.name} style={{ position: 'relative', display: 'inline-flex', marginLeft: 4 }}>
            <span style={{
              width: 36, height: 36, borderRadius: 80, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', background: 'var(--color-brand)',
              color: '#fff', fontFamily: 'var(--font-compact)', fontSize: 14,
              fontWeight: 'var(--fw-medium)', cursor: 'pointer', textTransform: 'uppercase',
            }}>
              {user.initials || String(user.name || '').split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </span>
            {user.online && (
              <span style={{
                position: 'absolute', right: 0, bottom: 0, width: 10, height: 10, borderRadius: 80,
                background: 'var(--color-accent-positive)', boxShadow: '0 0 0 2px var(--color-background-primary)',
              }} />
            )}
          </span>
        )}
      </span>
    </header>
  );
}

export default AppHeader;
