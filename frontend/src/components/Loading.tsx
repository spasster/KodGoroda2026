// Загрузка: первые 300 мс ничего, потом серые блоки по форме будущего экрана.
// Повторные запросы после SSE экран не перекрывают: показывайте Loading только
// пока данных нет (isPending).

import clsx from 'clsx'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

import s from './States.module.css'

export function Skeleton({
  width = '100%',
  height = 16,
  radius,
  className,
  style,
}: {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  radius?: CSSProperties['borderRadius']
  className?: string
  style?: CSSProperties
}) {
  return <div aria-hidden="true" className={clsx(s.skel, className)} style={{ width, height, borderRadius: radius, ...style }} />
}

// true через delay мс после монтирования.
function useDelayed(delay: number): boolean {
  const [shown, setShown] = useState(delay <= 0)
  useEffect(() => {
    if (delay <= 0) return
    const t = window.setTimeout(() => setShown(true), delay)
    return () => window.clearTimeout(t)
  }, [delay])
  return shown
}

export function Loading({ children, delay = 300, className }: { children: ReactNode; delay?: number; className?: string }) {
  const shown = useDelayed(delay)
  return (
    <div aria-busy="true" aria-label="Загрузка" className={clsx(shown && s.loading, className)}>
      {shown && children}
    </div>
  )
}
