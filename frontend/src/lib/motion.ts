// Движение из docs/design/system.md, раздел «Анимации». Пакет motion, импорт
// motion/react. Длительности в секундах. Двигаем только по делу: пришла анкета,
// HR что-то отметил, открылся экран.
//
// prefers-reduced-motion: MotionConfig reducedMotion="user" в main.tsx и правило
// в styles/base.css. Где важно итоговое состояние сразу (без проявления), берите
// useReduced() и transition(reduce, …): при reduce переход мгновенный.

import { useReducedMotion, type Transition, type Variants } from 'motion/react'

// Кривые: появление и перемещение; рисование линий; уход (числа уходят вверх).
export const ease = {
  out: [0.2, 0.8, 0.2, 1],
  inOut: [0.65, 0, 0.35, 1],
  in: [0.4, 0, 1, 1],
} as const

// 120, 200, 320, 480, 900 мс: --dur-1 … --dur-5 в tokens.css.
export const dur = { xs: 0.12, s: 0.2, m: 0.32, l: 0.48, xl: 0.9 } as const

// Плашки итогов переезжают в новую группу без перелёта.
export const layoutSpring = { type: 'spring', stiffness: 420, damping: 40 } as const

export const INSTANT: Transition = { duration: 0 }

// Последовательность после новой анкеты (system.md, «Что происходит, когда по
// SSE приходит анкета»): секунды от прихода события.
export const arrival = {
  toast: 0,
  cellAppear: 0.3, // клетка с кольцом и меткой «новое», scale 0,96 → 1 за 0,22
  cellFill: 1.1, // заливка чернилами слева направо за 0,48
  now: 1.5, // колонка «Сейчас» этой пары
  headline: 1.5, // фраза-заголовок
  chips: 1.5, // плашки итогов переезжают
  numbers: 1.7, // числа итогов перекатываются
  underline: 2.4, // сколько держится черта 3px под изменившимся числом
} as const

// Первая загрузка обзора: задержка клетки по номеру месяца и плашки по порядку.
export const stagger = {
  cell: (month: number) => 0.08 + 0.07 * month,
  chip: (index: number) => 0.07 * index,
  chartPoint: (index: number) => 0.2 + 0.12 * index,
} as const

// Готовые варианты: initial="hidden" animate="shown" exit="gone".
export const variants = {
  // Проявление без сдвига: плашки при первой загрузке.
  fade: {
    hidden: { opacity: 0 },
    shown: { opacity: 1, transition: { duration: dur.m, ease: ease.out } },
    gone: { opacity: 0, transition: { duration: dur.s, ease: ease.out } },
  },
  // Уведомление: въезжает снизу на 12px, уходит вниз на 8px.
  toast: {
    hidden: { opacity: 0, y: 12 },
    shown: { opacity: 1, y: 0, transition: { duration: dur.m, ease: ease.out } },
    gone: { opacity: 0, y: 8, transition: { duration: dur.s, ease: ease.out } },
  },
  // Новое содержимое на месте старого: колонка «Сейчас», плашка отметки.
  swap: {
    hidden: { opacity: 0, y: 6 },
    shown: { opacity: 1, y: 0, transition: { duration: dur.m, ease: ease.out } },
  },
  // Фраза-заголовок сменилась.
  headline: {
    hidden: { opacity: 0, y: 8 },
    shown: { opacity: 1, y: 0, transition: { duration: dur.m, ease: ease.out } },
  },
  // Новая плашка в итогах.
  chip: {
    hidden: { opacity: 0, scale: 0.9 },
    shown: { opacity: 1, scale: 1, transition: { duration: dur.m, ease: ease.out } },
  },
  // Тело сигнала сворачивается по высоте после отметки.
  collapse: {
    hidden: { height: 0, opacity: 0 },
    shown: { height: 'auto', opacity: 1, transition: { duration: dur.m, ease: ease.out } },
    gone: { height: 0, opacity: 0, transition: { duration: dur.m, ease: ease.out } },
  },
  // Подсказка графика: проявляется со сдвигом 4px.
  tip: {
    hidden: { opacity: 0, y: 4 },
    shown: { opacity: 1, y: 0, transition: { duration: dur.xs } },
    gone: { opacity: 0, y: 4, transition: { duration: dur.xs } },
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

// Переход или мгновенно при reduce.
export function transition(reduce: boolean, t: Transition): Transition {
  return reduce ? INSTANT : t
}
