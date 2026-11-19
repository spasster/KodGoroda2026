// Гантель в клетке «пара × месяц»: дорожка шкалы на всю ширину, перемычка между
// оценками (длина и есть разрыв), круг стажёра 11px и квадрат наставника 10px.
// Цвет через currentColor: на залитой клетке всё инвертируется само.
// Обводка маркеров берёт --dumbbell-bg: клетка ставит его равным своему фону.

import clsx from 'clsx'

import s from './Evidence.module.css'

export interface DumbbellProps {
  intern: number | null
  mentor: number | null
  scale?: { min: number; max: number }
  // Клетка залита чернилами: дорожка --status-risk-track.
  onInk?: boolean
  className?: string
}

export function Dumbbell({ intern, mentor, scale = { min: 1, max: 5 }, onInk, className }: DumbbellProps) {
  const pos = (v: number) => `${(((v - scale.min) / (scale.max - scale.min)) * 100).toFixed(2)}%`
  return (
    <svg className={clsx(s.db, onInk && s['on-ink'], className)} aria-hidden="true">
      <line className={s.track} x1="0" x2="100%" y1="7" y2="7" />
      {intern != null && mentor != null && <line className={s.bar} x1={pos(intern)} x2={pos(mentor)} y1="7" y2="7" />}
      {mentor != null && (
        <svg x={pos(mentor)} overflow="visible">
          <rect className={s.dot} x={-5} y={2} width={10} height={10} rx={1} />
        </svg>
      )}
      {intern != null && <circle className={s.dot} cx={pos(intern)} cy="7" r="5.5" />}
    </svg>
  )
}
