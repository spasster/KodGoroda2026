import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Button w Indicator — кнопка со счётчиком или точкой-нотификацией.
 * Размеры 28 / 36 / 44 / 52, типы primary / secondary / ghost / negative.
 */
const BTN_SIZES = { 28: { h: 28, fs: 14, pad: 12 }, 36: { h: 36, fs: 14, pad: 16 }, 44: { h: 44, fs: 17, pad: 20 }, 52: { h: 52, fs: 17, pad: 24 } };

const BTN_TYPES = {
  primary: { bg: 'var(--color-brand)', fg: '#ffffff', bd: 'transparent', hover: 'var(--color-brand-hover)', active: 'var(--color-brand-active)' },
  secondary: { bg: 'transparent', fg: 'var(--color-text-brand)', bd: 'var(--color-brand)', hover: 'var(--color-brand-subtle)', active: 'var(--color-brand-subtle)' },
  ghost: { bg: 'transparent', fg: 'var(--color-text-brand)', bd: 'transparent', hover: 'var(--color-brand-subtle)', active: 'var(--color-brand-subtle)' },
  negative: { bg: 'var(--color-accent-negative)', fg: '#ffffff', bd: 'transparent', hover: 'var(--color-accent-negative-hover)', active: 'var(--color-accent-negative-active)' },
};

export function ButtonWithIndicator({
  children, type = 'primary', size = 44, count, dot = false, icon,
  disabled, onClick, style, ...rest
}) {
  const s = BTN_SIZES[size] || BTN_SIZES[44];
  const t = BTN_TYPES[type] || BTN_TYPES.primary;
  const onPrimary = type === 'primary' || type === 'negative';
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{
      position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8,
      height: s.h, padding: `0 ${s.pad}px`, boxSizing: 'border-box',
      borderRadius: 'var(--radius-m)', background: t.bg, color: t.fg,
      border: `1px solid ${t.bd}`, fontFamily: 'var(--font-compact)',
      fontSize: s.fs, fontWeight: 'var(--fw-medium)', whiteSpace: 'nowrap',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
      transition: 'background 120ms var(--ease-standard), transform 120ms var(--ease-standard)',
      ...style,
    }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = t.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = t.bg; }}
      onMouseDown={(e) => { if (!disabled) { e.currentTarget.style.background = t.active; e.currentTarget.style.transform = 'scale(0.98)'; } }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
      {...rest}
    >
      {icon && <Icon name={icon} size={size >= 44 ? 24 : 16} />}
      {children}
      {count !== undefined && count !== null && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 20, height: 20, padding: '0 6px', borderRadius: 80, boxSizing: 'border-box',
          background: onPrimary ? 'rgba(255,255,255,0.24)' : 'var(--color-brand)',
          color: '#ffffff',
          fontFamily: 'var(--font-compact)', fontSize: 13, fontWeight: 'var(--fw-medium)',
        }}>{count}</span>
      )}
      {dot && (
        <span style={{
          position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 80,
          background: onPrimary ? '#ffffff' : 'var(--color-brand)',
          boxShadow: '0 0 0 2px var(--color-background-primary)',
        }} />
      )}
    </button>
  );
}

export default ButtonWithIndicator;
