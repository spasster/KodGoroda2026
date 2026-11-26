import React, { useState } from 'react';

/**
 * МГТС Pagination Dots — точечная пагинация для каруселей и пошаговых экранов.
 */
export function PaginationDots({ count = 5, active = 0, onChange, size = 8, style, ...rest }) {
  const [internal, setInternal] = useState(active);
  const cur = onChange ? active : internal;
  return (
    <div role="tablist" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...style }} {...rest}>
      {Array.from({ length: count }).map((_, i) => {
        const on = i === cur;
        return (
          <button key={i} type="button" role="tab" aria-selected={on} aria-label={`Слайд ${i + 1}`}
            onClick={() => { if (onChange) onChange(i); else setInternal(i); }}
            style={{
              width: on ? size * 3 : size, height: size, padding: 0, borderRadius: 80, border: 'none',
              background: on ? 'var(--color-brand)' : 'var(--color-control-disabled)',
              cursor: 'pointer', transition: 'width 120ms var(--ease-standard), background 120ms var(--ease-standard)',
            }} />
        );
      })}
    </div>
  );
}

export default PaginationDots;
