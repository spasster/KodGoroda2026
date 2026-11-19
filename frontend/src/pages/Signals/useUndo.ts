// Отмена отметки в течение нескольких секунд. Кнопки «Подтвердилось» и «Ложная
// тревога» живут в общем ReviewControl и шлют POST /api/signals/{key}/review
// отдельной мутацией на каждый ключ (сигнал и его свёрнутые повторы). Менять
// общий компонент нельзя, поэтому слушаем кэш мутаций react-query: мутации с
// {key, status} без note и есть отметки. Заметка идёт с note, снятие отметки со
// status: open, их не трогаем. Ключи, ушедшие в одном такте, склеиваем в одно
// решение. Плашку показываем, когда сервер отметку принял.

import { useQueryClient, type Mutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import type { ReviewStatus } from '../../api/types'

export type Mark = Exclude<ReviewStatus, 'open'>

export interface UndoBatch {
  id: number
  status: Mark
  keys: string[]
}

function reviewVars(v: unknown): { key: string; status: ReviewStatus } | null {
  if (!v || typeof v !== 'object' || 'note' in v) return null
  const { key, status } = v as { key?: unknown; status?: unknown }
  if (typeof key !== 'string') return null
  if (status !== 'open' && status !== 'confirmed' && status !== 'rejected') return null
  return { key, status }
}

type AnyMutation = Mutation<unknown, unknown, unknown, unknown>

interface Pending {
  status: Mark
  mutations: AnyMutation[]
}

export function useMarkedBatch(): [UndoBatch | null, (b: UndoBatch | null) => void] {
  const qc = useQueryClient()
  const [batch, setBatch] = useState<UndoBatch | null>(null)

  useEffect(() => {
    let nextId = 1
    const seen = new WeakSet<AnyMutation>()
    const groups: Pending[] = []
    let collecting: Pending | null = null

    const settle = (g: Pending) => {
      if (g.mutations.some((m) => m.state.status === 'pending')) return
      groups.splice(groups.indexOf(g), 1)
      const keys = g.mutations
        .filter((m) => m.state.status === 'success')
        .map((m) => reviewVars(m.state.variables)?.key)
        .filter((k): k is string => k != null)
      if (keys.length > 0) setBatch({ id: nextId++, status: g.status, keys })
    }

    return qc.getMutationCache().subscribe((e) => {
      if (e.type !== 'updated') return
      const m = e.mutation as AnyMutation
      const vars = reviewVars(m.state.variables)
      if (!vars) return

      if (e.action.type === 'pending') {
        // pending приходит дважды: до onMutate и после. Нужен первый.
        if (seen.has(m)) return
        seen.add(m)
        if (vars.status === 'open') return
        if (!collecting || collecting.status !== vars.status) {
          const g: Pending = { status: vars.status, mutations: [] }
          groups.push(g)
          collecting = g
          window.setTimeout(() => {
            if (collecting === g) collecting = null
          }, 0)
        }
        collecting.mutations.push(m)
        return
      }

      if (e.action.type === 'success' || e.action.type === 'error') {
        const g = groups.find((x) => x.mutations.includes(m))
        if (g) settle(g)
      }
    })
  }, [qc])

  return [batch, setBatch]
}
