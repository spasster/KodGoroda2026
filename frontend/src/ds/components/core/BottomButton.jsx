import React from 'react';

/**
 * МГТС Bottom Button — закреплённая панель действий над контентом.
 */
export function BottomButton({ children, elevated = true, align = 'right', hint, style, ...rest }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', boxSizing: 'border-box',
      background: 'var(--color-background-primary)',
      borderTop: '1px solid var(--color-line)',
      boxShadow: elevated ? 'var(--shadow-middle)' : 'none',
      justifyContent: hint ? 'space-between' : (align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start'),
      ...style,
    }} {...rest}>
      {hint && (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-secondary)' }}>{hint}</span>
      )}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>{children}</span>
    </div>
  );
}

export default BottomButton;
