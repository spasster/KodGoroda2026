// График карточки пары: средняя оценка стажёра (синий) и наставника (серый) по
// месяцам, заливка между линиями, значения у концов линий. Месяц сбора без точек.
// SVG по ширине контейнера, а не через viewBox: подписи остаются 13px на любой ширине.

import { motion } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'

import type { Cell, Role } from '../../api/types'
import { formatNumber } from '../../lib/format'
import { ease, useReduced } from '../../lib/motion'
import type { Scale } from '../../lib/rules'
import s from './Pair.module.css'

const H = 260
const T = 14
const B = 34
const L = 28
// Отступ первого месяца от подписей оси.
const PX = 20

interface Pt {
  m: number
  v: number
}

function line(cells: readonly Cell[], role: Role): Pt[] {
  return cells
    .map((c) => ({ m: c.month, v: role === 'intern' ? c.intern_index : c.mentor_index }))
    .filter((p): p is Pt => p.v != null)
    .sort((a, b) => a.m - b.m)
}

export function Chart({ cells, months, scale }: { cells: readonly Cell[]; months: number; scale: Scale }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    // Нулевую ширину (контейнер на миг скрыт) пропускаем, иначе график рисуется заново.
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) setWidth(w)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const I = line(cells, 'intern')
  const M = line(cells, 'mentor')
  const said = (list: Pt[]) => list.map((p) => `${p.m}-й ${formatNumber(p.v)}`).join(', ')
  const label = `Оценки по месяцам. Стажёр: ${said(I) || 'анкет нет'}. Наставник: ${said(M) || 'анкет нет'}.`

  return (
    <div ref={box} className={s.chart} style={{ height: H }} role="img" aria-label={label}>
      {width > 0 && <Plot I={I} M={M} months={months} scale={scale} W={width} />}
    </div>
  )
}

