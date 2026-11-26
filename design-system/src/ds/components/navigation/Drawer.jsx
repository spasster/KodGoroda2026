import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Drawer — боковая панель поверх контента с оверлеем и футером.
 */
export function Drawer({ open = false, title, width = 480, onClose, footer, children, style, ...rest }) {
  return (
    <div aria-hidden={!open} style={{
      // fixed + overflow:hidden — иначе закрытая панель, уехавшая за правый край,
      // растягивает документ по горизонтали на свою ширину.
      position: 'fixed', inset: 0, overflow: 'hidden',
      pointerEvents: open ? 'auto' : 'none',
      visibility: open ? 'visible' : 'hidden',
      transition: open ? 'none' : 'visibility 0s linear 200ms',
      zIndex: 40, ...style,
    }} {...rest}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'var(--color-overlay)',
        opacity: open ? 1 : 0, transition: 'opacity 200ms var(--ease-standard)',
      }} />
      <aside style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width, maxWidth: '100%',
        display: 'flex', flexDirection: 'column',
        background: 'var(--color-background-primary)', boxShadow: 'var(--shadow-high)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms var(--ease-standard)',
      }}>
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px',
          borderBottom: '1px solid var(--color-line)',
        }}>
          <span style={{ flexGrow: 1, fontFamily: 'var(--font-wide)', fontWeight: 700, fontSize: 20, color: 'var(--color-text-primary)' }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Закрыть" style={{
            width: 32, height: 32, borderRadius: 'var(--radius-s)', border: 'none', background: 'transparent',
            color: 'var(--color-icons-secondary)', cursor: 'pointer', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="CrossSize24StyleOutline" size={24} />
          </button>
        </header>
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '24px' }}>{children}</div>
        {footer && (
          <footer style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
            padding: '16px 24px', borderTop: '1px solid var(--color-line)',
          }}>{footer}</footer>
        )}
      </aside>
    </div>
  );
}

export default Drawer;
