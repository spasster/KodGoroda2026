import React, { useState } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';
import { FilterChip } from './FilterChip.jsx';

/**
 * МГТС Filter Bar — строка фильтров над списком или таблицей.
 * Собирает чипы фильтров, показывает число применённых и даёт сбросить всё.
 * Значения контролируемые (values + onChange) либо внутренние.
 */
export function FilterBar({
  filters = [],
  values,
  /** Начальные значения для неконтролируемого режима. */
  defaultValues,
  onChange,
  onReset,
  resetLabel = 'Сбросить всё',
  showCount = true,
  style,
  ...rest
}) {
  const [internal, setInternal] = useState(defaultValues || {});
  const current = values !== undefined ? values : internal;

  const set = (id, value) => {
    const next = { ...current };
    if (value === null || value === undefined) delete next[id];
    else next[id] = value;
    if (values === undefined) setInternal(next);
    if (onChange) onChange(next);
  };

  const reset = () => {
    if (values === undefined) setInternal({});
    if (onChange) onChange({});
    if (onReset) onReset();
  };

  const applied = filters.filter((f) => current[f.id] !== undefined && current[f.id] !== null).length;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', ...style }} {...rest}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, paddingRight: 4, color: 'var(--color-icons-secondary)' }}>
        <Icon name="FilterSize24StyleOutline" size={20} />
        {showCount && applied > 0 && (
          <span style={{
            minWidth: 20, height: 20, padding: '0 6px', borderRadius: 80, boxSizing: 'border-box',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-brand)', color: '#fff',
            fontFamily: 'var(--font-compact)', fontSize: 12, fontWeight: 'var(--fw-medium)',
          }}>{applied}</span>
        )}
      </span>

      {filters.map((f) => (
        <FilterChip key={f.id} label={f.label} icon={f.icon} options={f.options}
          value={current[f.id]}
          onChange={(v) => set(f.id, v)}
          onRemove={() => set(f.id, null)} />
      ))}

      {applied > 0 && (
        <button type="button" onClick={reset} style={{
          height: 36, padding: '0 12px', borderRadius: 'var(--radius-m)', border: 'none',
          background: 'transparent', color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-compact)', fontSize: 14, cursor: 'pointer',
          transition: 'background 120ms var(--ease-standard), color 120ms var(--ease-standard)',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-background-secondary)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}>
          {resetLabel}
        </button>
      )}
    </div>
  );
}

export default FilterBar;
