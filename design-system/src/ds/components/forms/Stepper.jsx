import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * MGTS Stepper — numeric input with − / + controls.
 * Значение можно ВВЕСТИ вручную (напечатать число) или менять кнопками ±.
 * Ввод применяется по Enter / потере фокуса и ограничивается min…max.
 */
export function Stepper({ value = 0, onChange, min = 0, max = 99, step = 1, disabled = false, size = 'm', style, ...rest }) {
  const heights = { s: 36, m: 44 };
  const [text, setText] = React.useState(String(value));
  React.useEffect(() => { setText(String(value)); }, [value]);

  const set = (v) => { if (!disabled) onChange && onChange(Math.max(min, Math.min(max, v))); };
  const commit = (raw) => {
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n)) {
      const v = Math.max(min, Math.min(max, n));
      setText(String(v));
      if (!disabled && v !== value) onChange && onChange(v);
    } else {
      setText(String(value));   // мусор → откат к текущему
    }
  };

  const btn = (dir, icon, off) => (
    <button
      type="button" disabled={disabled || off} onClick={() => set(value + dir * step)}
      style={{
        width: heights[size], height: heights[size], flexShrink: 0, border: 'none',
        background: 'transparent', cursor: disabled || off ? 'not-allowed' : 'pointer',
        color: disabled || off ? 'var(--color-text-tertiary)' : 'var(--color-text-brand)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={24} />
    </button>
  );

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', height: heights[size],
      border: '1px solid var(--color-control-stroke)', borderRadius: 'var(--radius-m)',
      background: 'var(--color-background-primary)', ...style,
    }} {...rest}>
      {btn(-1, 'MinusSize24StyleOutline', value <= min)}
      <input
        value={text} disabled={disabled} inputMode="numeric" aria-label="Значение"
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ''))}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') { setText(String(value)); e.currentTarget.blur(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); set(value + step); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); set(value - step); }
        }}
        style={{
          width: 44, minWidth: 44, textAlign: 'center', border: 'none', outline: 'none',
          background: 'transparent', fontFamily: 'var(--font-compact)', fontSize: 15,
          fontWeight: 'var(--fw-medium)', color: 'var(--color-text-primary)', padding: 0,
        }}
      />
      {btn(1, 'PlusSize24StyleOutline', value >= max)}
    </div>
  );
}

export default Stepper;
