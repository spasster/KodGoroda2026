import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Table Selection Bar — графитовая панель массового действия над таблицей.
 */
export function TableSelectionBar({ count = 0, label = 'выбрано', actions = [], onCancel, style, ...rest }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, height: 56, padding: '12px 12px 12px 16px',
      boxSizing: 'border-box', borderRadius: 'var(--radius-m)',
      background: 'var(--color-background-inverted)', ...style,
    }} {...rest}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexGrow: 1 }}>
        <span style={{
          minWidth: 24, height: 24, padding: '0 7px', borderRadius: 80, boxSizing: 'border-box',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--color-text-inverted)', color: 'var(--color-background-inverted)',
          fontFamily: 'var(--font-compact)', fontSize: 13, fontWeight: 'var(--fw-medium)',
        }}>{count}</span>
        <span style={{ fontFamily: 'var(--font-compact)', fontSize: 17, lineHeight: '24px', color: 'var(--color-text-inverted)' }}>{label}</span>
      </span>
      {actions.map((a) => (
        <button key={a.label} type="button" onClick={a.onClick} style={{
          height: 32, padding: '0 12px', borderRadius: 'var(--radius-s)', boxSizing: 'border-box',
          display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none',
          background: 'rgba(250,250,250,0.12)', color: 'var(--color-text-inverted)',
          fontFamily: 'var(--font-compact)', fontSize: 14, cursor: 'pointer',
          transition: 'background 120ms var(--ease-standard)',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(250,250,250,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(250,250,250,0.12)'; }}>
          {a.icon && <Icon name={a.icon} size={16} />}
          {a.label}
        </button>
      ))}
      {onCancel && (
        <button type="button" onClick={onCancel} aria-label="Снять выбор" style={{
          width: 32, height: 32, borderRadius: 'var(--radius-s)', border: 'none', background: 'transparent',
          color: 'var(--color-text-inverted)', cursor: 'pointer', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="CrossSize24StyleOutline" size={24} />
        </button>
      )}
    </div>
  );
}

export default TableSelectionBar;
