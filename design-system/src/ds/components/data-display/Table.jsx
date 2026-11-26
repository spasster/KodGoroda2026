import React, { useState, useMemo } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';
import { StatusPill } from './StatusPill.jsx';
import { TableSelectionBar } from './TableSelectionBar.jsx';
import { EmptyState } from '../feedback/EmptyState.jsx';

/**
 * МГТС Table — таблица (Table View): сортировка, выбор строк, плотность default / compact
 * и типы ячеек text / icon-text / link / number / status / progress / avatar / custom.
 */
function SortArrows({ dir }) {
  const on = 'var(--color-icons-primary)';
  const off = 'var(--color-control-disabled)';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <path d="M8 3 L11 7 L5 7 Z" fill={dir === 'asc' ? on : off} />
      <path d="M8 13 L5 9 L11 9 Z" fill={dir === 'desc' ? on : off} />
    </svg>
  );
}

function CheckMark({ checked, indeterminate }) {
  const on = checked || indeterminate;
  return (
    <span style={{
      width: 20, height: 20, borderRadius: 'var(--radius-s)', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: on ? 'var(--color-brand)' : 'transparent',
      border: on ? '1px solid transparent' : '1px solid var(--color-control-stroke)',
      transition: 'background 120ms var(--ease-standard)', color: '#fff',
    }}>
      {indeterminate
        ? <span style={{ width: 10, height: 2, borderRadius: 1, background: '#fff' }} />
        : checked && <Icon name="CheckSize16StyleOutline" size={16} />}
    </span>
  );
}

