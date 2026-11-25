// Средняя оценка по месяцам. Ось от 3 (или ниже, если данные ниже) до верха шкалы с пометкой разрыва:
// так 4,0 и 4,1 различимы. Подписи на концах линий.

import { useEffect, useId, useState } from 'react'

import { formatNumber } from '../../lib/format'
import s from './ProgramChart.module.css'

interface Point {
  month: number
  intern: number | null
  mentor: number | null
}

interface Props {
  points: Point[]
  months: number[]
  scale: { min: number; max: number }
}

const W = 560
const H = 200
const PAD = { l: 34, r: 112, t: 14, b: 28 }

export function ProgramChart({ points, months, scale }: Props) {
  const clipId = useId()
  const values = points.flatMap((p) => [p.intern, p.mentor]).filter((v): v is number => v != null)
  // Нижняя граница: не выше 3, шаг 0,5.
  const lo = Math.max(scale.min, Math.min(3, values.length ? Math.floor(Math.min(...values) * 2) / 2 : 3))
  const hi = scale.max
  const n = Math.max(months.length, 2)
  const x = (m: number) => PAD.l + ((m - 1) / (n - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b)
  const ticks: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += 0.5) ticks.push(v)

  const series = (key: 'intern' | 'mentor') =>
    points.flatMap((p) => (p[key] == null ? [] : [{ month: p.month, x: x(p.month), y: y(p[key]!), value: p[key]! }]))
  const intern = series('intern')
  const mentor = series('mentor')
  const line = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  const li = intern[intern.length - 1]
  const lm = mentor[mentor.length - 1]
  let dyI = 0
  let dyM = 0
  if (li && lm && Math.abs(li.y - lm.y) < 16) {
    const up = li.y <= lm.y
    dyI = up ? -8 : 8
    dyM = up ? 8 : -8
  }

  const end = Math.max(0, ...intern.map((p) => p.month), ...mentor.map((p) => p.month))
  const target = end > 0 ? (x(end) + 8) / W : 0
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target))
    return () => cancelAnimationFrame(id)
  }, [target])

  const broken = lo > scale.min
  const by = H - PAD.b

  return (
    <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Средняя оценка стажёров и наставников по месяцам">
      <defs>
        <clipPath id={clipId}>
          <rect className={s.reveal} x="0" y="0" width={W} height={H} style={{ transform: `scaleX(${shown})` }} />
        </clipPath>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line className={Number.isInteger(v) ? s.grid : s.gridHalf} x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
          <text className={s.tick} x={PAD.l - 8} y={y(v) + 4} textAnchor="end">
            {formatNumber(v)}
          </text>
        </g>
      ))}
      {broken && (
        <g aria-label={`Ось начинается с ${formatNumber(lo)}`}>
          <rect x={PAD.l - 6} y={by - 3} width="12" height="6" className={s.breakGap} />
          <path className={s.breakMark} d={`M${PAD.l - 6} ${by + 2} l4 -4 M${PAD.l + 2} ${by + 2} l4 -4`} />
        </g>
      )}
      {months.map((m) => (
        <text key={m} className={s.tick} x={x(m)} y={H - 8} textAnchor="middle">
          {m}
        </text>
      ))}
      <g clipPath={`url(#${clipId})`}>
        <path className={s.mentorLine} d={line(mentor)} />
        <path className={s.internLine} d={line(intern)} />
        {mentor.map((p) => (
          <circle key={p.month} className={s.mentorDot} cx={p.x} cy={p.y} r="4" />
        ))}
        {intern.map((p) => (
          <circle key={p.month} className={s.internDot} cx={p.x} cy={p.y} r="4.5" />
        ))}
      </g>
      {lm && (
        <text className={s.mentorValue} x={lm.x + 12} y={lm.y + dyM + 5}>
          {formatNumber(lm.value)}
          <tspan className={s.who}> наставник</tspan>
        </text>
      )}
      {li && (
        <text className={s.internValue} x={li.x + 12} y={li.y + dyI + 5}>
          {formatNumber(li.value)}
          <tspan className={s.who}> стажёр</tspan>
        </text>
      )}
    </svg>
  )
}
