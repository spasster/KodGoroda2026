// Подключение к /api/events без React. Обрыв, значит закрываем EventSource и
// подключаемся снова сами с нарастающей паузой: у встроенного переподключения
// пауза постоянная, и после ответа с ошибкой оно сдаётся.

import { EVENTS_URL } from '../api/client'
import type { ResponseEvent, ReviewEvent } from '../api/types'

// connecting: первая попытка после загрузки страницы, связи ещё не было.
export type LiveStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface LiveHandlers {
  onStatus: (status: LiveStatus) => void
  // reconnected: связь была и пропадала, события за это время могли потеряться.
  onOpen: (reconnected: boolean) => void
  onResponse: (event: ResponseEvent) => void
  onReview: (event: ReviewEvent) => void
  onReset: () => void
}

// Пауза перед повтором: 1, 2, 4, 8 секунд, дальше 10.
export function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000)
}

// Столько неудач подряд, и пишем «нет связи». Пробовать не перестаём.
const OFFLINE_AFTER = 3

function parse<T>(event: Event): T | null {
  try {
    return JSON.parse((event as MessageEvent<string>).data) as T
  } catch {
    return null
  }
}

// Возвращает функцию, которая закрывает соединение.
export function connectLive(handlers: LiveHandlers, url: string = EVENTS_URL): () => void {
  let source: EventSource | null = null
  let timer: number | undefined
  let failures = 0
  let wasOpen = false
  let stopped = false

  const open = () => {
    const es = new EventSource(url)
    source = es

    es.onopen = () => {
      failures = 0
      handlers.onStatus('connected')
      handlers.onOpen(wasOpen)
      wasOpen = true
    }

    es.onerror = () => {
      es.close()
      source = null
      if (stopped) return
      handlers.onStatus(failures >= OFFLINE_AFTER ? 'offline' : 'reconnecting')
      timer = window.setTimeout(open, retryDelay(failures))
      failures += 1
    }

    es.addEventListener('response', (e) => {
      const data = parse<ResponseEvent>(e)
      if (data) handlers.onResponse(data)
    })
    es.addEventListener('review', (e) => {
      const data = parse<ReviewEvent>(e)
      if (data) handlers.onReview(data)
    })
    es.addEventListener('reset', () => handlers.onReset())
  }

  handlers.onStatus('connecting')
  open()

  return () => {
    stopped = true
    window.clearTimeout(timer)
    source?.close()
  }
}
