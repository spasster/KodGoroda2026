import React, { useState } from 'react';

/*
 * Полоса шагов — из Figma «Web Components Organisms 2.0», страница Steps,
 * Step Line M (node 143377:27319): сегмент высотой 8 с радиусом 12,
 * дорожка rgba(188,195,208,0.502), пройденный сегмент — зелёный rgb(38,205,88).
 */

const TRACK = 'var(--color-stroke-soft)';

/**
 * МГТС Wizard — многошаговая форма: полоса шагов, заголовок шага,
 * область контента и нижняя панель навигации.
 * Шаг контролируется извне (step + onStepChange) либо ведётся внутри.
 */
export function Wizard({
  steps = [],
  step,
  defaultStep = 0,
  onStepChange,
  onFinish,
  onCancel,
  finishLabel = 'Готово',
  nextLabel = 'Далее',
  backLabel = 'Назад',
  cancelLabel = 'Отмена',
  hint,
  children,
  style,
  ...rest
}) {
  const [internal, setInternal] = useState(defaultStep);
  const current = step !== undefined ? step : internal;
  const last = steps.length ? steps.length - 1 : 0;
  const active = steps[current] || {};

  const go = (next) => {
    if (next < 0 || next > last) return;
    if (step === undefined) setInternal(next);
    if (onStepChange) onStepChange(next);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--color-background-primary)', borderRadius: 'var(--radius-l)',
      ...style,
    }} {...rest}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 32px 20px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {steps.map((s, i) => (
            <span key={s.id || i} style={{
              flex: 1, height: 8, borderRadius: 12, overflow: 'hidden',
              background: i <= current ? 'var(--color-accent-positive)' : TRACK,
              transition: 'background 200ms var(--ease-standard)',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-wide)', fontWeight: 700, fontSize: 24, color: 'var(--color-text-primary)' }}>
            {active.title}
          </span>
          <span style={{ fontFamily: 'var(--font-compact)', fontSize: 15, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
            Шаг {current + 1} из {steps.length}
          </span>
        </div>
        {active.description && (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', color: 'var(--color-text-secondary)', maxWidth: 640, textWrap: 'pretty' }}>
            {active.description}
          </span>
        )}
      </div>

      <div style={{ flexGrow: 1, padding: '4px 32px 24px', minHeight: 120 }}>{children}</div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px',
        borderTop: '1px solid var(--color-line)',
      }}>
        {hint && (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-secondary)' }}>{hint}</span>
        )}
        <span style={{ display: 'inline-flex', gap: 12, marginLeft: 'auto' }}>
          {current === 0 && onCancel && (
            <button type="button" onClick={onCancel} style={ghostBtn}>{cancelLabel}</button>
          )}
          {current > 0 && (
            <button type="button" onClick={() => go(current - 1)} style={ghostBtn}>{backLabel}</button>
          )}
          <button type="button"
            onClick={() => (current === last ? onFinish && onFinish() : go(current + 1))}
            style={primaryBtn}>
            {current === last ? finishLabel : nextLabel}
          </button>
        </span>
      </div>
    </div>
  );
}

const baseBtn = {
  height: 44, padding: '0 20px', borderRadius: 'var(--radius-m)', border: 'none',
  fontFamily: 'var(--font-compact)', fontSize: 17, fontWeight: 'var(--fw-medium)',
  cursor: 'pointer', transition: 'background 120ms var(--ease-standard)',
};
const ghostBtn = { ...baseBtn, background: 'transparent', color: 'var(--color-text-brand)' };
const primaryBtn = { ...baseBtn, background: 'var(--color-brand)', color: '#fff' };

export default Wizard;
