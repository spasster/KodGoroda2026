// Живое поступление анкеты на обзоре (system.md, «Что происходит, когда по SSE
// приходит анкета»). Данные перезапрашивает src/live, здесь только тайминг:
// клетка появляется на 0,3 с и заливается на 1,1 с, «Сейчас», фраза и плашки
// меняются на 1,5 с, числа итогов на 1,7 с. До этого экран держит прежние
// значения (useStaged). При prefers-reduced-motion всё меняется сразу.

import { useEffect, useReducer, useRef, useState } from 'react'

import type { Role } from '../../api/types'
import { arrival as T, useReduced } from '../../lib/motion'
import { useLive } from '../../live/useLive'

export interface Arrival {
  id: number
  pairId: string
  role: Role
  month: number
  // Когда событие дошло до браузера, мс.
  t0: number
}

const ms = (s: number) => Math.round(s * 1000)
export const APPEAR_AT = ms(T.cellAppear)
export const FILL_AT = ms(T.cellFill)
// Заливка идёт 0,48 с, потом класс снимается: клетка уже в итоговом виде.
export const FILL_END = FILL_AT + 600
const SETTLE = ms(T.numbers) + 600
// Моменты, когда экран перерисовывается без новых данных.
const MILESTONES = [APPEAR_AT, FILL_AT, ms(T.now), FILL_END, ms(T.numbers), SETTLE]

export interface Arrivals {
  // Последнее поступление в эту клетку, пока идёт его анимация.
  cell: (pairId: string, month: number) => Arrival | undefined
  // До какого момента держать прежние значения: t0 + offset последнего поступления, 0 если держать нечего.
  holdUntil: (offsetS: number) => number
}

export function useArrivals(): Arrivals {
  const { last } = useLive()
  const reduce = useReduced()
  const [mountedAt] = useState(() => Date.now())
  const [list, setList] = useState<Arrival[]>([])
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // Каждая анкета приходит с новым id, остальное берём из того же last.
  const lastId = last?.id
  useEffect(() => {
    if (!last || reduce) return
    const t0 = Date.parse(last.at)
    // Анкета пришла, пока обзор был закрыт: только метка «новое», без анимации.
    if (Number.isNaN(t0) || t0 < mountedAt) return
    const item: Arrival = { id: last.id, pairId: last.pair_id, role: last.role, month: last.month, t0 }
    setList((prev) => (prev.some((a) => a.id === item.id) ? prev : [...prev.filter((a) => Date.now() - a.t0 < SETTLE), item]))
    for (const m of MILESTONES) timers.current.push(window.setTimeout(redraw, Math.max(0, t0 + m - Date.now())))
  }, [lastId, reduce])

  const now = Date.now()
  const running = list.filter((a) => now - a.t0 < SETTLE)
  return {
    cell: (pairId, month) => running.findLast((a) => a.pairId === pairId && a.month === month),
    holdUntil: (offsetS) => running.reduce((acc, a) => Math.max(acc, a.t0 + ms(offsetS)), 0),
  }
}

// Значение на экране отстаёт от данных до holdUntil (мс), потом догоняет.
// value должен быть стабильным между рендерами: данные react-query или примитив.
export function useStaged<T>(value: T, holdUntil: number): T {
  const [shown, setShown] = useState(value)
  const holding = Date.now() < holdUntil
  useEffect(() => {
    if (!holding) {
      setShown(value)
      return
    }
    const t = window.setTimeout(() => setShown(value), holdUntil - Date.now())
    return () => window.clearTimeout(t)
  }, [value, holdUntil, holding])
  return holding ? shown : value
}
