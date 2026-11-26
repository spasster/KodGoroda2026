import React, { useState } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Choice Chip — чип-выбор. Размеры s (32) и m (44), иконка и счётчик.
 * ChoiceChipGroup собирает их в uni- или multiselect группу.
 */
export function ChoiceChip({
  children, selected = false, disabled = false, icon, count,
  size = 'm', onClick, style, ...rest
}) {
  const h = size === 's' ? 32 : 44;
  const fs = size === 's' ? 14 : 17;
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      height: h, padding: icon ? '0 16px 0 12px' : '0 16px',
      borderRadius: 80, boxSizing: 'border-box', cursor: disabled ? 'not-allowed' : 'pointer',
      background: selected ? 'var(--color-brand)' : 'var(--color-background-secondary)',
      color: selected ? '#fff' : 'var(--color-text-primary)',
      border: 'none', fontFamily: 'var(--font-compact)', fontSize: fs,
      fontWeight: 'var(--fw-regular)', whiteSpace: 'nowrap',
      opacity: disabled ? 0.4 : 1,
      transition: 'background 120ms var(--ease-standard), transform 120ms var(--ease-standard)',
      ...style,
    }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = selected ? 'var(--color-brand-hover)' : 'var(--color-surface-hover-strong)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = selected ? 'var(--color-brand)' : 'var(--color-background-secondary)'; }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
      {...rest}
    >
      {icon && <Icon name={icon} size={20} style={{ color: selected ? '#fff' : 'var(--color-icons-secondary)' }} />}
      {children}
      {count !== undefined && (
        <span style={{
          fontSize: size === 's' ? 13 : 15,
          color: selected ? 'rgba(255,255,255,0.72)' : 'var(--color-text-secondary)',
        }}>{count}</span>
      )}
    </button>
  );
}

export function ChoiceChipGroup({ options = [], mode = 'uni', value, onChange, size = 'm', style, ...rest }) {
  const multi = mode === 'multi';
  const [internal, setInternal] = useState(multi ? [] : null);
  const current = value !== undefined ? value : internal;
  const isOn = (id) => multi ? (current || []).indexOf(id) !== -1 : current === id;
  const pick = (id) => {
    const next = multi
      ? (isOn(id) ? (current || []).filter((x) => x !== id) : [...(current || []), id])
      : (current === id ? null : id);
    if (value === undefined) setInternal(next);
    if (onChange) onChange(next);
  };
  return (
    <div role={multi ? 'group' : 'radiogroup'} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...style }} {...rest}>
      {options.map((o) => (
        <ChoiceChip key={o.id} size={size} icon={o.icon} count={o.count}
          selected={isOn(o.id)} disabled={o.disabled} onClick={() => pick(o.id)}>
          {o.label}
        </ChoiceChip>
      ))}
    </div>
  );
}

export default ChoiceChip;
