import React, { useState } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Control List — список строк с контролом (checkbox / radio / switch).
 * Размеры s / m / l, контрол слева или справа, опциональные описание и мета.
 */
const CL_SIZES = {
  s: { pad: '10px 12px', title: 15, desc: 13, gap: 10 },
  m: { pad: '12px 16px', title: 17, desc: 14, gap: 12 },
  l: { pad: '16px 20px', title: 17, desc: 14, gap: 16 },
};

function CheckboxMark({ checked, indeterminate, disabled }) {
  const on = checked || indeterminate;
  return (
    <span style={{
      width: 20, height: 20, borderRadius: 'var(--radius-s)', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: on ? (disabled ? 'var(--color-control-disabled)' : 'var(--color-brand)') : 'transparent',
      border: on ? '1px solid transparent'
        : `1px solid ${disabled ? 'var(--color-control-disabled)' : 'var(--color-control-stroke)'}`,
      transition: 'background 120ms var(--ease-standard), border-color 120ms var(--ease-standard)',
      color: '#fff',
    }}>
      {indeterminate
        ? <span style={{ width: 10, height: 2, borderRadius: 1, background: '#fff' }} />
        : checked && <Icon name="CheckSize16StyleOutline" size={16} />}
    </span>
  );
}

function RadioMark({ checked, disabled }) {
  const stroke = disabled ? 'var(--color-control-disabled)' : (checked ? 'var(--color-brand)' : 'var(--color-control-stroke)');
  return (
    <span style={{
      width: 20, height: 20, borderRadius: 80, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: `${checked ? 6 : 1}px solid ${stroke}`, boxSizing: 'border-box',
      background: 'var(--color-background-primary)',
      transition: 'border 120ms var(--ease-standard)',
    }} />
  );
}

function SwitchMark({ checked, disabled }) {
  return (
    <span style={{
      width: 44, height: 24, borderRadius: 80, flexShrink: 0, padding: 2, boxSizing: 'border-box',
      display: 'inline-flex', alignItems: 'center',
      justifyContent: checked ? 'flex-end' : 'flex-start',
      background: checked
        ? (disabled ? 'var(--color-control-disabled)' : 'var(--color-brand)')
        : (disabled ? 'var(--color-control-track)' : 'var(--color-control-disabled)'),
      transition: 'background 120ms var(--ease-standard)',
    }}>
      <span style={{ width: 20, height: 20, borderRadius: 80, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.12)' }} />
    </span>
  );
}

function ControlMark(p) {
  if (p.control === 'radio') return <RadioMark {...p} />;
  if (p.control === 'switch') return <SwitchMark {...p} />;
  return <CheckboxMark {...p} />;
}

export function ControlList({
  items = [], control = 'checkbox', size = 'm', position = 'left',
  value, onChange, divider = true, style, ...rest
}) {
  const s = CL_SIZES[size] || CL_SIZES.m;
  const multi = control !== 'radio';
  const [internal, setInternal] = useState(multi ? [] : null);
  const current = value !== undefined ? value : internal;

  const isOn = (id) => multi ? (current || []).indexOf(id) !== -1 : current === id;
  const toggle = (id) => {
    const next = multi
      ? (isOn(id) ? (current || []).filter((x) => x !== id) : [...(current || []), id])
      : id;
    if (value === undefined) setInternal(next);
    if (onChange) onChange(next);
  };

  return (
    <div role="group" style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--color-background-primary)',
      borderRadius: 'var(--radius-m)', overflow: 'hidden', ...style,
    }} {...rest}>
      {items.map((it, i) => {
        const on = isOn(it.id);
        const dis = !!it.disabled;
        return (
          <label key={it.id} aria-disabled={dis} style={{
            display: 'flex', alignItems: it.description ? 'flex-start' : 'center',
            flexDirection: position === 'right' ? 'row-reverse' : 'row',
            gap: s.gap, padding: s.pad, cursor: dis ? 'not-allowed' : 'pointer',
            borderTop: divider && i > 0 ? '1px solid var(--color-line)' : 'none',
            opacity: dis ? 0.4 : 1, transition: 'background 120ms var(--ease-standard)',
          }}
            onClick={() => !dis && toggle(it.id)}
            onMouseEnter={(e) => { if (!dis) e.currentTarget.style.background = 'var(--color-background-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ display: 'inline-flex', paddingTop: it.description ? 2 : 0 }}>
              <ControlMark control={control} checked={on} indeterminate={it.indeterminate} disabled={dis} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 }}>
              <span style={{
                fontFamily: 'var(--font-compact)', fontSize: s.title, lineHeight: '24px',
                color: 'var(--color-text-primary)',
              }}>{it.title}</span>
              {it.description && (
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: s.desc, lineHeight: '20px',
                  color: 'var(--color-text-secondary)',
                }}>{it.description}</span>
              )}
            </span>
            {it.meta && (
              <span style={{
                fontFamily: 'var(--font-compact)', fontSize: 14,
                color: 'var(--color-text-secondary)', whiteSpace: 'nowrap',
              }}>{it.meta}</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

export default ControlList;
