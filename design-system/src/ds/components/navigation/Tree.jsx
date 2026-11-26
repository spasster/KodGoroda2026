import React, { useState } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/*
 * Геометрия из Figma «Web Components Organisms 2.0», страница Tree
 * (node 157821:9193 и состояния Level1–Level4):
 *   строка M — высота 64, radius 16, padding 0 12, gap 12
 *   отступ уровня — колонка 24, шеврон 24 цвета rgb(141,150,159)
 *   направляющие линии — rgba(188,195,208,0.502)
 *   label 17/24 #1d2023, caption 14/20 #626c77, контент с padding 10px 0
 */

const LINE = 'var(--color-stroke-soft)';
const SIZES = {
  s: { row: 48, label: 15, labelLh: '20px', caption: 13, captionLh: '16px', pad: '8px 0' },
  m: { row: 64, label: 17, labelLh: '24px', caption: 14, captionLh: '20px', pad: '10px 0' },
};

function Chevron({ open }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{
      transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
      transition: 'transform 120ms var(--ease-standard)',
    }}>
      <path d="M6 9.5L12 15.5L18 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Row({ node, level, size, expanded, onToggle, selectedId, onSelect, lastFlags }) {
  const s = SIZES[size] || SIZES.m;
  const [hover, setHover] = useState(false);
  const hasChildren = !!(node.children && node.children.length);
  const open = !!expanded[node.id];
  const selected = selectedId === node.id;
  const dis = !!node.disabled;

  return (
    <React.Fragment>
      <div
        onClick={() => { if (!dis && onSelect) onSelect(node.id, node); }}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0 12px',
          minHeight: s.row, borderRadius: 16, boxSizing: 'border-box',
          cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.4 : 1,
          background: selected ? 'var(--color-brand-subtle)' : 'transparent',
          transition: 'background 120ms var(--ease-standard)',
        }}
        onMouseEnter={(e) => { setHover(true); if (!dis && !selected) e.currentTarget.style.background = 'var(--color-background-secondary)'; }}
        onMouseLeave={(e) => { setHover(false); e.currentTarget.style.background = selected ? 'var(--color-brand-subtle)' : 'transparent'; }}
      >
        {lastFlags.map((isLast, i) => (
          <span key={i} style={{ position: 'relative', width: 24, alignSelf: 'stretch', flexShrink: 0 }}>
            {!isLast && (
              <span style={{ position: 'absolute', left: 11.5, top: 0, bottom: 0, width: 1, background: LINE }} />
            )}
          </span>
        ))}

        <span style={{ position: 'relative', width: 24, alignSelf: 'stretch', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {level > 0 && (
            <React.Fragment>
              <span style={{ position: 'absolute', left: 11.5, top: 0, height: s.row / 2, width: 1, background: LINE }} />
              <span style={{ position: 'absolute', left: 11.5, top: s.row / 2, width: 12, height: 1, background: LINE }} />
            </React.Fragment>
          )}
          {hasChildren ? (
            <button type="button" aria-label={open ? 'Свернуть' : 'Развернуть'}
              onClick={(e) => { e.stopPropagation(); if (!dis && onToggle) onToggle(node.id); }}
              style={{
                position: 'relative', marginTop: (s.row - 24) / 2, width: 24, height: 24, padding: 0,
                border: 'none', borderRadius: 'var(--radius-s)', background: 'var(--color-background-primary)',
                color: 'var(--color-icons-secondary)', cursor: dis ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <Chevron open={open} />
            </button>
          ) : (
            <span style={{
              position: 'relative', marginTop: s.row / 2 - 2, width: 4, height: 4, borderRadius: 80,
              background: 'var(--color-icons-secondary)', boxShadow: '0 0 0 4px var(--color-background-primary)',
            }} />
          )}
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexGrow: 1, minWidth: 0, padding: s.pad, boxSizing: 'border-box' }}>
          {node.icon && (
            <Icon name={node.icon} size={24} style={{ color: selected ? 'var(--color-icons-brand)' : 'var(--color-icons-secondary)', flexShrink: 0 }} />
          )}
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}>
            <span style={{
              fontFamily: 'var(--font-compact)', fontSize: s.label, lineHeight: s.labelLh,
              color: selected ? 'var(--color-text-brand)' : 'var(--color-text-primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{node.label}</span>
            {node.caption && (
              <span style={{
                fontFamily: 'var(--font-compact)', fontSize: s.caption, lineHeight: s.captionLh,
                color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{node.caption}</span>
            )}
          </span>
          {node.count !== undefined && (
            hover && !dis ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 24, height: 24, padding: '0 7px', borderRadius: 80, boxSizing: 'border-box',
                background: 'var(--color-brand)', color: '#fff', flexShrink: 0,
                fontFamily: 'var(--font-compact)', fontSize: 13, fontWeight: 'var(--fw-medium)',
                fontVariantNumeric: 'tabular-nums',
              }}>{node.count}</span>
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 24, height: 24, boxSizing: 'border-box', flexShrink: 0,
                fontFamily: 'var(--font-text)', fontSize: 14, color: 'var(--color-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}>{node.count}</span>
            )
          )}
        </span>
      </div>

      {hasChildren && open && node.children.map((child, i) => (
        <Row key={child.id} node={child} level={level + 1} size={size}
          expanded={expanded} onToggle={onToggle}
          selectedId={selectedId} onSelect={onSelect}
          lastFlags={[...lastFlags, i === node.children.length - 1]} />
      ))}
    </React.Fragment>
  );
}

/**
 * МГТС Tree — дерево разделов, папок или структуры организации.
 * Раскрытие по шеврону, выбор по строке, направляющие линии уровней.
 * Размеры s (48) и m (64), у узла может быть иконка, подпись и счётчик.
 */
export function Tree({
  nodes = [],
  size = 'm',
  defaultExpanded = [],
  expanded,
  onToggle,
  selectedId,
  onSelect,
  style,
  ...rest
}) {
  const [internal, setInternal] = useState(() => {
    const map = {};
    defaultExpanded.forEach((id) => { map[id] = true; });
    return map;
  });
  const current = expanded !== undefined ? expanded : internal;

  const toggle = (id) => {
    if (expanded === undefined) setInternal({ ...current, [id]: !current[id] });
    if (onToggle) onToggle(id, !current[id]);
  };

  return (
    <div role="tree" style={{ display: 'flex', flexDirection: 'column', ...style }} {...rest}>
      {nodes.map((n, i) => (
        <Row key={n.id} node={n} level={0} size={size}
          expanded={current} onToggle={toggle}
          selectedId={selectedId} onSelect={onSelect}
          lastFlags={[]} />
      ))}
    </div>
  );
}

export default Tree;
