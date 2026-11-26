import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Filter Chip — чип фильтра над списком или таблицей.
 * Без значения — приглашение выбрать, со значением — активный, брендовый контур
 * и крестик сброса. Если переданы options, по клику раскрывается список.
 */
export function FilterChip({
  label,
  value,
  options,
  icon,
  onChange,
  onRemove,
  onClick,
  disabled = false,
  style,
  ...rest
}) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const active = value !== undefined && value !== null && value !== '';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = options && options.find((o) => o.id === value);

  return (
    <span ref={root} style={{ position: 'relative', display: 'inline-flex', ...style }} {...rest}>
      <button type="button" disabled={disabled}
        onClick={() => { if (options) setOpen(!open); if (onClick) onClick(); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 36,
          padding: onRemove && active ? '0 8px 0 12px' : '0 12px', boxSizing: 'border-box',
          borderRadius: 'var(--radius-m)', cursor: disabled ? 'not-allowed' : 'pointer',
          background: active ? 'var(--color-brand-subtle)' : 'var(--color-background-secondary)',
          border: `1px solid ${active ? 'var(--color-brand)' : 'transparent'}`,
          color: active ? 'var(--color-text-brand)' : 'var(--color-text-primary)',
          fontFamily: 'var(--font-compact)', fontSize: 14, whiteSpace: 'nowrap',
          opacity: disabled ? 0.4 : 1,
          transition: 'background 120ms var(--ease-standard), border-color 120ms var(--ease-standard)',
        }}>
        {icon && <Icon name={icon} size={16} style={{ color: active ? 'var(--color-icons-brand)' : 'var(--color-icons-secondary)' }} />}
        {active ? (current ? current.label : value) : label}
        {onRemove && active && (
          <span role="button" aria-label={`Убрать фильтр «${label}»`}
            onClick={(e) => { e.stopPropagation(); onRemove(); setOpen(false); }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: 'var(--radius-s)', color: 'var(--color-icons-brand)',
            }}>
            <Icon name="CrossSize16StyleOutline" size={16} />
          </span>
        )}
      </button>

      {open && options && (
        <div role="listbox" style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20, minWidth: 220,
          padding: '8px 0', borderRadius: 'var(--radius-m)',
          background: 'var(--color-background-primary)', boxShadow: 'var(--shadow-middle)',
          maxHeight: 280, overflowY: 'auto',
        }}>
          {options.map((o) => {
            const on = o.id === value;
            return (
              <div key={o.id} role="option" aria-selected={on}
                onClick={() => { if (onChange) onChange(o.id); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, height: 40, padding: '0 16px',
                  cursor: 'pointer', background: on ? 'var(--color-brand-subtle)' : 'transparent',
                  fontFamily: 'var(--font-compact)', fontSize: 15,
                  color: on ? 'var(--color-text-brand)' : 'var(--color-text-primary)',
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--color-background-secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = on ? 'var(--color-brand-subtle)' : 'transparent'; }}
              >
                <span style={{ flexGrow: 1 }}>{o.label}</span>
                {o.count !== undefined && (
                  <span style={{ fontFamily: 'var(--font-text)', fontSize: 13, color: 'var(--color-text-secondary)' }}>{o.count}</span>
                )}
                {on && <Icon name="CheckSize16StyleOutline" size={16} style={{ color: 'var(--color-icons-brand)' }} />}
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}

export default FilterChip;
