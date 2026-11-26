import React, { useRef, useEffect } from 'react';

/**
 * МГТС Scroll Area — контейнер с брендовым скроллбаром.
 */
export function ScrollArea({ children, height = 240, thin = false, style, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = 'mgts-scrollarea-style';
    if (!document.getElementById(id)) {
      const st = document.createElement('style');
      st.id = id;
      st.textContent = `
        .mgts-scroll { scrollbar-width: thin; scrollbar-color: var(--color-control-disabled) transparent; }
        .mgts-scroll::-webkit-scrollbar { width: 12px; height: 12px; }
        .mgts-scroll::-webkit-scrollbar-track { background: transparent; }
        .mgts-scroll::-webkit-scrollbar-thumb {
          background: var(--color-control-disabled); border-radius: 80px;
          border: 4px solid transparent; background-clip: padding-box;
        }
        .mgts-scroll::-webkit-scrollbar-thumb:hover { background: var(--color-icons-tertiary); background-clip: padding-box; }
        .mgts-scroll-thin::-webkit-scrollbar { width: 8px; height: 8px; }
        .mgts-scroll-thin::-webkit-scrollbar-thumb { border-width: 2px; }
      `;
      document.head.appendChild(st);
    }
  }, []);
  return (
    <div ref={ref} className={`mgts-scroll${thin ? ' mgts-scroll-thin' : ''}`}
      style={{ height, overflowY: 'auto', ...style }} {...rest}>
      {children}
    </div>
  );
}

export default ScrollArea;