function CellContent({ col, row }) {
  const v = row[col.key];
  const type = col.type || 'text';

  if (type === 'link') {
    return (
      <a href={row[col.hrefKey] || '#'} style={{
        fontFamily: 'var(--font-compact)', fontSize: 14, lineHeight: '20px',
        color: 'var(--color-text-brand)', textDecoration: 'none', whiteSpace: 'nowrap',
      }}>{v}</a>
    );
  }
  if (type === 'number') {
    return (
      <span style={{
        fontFamily: 'var(--font-text)', fontSize: 14, lineHeight: '20px',
        fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)',
        display: 'block', textAlign: 'right', width: '100%', whiteSpace: 'nowrap',
      }}>{v}</span>
    );
  }
  if (type === 'status') {
    return <StatusPill tone={row[col.toneKey || (col.key + 'Tone')] || 'neutral'}>{v}</StatusPill>;
  }
  if (type === 'progress') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
        <span style={{ flexGrow: 1, height: 4, borderRadius: 80, background: 'var(--color-control-track)', overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${v}%`, height: '100%', background: 'var(--color-brand)' }} />
        </span>
        <span style={{ fontFamily: 'var(--font-text)', fontSize: 13, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{v}%</span>
      </span>
    );
  }
  if (type === 'avatar') {
    const initials = String(v || '').split(' ').map((w) => w[0]).slice(0, 2).join('');
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 80, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--color-accent-brand-bg)', color: 'var(--color-text-brand)',
          fontFamily: 'var(--font-compact)', fontSize: 13, fontWeight: 'var(--fw-medium)',
        }}>{initials}</span>
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-compact)', fontSize: 14, lineHeight: '20px', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
          {row[col.captionKey || (col.key + 'Caption')] && (
            <span style={{ fontFamily: 'var(--font-compact)', fontSize: 12, lineHeight: '16px', color: 'var(--color-text-secondary)' }}>{row[col.captionKey || (col.key + 'Caption')]}</span>
          )}
        </span>
      </span>
    );
  }
  if (type === 'icon-text') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, color: 'var(--color-icons-secondary)' }}>
        {row[col.iconKey || (col.key + 'Icon')] && <Icon name={row[col.iconKey || (col.key + 'Icon')]} size={20} />}
        <span style={{ fontFamily: 'var(--font-compact)', fontSize: 14, lineHeight: '20px', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
      </span>
    );
  }
  if (type === 'custom' && col.render) return col.render(row);

  const caption = row[col.captionKey || (col.key + 'Caption')];
  return (
    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span style={{
        fontFamily: 'var(--font-compact)', fontSize: 14, lineHeight: '20px',
        color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{v}</span>
      {caption && (
        <span style={{ fontFamily: 'var(--font-compact)', fontSize: 12, lineHeight: '16px', color: 'var(--color-text-secondary)' }}>{caption}</span>
      )}
    </span>
  );
}

export function Table({
  columns = [], rows = [], selectable = false, density = 'default',
  rowActions, onRowClick, onRowContextMenu, emptyTitle = 'Ничего не найдено',
  emptyDescription = 'Измените параметры фильтра или поиска',
  stickyHeader = true, style, ...rest
}) {
  const rowH = density === 'compact' ? 44 : 60;
  const [sort, setSort] = useState(null);
  const [sel, setSel] = useState([]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (col && col.type === 'number') return (Number(x) - Number(y)) * dir;
      return String(x).localeCompare(String(y), 'ru') * dir;
    });
  }, [rows, sort, columns]);

  const allOn = sel.length > 0 && sel.length === rows.length;
  const someOn = sel.length > 0 && !allOn;

  const toggleAll = () => setSel(allOn ? [] : rows.map((r) => r.id));
  const toggleOne = (id) => setSel(sel.indexOf(id) !== -1 ? sel.filter((x) => x !== id) : [...sel, id]);
  const clickSort = (key) => {
    if (!sort || sort.key !== key) return setSort({ key, dir: 'asc' });
    if (sort.dir === 'asc') return setSort({ key, dir: 'desc' });
    setSort(null);
  };

  return (
    <div style={{ position: 'relative', ...style }} {...rest}>
      {sel.length > 0 && (
        <TableSelectionBar count={sel.length} label="выбрано" onCancel={() => setSel([])}
          style={{ marginBottom: 12 }} />
      )}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-m)', border: '1px solid var(--color-line)', background: 'var(--color-background-primary)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <thead>
            <tr>
              {selectable && (
                <th style={{
                  width: 44, height: 44, padding: 12, boxSizing: 'border-box',
                  background: 'var(--color-background-secondary)',
                  borderBottom: '1px solid var(--color-line)',
                  position: stickyHeader ? 'sticky' : 'static', top: 0, zIndex: 2,
                }}>
                  <span onClick={toggleAll} style={{ cursor: 'pointer', display: 'inline-flex' }}>
                    <CheckMark checked={allOn} indeterminate={someOn} />
                  </span>
                </th>
              )}
              {columns.map((c) => {
                const active = sort && sort.key === c.key;
                return (
                  <th key={c.key} style={{
                    height: 44, padding: 12, boxSizing: 'border-box',
                    width: c.width, textAlign: c.type === 'number' ? 'right' : 'left',
                    background: 'var(--color-background-secondary)',
                    borderBottom: '1px solid var(--color-line)',
                    position: stickyHeader ? 'sticky' : 'static', top: 0, zIndex: 2,
                    cursor: c.sortable ? 'pointer' : 'default', userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                    onClick={() => c.sortable && clickSort(c.key)}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      flexDirection: c.type === 'number' ? 'row-reverse' : 'row',
                      fontFamily: 'var(--font-compact)', fontSize: 14, lineHeight: '20px',
                      fontWeight: 'var(--fw-medium)', color: 'var(--color-text-secondary)',
                    }}>
                      {c.title}
                      {c.sortable && <SortArrows dir={active ? sort.dir : null} />}
                    </span>
                  </th>
                );
              })}
              {rowActions && (
                <th style={{
                  width: 56, height: 44, padding: 12, boxSizing: 'border-box',
                  background: 'var(--color-background-secondary)',
                  borderBottom: '1px solid var(--color-line)',
                  position: stickyHeader ? 'sticky' : 'static', top: 0, zIndex: 2,
                }} />
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} style={{ padding: 0 }}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : sorted.map((r) => {
              const on = sel.indexOf(r.id) !== -1;
              return (
                <tr key={r.id}
                  onClick={() => onRowClick && onRowClick(r)}
                  onContextMenu={(e) => { if (onRowContextMenu) onRowContextMenu(e, r); }}
                  style={{
                    height: rowH, background: on ? 'var(--color-brand-subtle)' : 'transparent',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 120ms var(--ease-standard)',
                  }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--color-background-secondary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = on ? 'var(--color-brand-subtle)' : 'transparent'; }}
                >
                  {selectable && (
                    <td style={{ width: 44, padding: 12, boxSizing: 'border-box', borderBottom: '1px solid var(--color-line)' }}
                      onClick={(e) => { e.stopPropagation(); toggleOne(r.id); }}>
                      <span style={{ cursor: 'pointer', display: 'inline-flex' }}>
                        <CheckMark checked={on} />
                      </span>
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} style={{
                      padding: 12, boxSizing: 'border-box', width: c.width,
                      borderBottom: '1px solid var(--color-line)',
                      verticalAlign: 'middle', maxWidth: c.maxWidth || 320,
                    }}>
                      <CellContent col={c} row={r} />
                    </td>
                  ))}
                  {rowActions && (
                    <td style={{ width: 56, padding: 12, boxSizing: 'border-box', borderBottom: '1px solid var(--color-line)', textAlign: 'right' }}
                      onClick={(e) => e.stopPropagation()}>
                      <span style={{
                        width: 32, height: 32, borderRadius: 'var(--radius-s)', display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        color: 'var(--color-icons-secondary)',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-background-secondary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        onClick={(e) => rowActions(r, e)}>
                        <Icon name="MoreSize24StyleOutline" size={24} />
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
