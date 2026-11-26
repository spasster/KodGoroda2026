import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Context Menu — меню действий по правому клику или по кнопке «…».
 * Позиционируется по координатам курсора и сам разворачивается вверх или
 * влево, если не помещается в окно. Закрывается по клику вне, Esc и выбору.
 *
 * Элементы: { id, label, icon, shortcut, tone: 'default' | 'negative',
 * disabled, divider: true }.
 */
export function ContextMenu({ open, x = 0, y = 0, items = [], onSelect, onClose, width = 240, style, ...rest }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const h = el ? el.offsetHeight : 0;
    const w = el ? el.offsetWidth : width;
    setPos({
      left: x + w > window.innerWidth - 8 ? Math.max(8, x - w) : x,
      top: y + h > window.innerHeight - 8 ? Math.max(8, y - h) : y,
    });
  }, [open, x, y, width]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target) && onClose) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={ref} role="menu" style={{
      position: 'fixed', left: pos.left, top: pos.top, zIndex: 60, width,
      padding: '8px 0', borderRadius: 'var(--radius-m)',
      background: 'var(--color-background-primary)', boxShadow: 'var(--shadow-middle)',
      ...style,
    }} {...rest}>
      {items.map((it, i) => {
        if (it.divider) {
          return <span key={`d${i}`} style={{ display: 'block', height: 1, margin: '8px 0', background: 'var(--color-line)' }} />;
        }
        const negative = it.tone === 'negative';
        const fg = it.disabled
          ? 'var(--color-text-tertiary)'
          : negative ? 'var(--color-accent-negative)' : 'var(--color-text-primary)';
        return (
          <div key={it.id} role="menuitem" aria-disabled={it.disabled}
            onClick={() => {
              if (it.disabled) return;
              if (it.onClick) it.onClick();
              if (onSelect) onSelect(it.id);
              if (onClose) onClose();
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, height: 40, padding: '0 16px',
              cursor: it.disabled ? 'not-allowed' : 'pointer', color: fg,
              fontFamily: 'var(--font-compact)', fontSize: 15,
              transition: 'background 120ms var(--ease-standard)',
            }}
            onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.style.background = negative ? 'var(--color-accent-negative-bg)' : 'var(--color-background-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {it.icon && <Icon name={it.icon} size={20} style={{ color: it.disabled ? 'var(--color-icons-tertiary)' : negative ? 'var(--color-accent-negative)' : 'var(--color-icons-secondary)' }} />}
            <span style={{ flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
            {it.shortcut && (
              <span style={{ fontFamily: 'var(--font-text)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>{it.shortcut}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Хук для контекстного меню: возвращает состояние, обработчик правого клика
 * и обработчик для кнопки «…» (открывает меню под кнопкой).
 */
export function useContextMenu() {
  const [state, setState] = useState({ open: false, x: 0, y: 0, payload: null });
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const openAt = useCallback((e, payload) => {
    e.preventDefault();
    setState({ open: true, x: e.clientX, y: e.clientY, payload });
  }, []);
  const openUnder = useCallback((e, payload) => {
    const r = e.currentTarget.getBoundingClientRect();
    setState({ open: true, x: r.right - 240, y: r.bottom + 4, payload });
  }, []);
  return { ...state, close, openAt, openUnder };
}

export default ContextMenu;