function Plot({ I, M, months, scale, W }: { I: Pt[]; M: Pt[]; months: number; scale: Scale; W: number }) {
  const reduce = useReduced()
  const R = W < 480 ? 92 : 112
  const span = Math.max(1, months - 1)
  const xs = (m: number) => L + PX + ((m - 1) / span) * (W - L - PX - R)
  const range = scale.max - scale.min || 1
  const ys = (v: number) => T + ((scale.max - v) / range) * (H - T - B)
  const d = (list: Pt[]) => list.map((p, i) => `${i ? 'L' : 'M'}${xs(p.m).toFixed(1)},${ys(p.v).toFixed(1)}`).join('')

  // Заливка между линиями по непрерывным участкам, где ответили обе стороны.
  const both = I.filter((p) => M.some((q) => q.m === p.m)).map((p) => ({ m: p.m, i: p.v, t: M.find((q) => q.m === p.m)!.v }))
  const bands: string[] = []
  let run: typeof both = []
  const flush = () => {
    if (run.length > 1) {
      const top = run.map((p, k) => `${k ? 'L' : 'M'}${xs(p.m).toFixed(1)},${ys(p.t).toFixed(1)}`).join('')
      const bottom = [...run].reverse().map((p) => `L${xs(p.m).toFixed(1)},${ys(p.i).toFixed(1)}`).join('')
      bands.push(`${top}${bottom}Z`)
    }
    run = []
  }
  for (const p of both) {
    if (run.length && p.m !== run[run.length - 1].m + 1) flush()
    run.push(p)
  }
  flush()

  // Значения у концов линий. Ближе 18px по высоте: нижняя подпись уходит вниз.
  const li = I[I.length - 1]
  const lm = M[M.length - 1]
  let yi = li ? ys(li.v) + 5 : 0
  let ym = lm ? ys(lm.v) + 5 : 0
  if (li && lm && li.m === lm.m && Math.abs(yi - ym) < 18) {
    if (li.v <= lm.v) yi = ym + 18
    else ym = yi + 18
  }

  // Наведение на месяц: значения у точек этого месяца.
  const [hover, setHover] = useState<number | null>(null)
  const at = (list: Pt[], m: number) => list.find((p) => p.m === m)
  const hi = hover != null ? at(I, hover) : undefined
  const hm = hover != null ? at(M, hover) : undefined
  const hv = hover != null && (hi || hm) && !(hi === li && hm === lm) ? hover : null
  const internBelow = !hm || !hi || hi.v <= hm.v

  // Первый показ рисует линии, анкета при открытом экране добавляет точку.
  const known = useRef<Set<string> | null>(null)
  if (known.current == null) known.current = new Set([...I.map((p) => `i${p.m}`), ...M.map((p) => `m${p.m}`)])
  const draw = !reduce
  const ticks = Array.from({ length: Math.floor(range) + 1 }, (_, k) => scale.min + k)
  const monthsList = Array.from({ length: months }, (_, k) => k + 1)
  const colW = (W - L - PX - R) / span

  const dots = (list: Pt[], role: 'i' | 'm', cls: string) =>
    list.map((p, k) => {
      const fresh = !known.current!.has(`${role}${p.m}`)
      return (
        <motion.circle
          key={`${role}${p.m}`}
          className={cls}
          cx={xs(p.m)}
          cy={ys(p.v)}
          r={4.5}
          initial={draw ? { opacity: 0, scale: 0.4 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.24, ease: ease.out, delay: fresh ? 0.3 : 0.15 + 0.06 * k }}
          style={{ transformOrigin: `${xs(p.m)}px ${ys(p.v)}px` }}
        />
      )
    })

  return (
    <svg width={W} height={H} className={s.svg} onMouseLeave={() => setHover(null)} aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line className={s.gridLine} x1={L} x2={W} y1={ys(t)} y2={ys(t)} />
          <text className={s.tick} x={L - 12} y={ys(t) + 4} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {monthsList.map((m) => (
        <text key={m} className={s.tick} data-on={hover === m || undefined} x={xs(m)} y={H - 8} textAnchor="middle">
          {m}
        </text>
      ))}

      {hv != null && <line className={s.hair} x1={xs(hv)} x2={xs(hv)} y1={T} y2={H - B} />}

      {bands.map((b) => (
        <motion.path
          key={b}
          className={s.band}
          d={b}
          initial={draw ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        />
      ))}
      {[
        { list: M, cls: s.lineMentor },
        { list: I, cls: s.lineIntern },
      ].map(({ list, cls }) =>
        list.length > 1 ? (
          <motion.path
            key={cls}
            className={cls}
            d={d(list)}
            initial={draw ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: ease.out }}
          />
        ) : null,
      )}
      {dots(M, 'm', s.dotMentor)}
      {dots(I, 'i', s.dotIntern)}

      {lm && (
        <text className={s.endMentor} x={xs(lm.m) + 12} y={ym}>
          <tspan className={s.endValue}>{formatNumber(lm.v)}</tspan> наставник
        </text>
      )}
      {li && (
        <text className={s.endIntern} x={xs(li.m) + 12} y={yi}>
          <tspan className={s.endValue}>{formatNumber(li.v)}</tspan> стажёр
        </text>
      )}

      {hv != null && hm && (
        <text className={s.hoverMentor} x={xs(hv)} y={ys(hm.v) + (internBelow ? -12 : 22)} textAnchor="middle">
          {formatNumber(hm.v)}
        </text>
      )}
      {hv != null && hi && (
        <text className={s.hoverIntern} x={xs(hv)} y={ys(hi.v) + (internBelow ? 22 : -12)} textAnchor="middle">
          {formatNumber(hi.v)}
        </text>
      )}

      {monthsList.map((m) => (
        <rect
          key={m}
          x={xs(m) - colW / 2}
          y={0}
          width={colW}
          height={H}
          fill="transparent"
          onMouseEnter={() => setHover(m)}
        />
      ))}
    </svg>
  )
}
