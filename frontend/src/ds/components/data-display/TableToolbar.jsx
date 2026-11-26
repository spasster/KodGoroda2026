import React, { useState } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Table Toolbar — шапка над таблицей: заголовок со счётчиком, поиск, действия.
 */
export function TableToolbar({ title, count, searchPlaceholder = 'Поиск', onSearch, children, style, ...rest }) {
  const [q, setQ] = useState('');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16, ...style }} {...rest}>
      {title && (
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginRight: 'auto' }}>
          <span style={{ fontFamily: 'var(--font-wide)', fontWeight: 700, fontSize: 24, color: 'var(--color-text-primary)' }}>{title}</span>
          {count !== undefined && (
            <span style={{ fontFamily: 'var(--font-compact)', fontSize: 17, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
          )}
        </span>
      )}
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: 12, display: 'inline-flex', color: 'var(--color-icons-secondary)', pointerEvents: 'none' }}>
          <Icon name="SearchSize24StyleOutline" size={20} />
        </span>
        <input value={q} placeholder={searchPlaceholder}
          onChange={(e) => { setQ(e.target.value); if (onSearch) onSearch(e.target.value); }}
          style={{
            height: 44, width: 280, padding: '0 16px 0 40px', boxSizing: 'border-box',
            borderRadius: 'var(--radius-m)', border: '1px solid transparent',
            background: 'var(--color-background-secondary)', outline: 'none',
            fontFamily: 'var(--font-compact)', fontSize: 17, color: 'var(--color-text-primary)',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'transparent'; }} />
      </span>
      {children}
    </div>
  );
}

export default TableToolbar;
