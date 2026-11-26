import React, { useState } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Icon Button Set — сгруппированные иконочные кнопки с общим контуром.
 */
export function IconButtonSet({ items = [], size = 44, value, onChange, dividers = true, style, ...rest }) {
  const h = size;
  const [internal, setInternal] = useState(null);
  const current = value !== undefined ? value : internal;
  return (
    <div role="toolbar" style={{
      display: 'inline-flex', alignItems: 'center', height: h, boxSizing: 'border-box',
      borderRadius: 'var(--radius-m)', background: 'var(--color-background-primary)',
      border: '1px solid var(--color-line)', overflow: 'hidden', ...style,
    }} {...rest}>
      {items.map((it, i) => {
        const on = current === it.id;
        return (
          <button key={it.id} type="button" title={it.title} aria-label={it.title}
            disabled={it.disabled}
            onClick={() => {
              if (value === undefined) setInternal(on ? null : it.id);
              if (onChange) onChange(on ? null : it.id);
              if (it.onClick) it.onClick();
            }}
            style={{
              width: h, height: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: on ? 'var(--color-brand-subtle)' : 'transparent', border: 'none',
              borderLeft: dividers && i > 0 ? '1px solid var(--color-line)' : 'none',
              color: on ? 'var(--color-icons-brand)' : 'var(--color-icons-primary)',
              cursor: it.disabled ? 'not-allowed' : 'pointer', opacity: it.disabled ? 0.4 : 1,
              transition: 'background 120ms var(--ease-standard)',
            }}
            onMouseEnter={(e) => { if (!it.disabled && !on) e.currentTarget.style.background = 'var(--color-background-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = on ? 'var(--color-brand-subtle)' : 'transparent'; }}
          >
            <Icon name={it.icon} size={size >= 44 ? 24 : 16} />
          </button>
        );
      })}
    </div>
  );
}

export default IconButtonSet;
