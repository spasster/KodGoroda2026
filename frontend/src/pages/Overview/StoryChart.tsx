// График истории: оценки стажёра и наставника по месяцам, между линиями залит разрыв.
// Линии открываются слева направо при загрузке и дорисовываются, когда приходит анкета.

import { useEffect, useId, useState } from 'react'

import type { Cell, PairStatus } from '../../api/types'
import { formatNumber } from '../../lib/format'
import s from './Stories.module.css'

interface Props {
  cells: Cell[]
  months: number[]
  scale: { min: number; max: number }
  status: PairStatus
  compact?: boolean
}

type Point = { month: number; x: number; y: number; value: number }

export function StoryChart({ cells, months, scale, status, compact = false }: Props) {
  const clipId = useId()
  const values = cells.flatMap((c) => [c.intern_index, c.mentor_index]).filter((v): v is number => v != null)
  const dataMonths = cells.filter((c) => c.intern_index != null || c.mentor_index != null).map((c) => c.month)
  const n = Math.max(months.length, 2)
  // Подписи концов встают в пустые будущие месяцы; если их нет, оставляем поле справа.
  const roomy = Math.max(0, ...dataMonths) < n
  const W = compact ? 220 : 560
  const H = compact ? 64 : 156
  const pad = compact ? { l: 4, r: 40, t: 8, b: 8 } : { l: 26, r: roomy ? 30 : 112, t: 12, b: 26 }
  // Большой график всегда в шкале анкеты, чтобы карточки сравнивались; маленький приближен к данным.
  const lo = compact && values.length ? Math.max(scale.min, Math.min(...values) - 0.6) : scale.min
  const x = (m: number) => pad.l + ((m - 1) / (n - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + ((scale.max - v) / (scale.max - lo)) * (H - pad.t - pad.b)

  const series = (key: 'intern_index' | 'mentor_index'): Point[] =>
    cells.flatMap((c) => {
      const v = c[key]
      return v == null ? [] : [{ month: c.month, x: x(c.month), y: y(v), value: v }]
    })
  const intern = series('intern_index')
  const mentor = series('mentor_index')
  const line = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  // Заливка разрыва: месяцы, где ответили оба.
  const both = cells.filter((c) => c.intern_index != null && c.mentor_index != null)
  const area =
    both.length > 1
      ? `${both.map((c, i) => `${i ? 'L' : 'M'}${x(c.month).toFixed(1)} ${y(c.intern_index!).toFixed(1)}`).join(' ')} ${[...both]
          .reverse()
          .map((c) => `L${x(c.month).toFixed(1)} ${y(c.mentor_index!).toFixed(1)}`)
          .join(' ')} Z`
      : null

  const dataEnd = Math.max(0, ...intern.map((p) => p.month), ...mentor.map((p) => p.month))
  const end = dataEnd
  const lastOf = (pts: Point[]) => [...pts].reverse().find((p) => p.month <= end)
  const li = lastOf(intern)
  const lm = lastOf(mentor)
  // Подписи концов не должны наезжать друг на друга.
  let dyI = 0
  let dyM = 0
  if (li && lm && Math.abs(li.y - lm.y) < 16) {
    const up = li.y <= lm.y
    dyI = up ? -8 : 8
    dyM = up ? 8 : -8
  }

  // Доля ширины, открытая слева: с нуля при первом показе.
  const target = end > 0 ? (x(end) + 7) / W : 0
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target))
    return () => cancelAnimationFrame(id)
  }, [target])

  const grid = compact ? [] : [scale.min, (scale.min + scale.max) / 2, scale.max]

  return (
    <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Оценки стажёра и наставника по месяцам" data-status={status}>
      <defs>
        <clipPath id={clipId}>
          <rect className={s.reveal} x="0" y="0" width={W} height={H} style={{ transform: `scaleX(${shown})` }} />
        </clipPath>
      </defs>
      {grid.map((v) => (
        <g key={v}>
          <line className={s.gridLine} x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
          <text className={s.tick} x={pad.l - 10} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {!compact &&
        months.map((m) => (
          <text key={m} className={s.tick} x={x(m)} y={H - 6} textAnchor="middle">
            {m}
          </text>
        ))}
      <g clipPath={`url(#${clipId})`}>
        {area && <path className={s.gap} d={area} />}
        <path className={s.mentorLine} d={line(mentor)} />
        <path className={s.internLine} d={line(intern)} />
        {!compact && mentor.map((p) => <circle key={p.month} className={s.mentorDot} cx={p.x} cy={p.y} r="4" />)}
        {!compact && intern.map((p) => <circle key={p.month} className={s.internDot} cx={p.x} cy={p.y} r="4.5" />)}
      </g>
      {lm && (
        <g className={s.endLabel} style={{ transform: `translate(${lm.x + 12}px, ${lm.y + dyM + 5}px)` }}>
          <text className={s.mentorValue}>
            {formatNumber(lm.value)}
            {!compact && <tspan className={s.who}> наставник</tspan>}
          </text>
        </g>
      )}
      {li && (
        <g className={s.endLabel} style={{ transform: `translate(${li.x + 12}px, ${li.y + dyI + 5}px)` }}>
          <text className={s.internValue}>
            {formatNumber(li.value)}
            {!compact && <tspan className={s.who}> стажёр</tspan>}
          </text>
        </g>
      )}
    </svg>
  )
}
