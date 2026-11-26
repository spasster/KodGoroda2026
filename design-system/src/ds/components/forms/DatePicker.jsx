import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/*
 * Геометрия и типографика перенесены из Figma «Web Components Organisms 2.0»,
 * страница Calendar Range (node 141146:11084):
 *   поповер 400 / radius 32 / padding 20px 12px / тень 0 4 24 .12 + 0 8 16 .08
 *   Top Bar 32, чипы месяца и года radius 12 на подложке #f2f3f7, 14/20 medium
 *   колонка дня 47.857, подпись дня недели 12/16 medium caps #626c77
 *   ячейка 36×36 radius 12, число 20/28 regular
 *   выбранный день — графит #1d2023 с текстом #fafafa, диапазон — #f2f3f7
 * Единственная замена по спеке МГТС: «сегодня» в оригинале красный МТС
 * rgb(255,0,50) — здесь брендовый синий.
 */

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (v) => (v instanceof Date ? v : v ? new Date(v + 'T00:00:00') : null);
const fmt = (v) => {
  const d = parse(v);
  return d ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}` : '';
};
const sameDay = (a, b) => a && b && iso(a) === iso(b);
const startOffset = (d) => (d.getDay() + 6) % 7;

function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset(first); i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

const CHIP = {
  height: 32, borderRadius: 12, background: 'var(--color-background-secondary)',
  border: 'none', padding: '6px 12px', boxSizing: 'border-box', cursor: 'pointer',
  fontFamily: 'var(--font-compact)', fontWeight: 500, fontSize: 14, lineHeight: '20px',
  color: 'var(--color-text-primary)', whiteSpace: 'nowrap',
};

const NAV = {
  width: 32, height: 32, borderRadius: 12, border: 'none', background: 'transparent',
  color: 'var(--color-icons-secondary)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

function Chevron({ dir = 'right' }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d={dir === 'left' ? 'M14.5 6L8.5 12L14.5 18' : 'M9.5 6L15.5 12L9.5 18'}
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * МГТС Date Picker — выбор даты или периода.
 * Календарь собран по Calendar Range из библиотеки организмов: ячейка 36 с
 * радиусом 12, графитовое выделение, диапазон подложкой, «сегодня» — брендовым.
 * В режиме периода снизу строка с выбранным диапазоном и кнопки
 * «Сбросить» / «Применить»; в режиме одной даты выбор применяется сразу.
 */
export function DatePicker({
  mode = 'single',
  label,
  placeholder,
  value,
  onChange,
  min,
  max,
  presets = mode === 'range',
  disabled = false,
  width = 280,
  style,
  ...rest
}) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(mode === 'range' ? {} : null);
  const applied = value !== undefined ? value : internal;
  const [draft, setDraft] = useState(applied);
  const [picking, setPicking] = useState('date');
  const root = useRef(null);

  const anchor = parse(mode === 'range' ? (applied && applied.from) : applied) || new Date();
  const [view, setView] = useState({ y: anchor.getFullYear(), m: anchor.getMonth() });

  useEffect(() => { if (open) { setDraft(applied); setPicking('date'); } }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const cells = useMemo(() => monthGrid(view.y, view.m), [view.y, view.m]);
  const today = new Date();
  const minD = parse(min);
  const maxD = parse(max);

  const commit = (next) => {
    if (value === undefined) setInternal(next);
    if (onChange) onChange(next);
  };

  const from = mode === 'range' && draft ? parse(draft.from) : null;
  const to = mode === 'range' && draft ? parse(draft.to) : null;
  const single = mode === 'single' ? parse(draft) : null;

  const pick = (d) => {
    if (mode === 'single') { setDraft(iso(d)); commit(iso(d)); setOpen(false); return; }
    if (!from || (from && to)) return setDraft({ from: iso(d) });
    if (d < from) return setDraft({ from: iso(d), to: iso(from) });
    setDraft({ from: iso(from), to: iso(d) });
  };

  const applyPreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    setView({ y: start.getFullYear(), m: start.getMonth() });
    setDraft({ from: iso(start), to: iso(end) });
  };

  const shift = (delta) => {
    const m = view.m + delta;
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  const appliedFrom = mode === 'range' && applied ? parse(applied.from) : null;
  const appliedTo = mode === 'range' && applied ? parse(applied.to) : null;
  const text = mode === 'range'
    ? (appliedFrom ? `${fmt(appliedFrom)} — ${appliedTo ? fmt(appliedTo) : '…'}` : '')
    : fmt(parse(applied));

  const columns = [[], [], [], [], [], [], []];
  cells.forEach((d, i) => columns[i % 7].push(d));

  return (
    <div ref={root} style={{ position: 'relative', width, ...style }} {...rest}>
      {label && (
        <span style={{ display: 'block', marginBottom: 4, fontFamily: 'var(--font-compact)', fontSize: 14, lineHeight: '20px', color: 'var(--color-text-secondary)' }}>{label}</span>
      )}
      <button type="button" disabled={disabled} onClick={() => setOpen(!open)} style={{
        width: '100%', height: 48, padding: '0 16px', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
        borderRadius: 'var(--radius-m)', background: 'var(--color-background-secondary)',
        border: `1px solid ${open ? 'var(--color-brand)' : 'transparent'}`,
        color: text ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
        fontFamily: 'var(--font-compact)', fontSize: 17,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        transition: 'border-color 120ms var(--ease-standard)',
      }}>
        <Icon name="CalendarSize24StyleOutline" size={24} style={{ color: 'var(--color-icons-secondary)' }} />
        <span style={{ flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {text || placeholder || (mode === 'range' ? 'Выберите период' : 'Выберите дату')}
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 30,
          width: 320, boxSizing: 'border-box', padding: '20px 16px',
          display: 'flex', flexDirection: 'column', gap: 12,
          borderRadius: 32, background: 'var(--color-background-primary)',
          boxShadow: '0px 4px 24px 0px rgba(0,0,0,0.12), 0px 8px 16px 0px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 32 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="button" style={CHIP} onClick={() => setPicking(picking === 'month' ? 'date' : 'month')}>{MONTHS[view.m]}</button>
                <button type="button" style={CHIP} onClick={() => setPicking(picking === 'year' ? 'date' : 'year')}>{view.y}</button>
              </span>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <button type="button" aria-label="Предыдущий месяц" style={NAV} onClick={() => shift(-1)}><Chevron dir="left" /></button>
                <button type="button" aria-label="Следующий месяц" style={NAV} onClick={() => shift(1)}><Chevron dir="right" /></button>
              </span>
            </div>

            {picking === 'month' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, alignContent: 'start' }}>
                {MONTHS.map((mo, i) => (
                  <button key={mo} type="button" onClick={() => { setView({ ...view, m: i }); setPicking('date'); }}
                    style={{
                      height: 40, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: i === view.m ? 'var(--color-background-inverted)' : 'var(--color-background-secondary)',
                      color: i === view.m ? 'var(--color-text-inverted)' : 'var(--color-text-primary)',
                      fontFamily: 'var(--font-compact)', fontSize: 15,
                    }}>{mo}</button>
                ))}
              </div>
            ) : picking === 'year' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, alignContent: 'start' }}>
                {Array.from({ length: 16 }).map((_, i) => {
                  const y = view.y - 8 + i;
                  return (
                    <button key={y} type="button" onClick={() => { setView({ ...view, y }); setPicking('date'); }}
                      style={{
                        height: 40, borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: y === view.y ? 'var(--color-background-inverted)' : 'var(--color-background-secondary)',
                        color: y === view.y ? 'var(--color-text-inverted)' : 'var(--color-text-primary)',
                        fontFamily: 'var(--font-compact)', fontSize: 15,
                      }}>{y}</button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', columnGap: 6, justifyContent: 'space-between' }}>
                {columns.map((col, ci) => (
                  <span key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'var(--font-compact)', fontWeight: 500, fontSize: 12, lineHeight: '16px',
                      textAlign: 'center', textTransform: 'uppercase', color: 'var(--color-text-secondary)',
                      alignSelf: 'stretch',
                    }}>{WEEKDAYS[ci]}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', alignSelf: 'stretch' }}>
                      {col.map((d, ri) => {
                        if (!d) return <span key={`e${ri}`} style={{ width: 36, height: 36 }} />;
                        const off = (minD && d < minD) || (maxD && d > maxD);
                        const isToday = sameDay(d, today);
                        const isFrom = mode === 'range' && sameDay(d, from);
                        const isTo = mode === 'range' && sameDay(d, to);
                        const selected = mode === 'single' ? sameDay(d, single) : isFrom || isTo;
                        const inRange = mode === 'range' && from && to && d > from && d < to;
                        const halfLeft = isTo && from && !sameDay(from, to);
                        const halfRight = isFrom && to && !sameDay(from, to);
                        return (
                          <span key={iso(d)} style={{ position: 'relative', width: 36, height: 36 }}>
                            {(inRange || halfLeft || halfRight) && (
                              <span style={{
                                position: 'absolute', top: 0, height: 36,
                                left: halfRight ? 18 : 0,
                                width: inRange ? 36 : 18,
                                background: 'var(--color-background-secondary)',
                              }} />
                            )}
                            <button type="button" disabled={off} onClick={() => pick(d)} style={{
                              position: 'absolute', inset: 0, width: 36, height: 36,
                              border: 'none', borderRadius: 12, cursor: off ? 'not-allowed' : 'pointer',
                              background: selected ? 'var(--color-background-inverted)' : 'transparent',
                              color: selected ? 'var(--color-text-inverted)'
                                : off ? 'var(--color-text-tertiary)'
                                : isToday ? 'var(--color-text-brand)' : 'var(--color-text-primary)',
                              fontFamily: 'var(--font-compact)', fontWeight: 400, fontSize: 20, lineHeight: '28px',
                              opacity: off ? 0.4 : 1,
                              transition: 'background 120ms var(--ease-standard)',
                            }}
                              onMouseEnter={(e) => { if (!off && !selected) e.currentTarget.style.background = 'var(--color-background-secondary)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = selected ? 'var(--color-background-inverted)' : 'transparent'; }}
                            >{d.getDate()}</button>
                          </span>
                        );
                      })}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {presets && picking === 'date' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[['7 дней', 7], ['30 дней', 30], ['Квартал', 90], ['Год', 365]].map(([lbl, n]) => (
                <button key={lbl} type="button" onClick={() => applyPreset(n)} style={{
                  height: 32, padding: '0 12px', borderRadius: 12, border: 'none',
                  background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-compact)', fontSize: 14, cursor: 'pointer',
                  transition: 'background 120ms var(--ease-standard), color 120ms var(--ease-standard)',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-brand-subtle)'; e.currentTarget.style.color = 'var(--color-text-brand)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-background-secondary)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                >{lbl}</button>
              ))}
            </div>
          )}

          {mode === 'range' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{
                height: 24, padding: '0 4px', fontFamily: 'var(--font-compact)', fontSize: 15,
                lineHeight: '24px', color: from ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              }}>
                {from ? `${fmt(from)} — ${to ? fmt(to) : '…'}` : 'Выберите начало и конец периода'}
              </span>
              <span style={{ display: 'flex', gap: 12, height: 44 }}>
                <button type="button" disabled={!from} onClick={() => setDraft({})} style={{
                  flexGrow: 1, height: 44, borderRadius: 'var(--radius-m)', border: 'none',
                  background: 'var(--color-background-secondary)',
                  color: from ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-compact)', fontSize: 17, fontWeight: 'var(--fw-medium)',
                  cursor: from ? 'pointer' : 'not-allowed',
                }}>Сбросить</button>
                <button type="button" disabled={!from || !to} onClick={() => { commit(draft); setOpen(false); }} style={{
                  flexGrow: 1, height: 44, borderRadius: 'var(--radius-m)', border: 'none',
                  background: from && to ? 'var(--color-brand)' : 'var(--color-control-track)',
                  color: from && to ? '#fff' : 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-compact)', fontSize: 17, fontWeight: 'var(--fw-medium)',
                  cursor: from && to ? 'pointer' : 'not-allowed',
                }}>Применить</button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DatePicker;
