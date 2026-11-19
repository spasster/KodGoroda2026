// Кружок с инициалами. Цвет выбирается по ID, чтобы у человека он был один и тот же на всех экранах.

import s from './Avatar.module.css'

const HUES = [205, 262, 172, 24, 330, 48]

export function Avatar({ name, id, size = 40 }: { name: string; id: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const hue = HUES[hash % HUES.length]
  return (
    <span className={s.avatar} aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.38, ['--hue' as string]: hue }}>
      {initials}
    </span>
  )
}
