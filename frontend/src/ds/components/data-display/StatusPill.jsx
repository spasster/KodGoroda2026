import React from 'react';

/**
 * МГТС Status Pill — статус-пилюля для ячеек таблиц и карточек.
 */
const STATUS_TONES = {
  neutral: { bg: 'var(--color-background-secondary)', fg: 'var(--color-text-secondary)' },
  positive: { bg: 'var(--color-accent-positive-bg)', fg: 'var(--color-text-positive-strong)' },
  warning: { bg: 'var(--color-accent-warning-bg)', fg: 'var(--color-text-warning-strong)' },
  negative: { bg: 'var(--color-accent-negative-bg)', fg: 'var(--color-text-negative-strong)' },
  brand: { bg: 'var(--color-accent-brand-bg)', fg: 'var(--color-text-brand)' },
};

export function StatusPill({ tone = 'neutral', children }) {
  const t = STATUS_TONES[tone] || STATUS_TONES.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px',
      borderRadius: 'var(--radius-s)', background: t.bg, color: t.fg,
      fontFamily: 'var(--font-compact)', fontSize: 13, fontWeight: 'var(--fw-medium)', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

export default StatusPill;
