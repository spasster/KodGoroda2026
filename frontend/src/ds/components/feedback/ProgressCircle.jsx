import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Progress Circle — круговой прогресс с процентом внутри.
 * Размеры s / m / l или произвольный диаметр; состояния loading / pause / success / error.
 */
const PC_STROKE = { s: 4, m: 6, l: 8 };

export function ProgressCircle({
  value = 0, size = 'm', diameter, state = 'loading',
  label, description, showValue = true, style, ...rest
}) {
  const d = diameter || ({ s: 48, m: 80, l: 120 })[size] || 80;
  const sw = PC_STROKE[size] || 6;
  const r = (d - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const track = {
    loading: 'var(--color-brand)',
    pause: 'var(--color-icons-tertiary)',
    success: 'var(--color-accent-positive)',
    error: 'var(--color-accent-negative)',
  }[state];
  const fs = d >= 120 ? 24 : d >= 80 ? 20 : 14;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, ...style }} {...rest}>
      <div style={{ position: 'relative', width: d, height: d, flexShrink: 0 }}>
        <svg width={d} height={d} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
          <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke="var(--color-control-track)" strokeWidth={sw} />
          <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke={track} strokeWidth={sw}
            strokeLinecap="round" strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 240ms var(--ease-standard), stroke 120ms var(--ease-standard)' }} />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-compact)', fontWeight: 'var(--fw-medium)', fontSize: fs,
          color: state === 'error' ? 'var(--color-accent-negative)' : 'var(--color-text-primary)',
        }}>
          {state === 'success'
            ? <Icon name="CheckSize24StyleOutline" size={d >= 80 ? 32 : 20} style={{ color: 'var(--color-accent-positive)' }} />
            : state === 'error'
              ? <Icon name="CrossSize24StyleOutline" size={d >= 80 ? 32 : 20} />
              : showValue && `${Math.round(pct)}%`}
        </div>
      </div>
      {(label || description) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {label && <span style={{ fontFamily: 'var(--font-compact)', fontSize: 17, lineHeight: '24px', color: 'var(--color-text-primary)' }}>{label}</span>}
          {description && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', color: 'var(--color-text-secondary)' }}>{description}</span>}
        </div>
      )}
    </div>
  );
}

export default ProgressCircle;
