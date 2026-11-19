// Движение: короткое и по делу (docs/design/v2.md, «Стиль»). Пакет motion, импорт
// motion/react. Длительности в секундах.
//
// prefers-reduced-motion: MotionConfig reducedMotion="user" в main.tsx и правило
// в styles/base.css. Где важно итоговое состояние сразу, берите useReduced().

import { useReducedMotion, type Variants } from 'motion/react'

// Кривые: появление и перемещение; рисование линий; уход.
export const ease = {
  out: [0.2, 0.8, 0.2, 1],
  inOut: [0.65, 0, 0.35, 1],
  in: [0.4, 0, 1, 1],
} as const

// 120, 200, 320, 480, 900 мс; первые четыре совпадают с --dur-1 … --dur-4 в tokens.css.
export const dur = { xs: 0.12, s: 0.2, m: 0.32, l: 0.48, xl: 0.9 } as const

// Уведомления сдвигаются без перелёта.
export const layoutSpring = { type: 'spring', stiffness: 420, damping: 40 } as const

// Готовые варианты: initial="hidden" animate="shown" exit="gone".
export const variants = {
  // Уведомление: въезжает снизу на 12px, уходит вниз на 8px.
  toast: {
    hidden: { opacity: 0, y: 12 },
    shown: { opacity: 1, y: 0, transition: { duration: dur.m, ease: ease.out } },
    gone: { opacity: 0, y: 8, transition: { duration: dur.s, ease: ease.out } },
  },
  // Новое содержимое на месте старого: статус пары.
  swap: {
    hidden: { opacity: 0, y: 6 },
    shown: { opacity: 1, y: 0, transition: { duration: dur.m, ease: ease.out } },
  },
  // Тело сигнала сворачивается по высоте после отметки.
  collapse: {
    hidden: { height: 0, opacity: 0 },
    shown: { height: 'auto', opacity: 1, transition: { duration: dur.m, ease: ease.out } },
    gone: { height: 0, opacity: 0, transition: { duration: dur.m, ease: ease.out } },
  },
} as const satisfies Record<string, Variants>

// Число итогов: старое уходит вверх на 60% и гаснет, новое приходит снизу.
export const roll = {
  exit: { y: '-60%', opacity: 0, transition: { duration: 0.16, ease: ease.in } },
  enter: { y: '60%', opacity: 0 },
  shown: { y: 0, opacity: 1, transition: { duration: 0.22, ease: ease.out } },
} as const

// true, если человек просил убрать движение.
export function useReduced(): boolean {
  return useReducedMotion() ?? false
}
