// Загрузка: первые 300 мс ничего, потом серые блоки по форме будущего экрана и
// «Загружаем данные…». Без бликов и мерцания. Повторные запросы после SSE экран
// не перекрывают: показывайте Loading только пока данных нет (isPending).

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
export function useDelayed(delay = 300): boolean {
  const [shown, setShown] = useState(delay <= 0)
  useEffect(() => {
    if (delay <= 0) return
    const t = window.setTimeout(() => setShown(true), delay)
    return () => window.clearTimeout(t)
  }, [delay])
  return shown
}

const PRESETS: Record<'overview' | 'pair' | 'list', ReactNode> = {
  // Фраза, ряд плашек, сетка таблицы.
  overview: (
    <>
      <Skeleton width="60%" height={40} />
      <Skeleton width="40%" height={44} />
      <div className={s['grid-table']}>
        {Array.from({ length: 21 }, (_, i) => (
          <Skeleton key={i} height={72} />
        ))}
      </div>
    </>
  ),
  // ID и люди, график и блок разрыва.
  pair: (
    <>
      <Skeleton width={180} height={56} />
      <Skeleton width="35%" height={22} />
      <div className={s['grid-pair']}>
        <Skeleton height={300} />
        <Skeleton height={300} />
      </div>
    </>
  ),
  // Заголовок и строки сигналов.
  list: (
    <>
      <Skeleton width="45%" height={32} />
      <Skeleton width="70%" height={20} />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} height={120} style={{ marginTop: 14 }} />
      ))}
    </>
  ),
}

export interface LoadingProps {
  variant?: keyof typeof PRESETS
  // Свои блоки вместо готовых: соберите из Skeleton.
  children?: ReactNode
  delay?: number
  className?: string
}

export function Loading({ variant = 'list', children, delay = 300, className }: LoadingProps) {
  const shown = useDelayed(delay)
  if (!shown) return <div aria-busy="true" className={className} />
  return (
    <div aria-busy="true" className={clsx(s.loading, className)}>
      {children ?? PRESETS[variant]}
      <p className={s['loading-note']}>Загружаем данные…</p>
    </div>
  )
}
