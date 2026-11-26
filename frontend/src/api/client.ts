// Обёртки над эндпоинтами из docs/contract.md. Адреса относительные: в разработке
// /api проксирует Vite, в Docker nginx.

import type {
  Analytics,
  Brief,
  Health,
  ImportReport,
  IngestRequest,
  IngestResult,
  Method,
  Overview,
  PairDetail,
  People,
  ReviewInput,
  Signal,
  SignalsQuery,
  Survey,
  Role,
  GoogleFormsStatus,
  ThresholdSettings,
} from './types'

export const API_BASE = '/api'
export const EVENTS_URL = `${API_BASE}/events`
export const HR_KEY_STORAGE = 'google-forms-hr-key'
const GOOGLE_FORMS_PATH = '/hr/google-forms'
const THRESHOLDS_PATH = '/settings/thresholds'

// Ошибка с текстом для человека: detail от бэкенда или наш, если бэкенд не ответил.
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function detailText(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('detail' in body)) return null
  const { detail } = body
  if (typeof detail === 'string') return detail
  // Стандартная ошибка FastAPI: список {msg}.
  if (Array.isArray(detail)) {
    const parts = detail.map((d) => (d && typeof d === 'object' && 'msg' in d ? String(d.msg) : String(d)))
    return parts.join('; ')
  }
  return null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_BASE + path, init)
  } catch {
    throw new ApiError(0, 'Нет связи с сервером')
  }
  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, detailText(body) ?? `Сервер ответил ошибкой ${res.status}`)
  }
  return body as T
}

function postJson<T>(path: string, data?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
}

function hrRequest<T>(path: string, key: string, data?: unknown): Promise<T> {
  return request<T>(path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: 'no-store',
  })
}

export const api = {
  health: () => request<Health>('/health'),
  survey: () => request<Survey>('/survey'),
  people: () => request<People>('/people'),
  overview: () => request<Overview>('/overview'),
  pair: (pairId: string) => request<PairDetail>(`/pairs/${encodeURIComponent(pairId)}`),

  signals: (query: SignalsQuery = {}) => {
    const params = new URLSearchParams()
    if (query.status) params.set('status', query.status)
    if (query.active !== undefined) params.set('active', String(query.active))
    const qs = params.toString()
    return request<Signal[]>(`/signals${qs ? `?${qs}` : ''}`)
  },

  review: (key: string, input: ReviewInput) =>
    postJson<Signal>(`/signals/${encodeURIComponent(key)}/review`, input),

  analytics: () => request<Analytics>('/analytics'),
  brief: (pairId: string) => request<Brief>(`/pairs/${encodeURIComponent(pairId)}/brief`),
  addNote: (pairId: string, text: string) => postJson<Brief>(`/pairs/${encodeURIComponent(pairId)}/notes`, { text }),
  method: () => request<Method>('/method'),

  ingest: (payload: IngestRequest) => postJson<IngestResult>('/ingest', payload),
  thresholdSettings: () => request<ThresholdSettings>(THRESHOLDS_PATH),
  saveThresholds: (key: string, values: Record<string, number>) =>
    request<ThresholdSettings>(THRESHOLDS_PATH, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }),
  resetThresholds: (key: string) => hrRequest<ThresholdSettings>(THRESHOLDS_PATH + '/reset', key, {}),
  googleForms: (key: string) => hrRequest<GoogleFormsStatus>(GOOGLE_FORMS_PATH, key),
  createGoogleForms: (key: string, cohort: string) => hrRequest<GoogleFormsStatus>(GOOGLE_FORMS_PATH, key, { cohort }),
  setupGooglePrefill: (key: string, role: Role, url: string) =>
    hrRequest<GoogleFormsStatus>(GOOGLE_FORMS_PATH + '/prefill', key, { role, url }),
  syncGoogleForms: (key: string) => hrRequest<GoogleFormsStatus>(GOOGLE_FORMS_PATH + '/sync', key, {}),
  googleFormLink: (key: string, pair_id: string, role: Role) =>
    hrRequest<{ url: string; month: number }>(GOOGLE_FORMS_PATH + '/link', key, { pair_id, role }),
  syncGsheet: () => postJson<ImportReport>('/sync/gsheet'),

  importExcel: (files: { interns?: File; mentors?: File; replace?: boolean }) => {
    const form = new FormData()
    if (files.interns) form.append('interns', files.interns)
    if (files.mentors) form.append('mentors', files.mentors)
    form.append('replace', String(Boolean(files.replace)))
    return request<ImportReport>('/import/excel', { method: 'POST', body: form })
  },

  reset: () => postJson<ImportReport>('/admin/reset'),
}
