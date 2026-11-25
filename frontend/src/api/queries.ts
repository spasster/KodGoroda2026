// Хуки react-query поверх client.ts. Ключи запросов собраны в queryKeys, их же
// инвалидирует src/live при событиях из /api/events.

import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'

import { api, type ApiError } from './client'
import type {
  Brief,
  IngestRequest,
  IngestResult,
  PairDetail,
  ReviewStatus,
  Severity,
  Signal,
  SignalsQuery,
  Thresholds,
} from './types'
import { DEFAULT_THRESHOLDS } from '../lib/rules'

export const queryKeys = {
  overview: ['overview'] as const,
  pairs: ['pair'] as const,
  pair: (pairId: string) => ['pair', pairId] as const,
  signals: ['signals'] as const,
  signalList: (query: SignalsQuery) => ['signals', query] as const,
  survey: ['survey'] as const,
  people: ['people'] as const,
  health: ['health'] as const,
  analytics: ['analytics'] as const,
  brief: (pairId: string) => ['pair', pairId, 'brief'] as const,
  method: ['method'] as const,
}

// Ключ ситуации по контракту: {type}:{pair_id}:{role}.
export function pairIdFromSignalKey(key: string): string | null {
  return key.split(':')[1] || null
}

// Новая анкета меняет обзор, сигналы, следующий месяц в форме и карточки пар.
// Карточки все: анкета одной пары закрывает месяц для остальных, и у них
// появляются свои сигналы молчания.
export function invalidateAfterResponse(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: queryKeys.overview })
  void qc.invalidateQueries({ queryKey: queryKeys.pairs })
  void qc.invalidateQueries({ queryKey: queryKeys.signals })
  void qc.invalidateQueries({ queryKey: queryKeys.people })
  void qc.invalidateQueries({ queryKey: queryKeys.analytics })
  void qc.invalidateQueries({ queryKey: queryKeys.method })
}

// Отметка HR меняет сигнал, итоги и статус пары.
export function invalidateAfterReview(qc: QueryClient, key: string) {
  void qc.invalidateQueries({ queryKey: queryKeys.overview })
  void qc.invalidateQueries({ queryKey: queryKeys.signals })
  void qc.invalidateQueries({ queryKey: queryKeys.method })
  void qc.invalidateQueries({ queryKey: queryKeys.analytics })
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

// Пороги сигналов из survey/signals.json. Пока анкета грузится, значения по умолчанию.
export function useThresholds(): Thresholds {
  return useSurvey().data?.thresholds ?? DEFAULT_THRESHOLDS
}

export function usePeople() {
  return useQuery({ queryKey: queryKeys.people, queryFn: api.people })
}

// Какой анализатор текста включён: от него зависят метка «ИИ по тексту» и
// строка происхождения. Меняется только перезапуском бэкенда.
export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: api.health, staleTime: Infinity })
}

// openai: разбор текста делает модель; rules или пока неизвестно: словарь.
export function useAnalyzer(): 'model' | 'rules' {
  const { data } = useHealth()
  return data?.analyzer === 'openai' ? 'model' : 'rules'
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
      const note = vars.note?.trim() || null
      const updated_at = new Date().toISOString()
      const patch = (s: Signal): Signal =>
        s.key === vars.key ? { ...s, review: { ...s.review, status: vars.status, note, updated_at } } : s
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
    onSuccess: () => invalidateAfterResponse(qc),
  })
}

export function useAnalytics() {
  return useQuery({ queryKey: queryKeys.analytics, queryFn: api.analytics })
}

// Сводка, вопросы для разговора и заметки HR по паре.
export function useBrief(pairId: string) {
  return useQuery({ queryKey: queryKeys.brief(pairId), queryFn: () => api.brief(pairId), enabled: pairId !== '' })
}

export function useAddNote(pairId: string) {
  const qc = useQueryClient()
  return useMutation<Brief, ApiError, string>({
    mutationFn: (text) => api.addNote(pairId, text),
    onSuccess: (brief) => qc.setQueryData(queryKeys.brief(pairId), brief),
  })
}

export function useMethod() {
  return useQuery({ queryKey: queryKeys.method, queryFn: api.method })
}
