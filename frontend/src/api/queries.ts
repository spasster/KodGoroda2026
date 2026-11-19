// Хуки react-query поверх client.ts. Ключи запросов собраны в queryKeys, их же
// инвалидирует src/live при событиях из /api/events.

import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'

import { api, type ApiError } from './client'
import type {
  IngestRequest,
  IngestResult,
  PairDetail,
  ReviewStatus,
  Severity,
  Signal,
  SignalsQuery,
} from './types'

export const queryKeys = {
  overview: ['overview'] as const,
  pair: (pairId: string) => ['pair', pairId] as const,
  signals: ['signals'] as const,
  signalList: (query: SignalsQuery) => ['signals', query] as const,
  survey: ['survey'] as const,
  people: ['people'] as const,
}

// Ключ сигнала по контракту: {type}:{pair_id}:{role}:{month}.
export function pairIdFromSignalKey(key: string): string | null {
  return key.split(':')[1] || null
}

// Новая анкета меняет обзор, пару, сигналы и следующий месяц в форме.
export function invalidateAfterResponse(qc: QueryClient, pairId: string) {
  void qc.invalidateQueries({ queryKey: queryKeys.overview })
  void qc.invalidateQueries({ queryKey: queryKeys.pair(pairId) })
  void qc.invalidateQueries({ queryKey: queryKeys.signals })
  void qc.invalidateQueries({ queryKey: queryKeys.people })
}

// Отметка HR меняет сигнал, итоги и статус пары.
export function invalidateAfterReview(qc: QueryClient, key: string) {
  void qc.invalidateQueries({ queryKey: queryKeys.overview })
  void qc.invalidateQueries({ queryKey: queryKeys.signals })
  const pairId = pairIdFromSignalKey(key)
  if (pairId) void qc.invalidateQueries({ queryKey: queryKeys.pair(pairId) })
}

export function useOverview() {
  return useQuery({ queryKey: queryKeys.overview, queryFn: api.overview })
}

// Бэкенд принимает p-03 и P-03, а события приходят с P-03: держим один ключ.
export function usePair(pairId: string | undefined) {
  const id = (pairId ?? '').trim().toUpperCase()
  return useQuery({ queryKey: queryKeys.pair(id), queryFn: () => api.pair(id), enabled: id !== '' })
}

// status и active фильтрует бэкенд, severity фильтруем здесь: в API его нет.
export interface SignalFilters extends SignalsQuery {
  severity?: Severity | 'all'
}

export function useSignals(filters: SignalFilters = {}) {
  const { severity, ...query } = filters
  return useQuery({
    queryKey: queryKeys.signalList(query),
    queryFn: () => api.signals(query),
    select: severity && severity !== 'all' ? (list: Signal[]) => list.filter((s) => s.severity === severity) : undefined,
  })
}

export function useSurvey() {
  return useQuery({ queryKey: queryKeys.survey, queryFn: api.survey })
}

export function usePeople() {
  return useQuery({ queryKey: queryKeys.people, queryFn: api.people })
}

export interface ReviewVars {
  key: string
  status: ReviewStatus
  note?: string | null
}

// Отметка видна сразу. Бэкенд ответил ошибкой, значит возвращаем как было.
export function useReview() {
  const qc = useQueryClient()
  return useMutation<Signal, ApiError, ReviewVars, { snapshot: [QueryKey, unknown][] }>({
    mutationFn: ({ key, status, note }) => api.review(key, { status, note }),
    onMutate: async (vars) => {
      const pairId = pairIdFromSignalKey(vars.key)
      const targets = [queryKeys.signals, ...(pairId ? [queryKeys.pair(pairId)] : [])]
      await Promise.all(targets.map((queryKey) => qc.cancelQueries({ queryKey })))
      const snapshot = targets.flatMap((queryKey) => qc.getQueriesData({ queryKey }))

      // Бэкенд так же обрезает пробелы и пустую заметку хранит как null.
      const review = { status: vars.status, note: vars.note?.trim() || null, updated_at: new Date().toISOString() }
      const patch = (s: Signal): Signal => (s.key === vars.key ? { ...s, review } : s)
      qc.setQueriesData<Signal[]>({ queryKey: queryKeys.signals }, (list) => list?.map(patch))
      if (pairId) {
        qc.setQueryData<PairDetail>(queryKeys.pair(pairId), (d) => d && { ...d, signals: d.signals.map(patch) })
      }
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
    },
    onSettled: (_data, _err, vars) => invalidateAfterReview(qc, vars.key),
  })
}

export function useIngest() {
  const qc = useQueryClient()
  return useMutation<IngestResult, ApiError, IngestRequest>({
    mutationFn: api.ingest,
    onSuccess: (res) => invalidateAfterResponse(qc, res.pair_id),
  })
}
