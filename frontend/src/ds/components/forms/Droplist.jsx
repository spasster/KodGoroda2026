import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Droplist — выпадающий список с ячейками, иконками и описаниями.
 * Закрывается по клику вне поля.
 */
const DL_SIZES = {
  s: { h: 40, fs: 15, pad: '0 12px' },
  m: { h: 48, fs: 17, pad: '0 16px' },
  l: { h: 56, fs: 17, pad: '0 16px' },
};

export function Droplist({
  label, placeholder = 'Выберите значение', items = [], value, onChange,
  size = 'm', disabled, width = 320, style, ...rest
}) {
  const s = DL_SIZES[size] || DL_SIZES.m;
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(null);
  const current = value !== undefined ? value : internal;
  const root = useRef(null);
  const sel = items.find((i) => i.id === current);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (id) => {
    if (value === undefined) setInternal(id);
    if (onChange) onChange(id);
    setOpen(false);
  };

  return (
    <div ref={root} style={{ position: 'relative', width, ...style }} {...rest}>
      {label && (
        <span style={{ display: 'block', marginBottom: 4, fontFamily: 'var(--font-compact)', fontSize: 14, lineHeight: '20px', color: 'var(--color-text-secondary)' }}>{label}</span>
      )}
      <button type="button" disabled={disabled} onClick={() => setOpen(!open)} style={{
        width: '100%', height: s.h, padding: s.pad, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
        borderRadius: 'var(--radius-m)', background: 'var(--color-background-secondary)',
        border: `1px solid ${open ? 'var(--color-brand)' : 'transparent'}`,
        color: sel ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
        fontFamily: 'var(--font-compact)', fontSize: s.fs,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        transition: 'border-color 120ms var(--ease-standard)',
      }}>
        <span style={{ flexGrow: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {sel ? sel.label : placeholder}
        </span>
        <Icon name="AngleSize24StyleOutline" size={24} style={{
          color: 'var(--color-icons-secondary)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 120ms var(--ease-standard)',
        }} />
      </button>
      {open && (
        <div role="listbox" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20,
          padding: '8px 0', borderRadius: 'var(--radius-m)',
          background: 'var(--color-background-primary)', boxShadow: 'var(--shadow-middle)',
          maxHeight: 320, overflowY: 'auto',
        }}>
          {items.map((it) => {
            const on = it.id === current;
            return (
              <div key={it.id} role="option" aria-selected={on}
                onClick={() => !it.disabled && pick(it.id)}
                style={{
                  display: 'flex', alignItems: it.description ? 'flex-start' : 'center', gap: 12,
                  padding: it.description ? '10px 16px' : '0 16px',
                  minHeight: it.description ? 0 : s.h,
                  cursor: it.disabled ? 'not-allowed' : 'pointer',
                  background: on ? 'var(--color-brand-subtle)' : 'transparent',
                  opacity: it.disabled ? 0.4 : 1,
                  transition: 'background 120ms var(--ease-standard)',
                }}
                onMouseEnter={(e) => { if (!it.disabled && !on) e.currentTarget.style.background = 'var(--color-background-secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = on ? 'var(--color-brand-subtle)' : 'transparent'; }}
              >
                {it.icon && <Icon name={it.icon} size={24} style={{ color: on ? 'var(--color-icons-brand)' : 'var(--color-icons-secondary)', marginTop: it.description ? 2 : 0 }} />}
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 }}>
                  <span style={{
                    fontFamily: 'var(--font-compact)', fontSize: s.fs, lineHeight: '24px',
                    color: on ? 'var(--color-text-brand)' : 'var(--color-text-primary)',
                  }}>{it.label}</span>
                  {it.description && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', color: 'var(--color-text-secondary)' }}>{it.description}</span>
                  )}
                </span>
                {it.meta && (
                  <span style={{ fontFamily: 'var(--font-compact)', fontSize: 14, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{it.meta}</span>
                )}
                {on && <Icon name="CheckSize24StyleOutline" size={24} style={{ color: 'var(--color-icons-brand)' }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Droplist;
