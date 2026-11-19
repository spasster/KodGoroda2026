// Текст с подсвеченными фрагментами. Позиции по исходному тексту, как в API;
// пересечения склеиваются. Подсветка только заливкой --mark-bg, без подчёркивания.

import type { ReactNode } from 'react'

import type { Range } from './model'
import s from './Pair.module.css'

export function Marked({ text, marks }: { text: string; marks: readonly Range[] }) {
  const ranges = [...marks]
    .filter((m) => m.end > m.start)
    .sort((a, b) => a.start - b.start)
    .reduce<Range[]>((acc, m) => {
      const prev = acc[acc.length - 1]
      if (prev && m.start <= prev.end) prev.end = Math.max(prev.end, m.end)
      else acc.push({ start: Math.max(0, m.start), end: Math.min(text.length, m.end) })
      return acc
    }, [])
  const parts: ReactNode[] = []
  let i = 0
  ranges.forEach((r, k) => {
    if (r.start > i) parts.push(text.slice(i, r.start))
    parts.push(
      <mark key={k} className={s.mark}>
        {text.slice(r.start, r.end)}
      </mark>,
    )
    i = r.end
  })
  if (i < text.length) parts.push(text.slice(i))
  return <>{parts}</>
}
