// Демо-пульт для защиты. Клавиша n шлёт следующую анкету живого демо в
// POST /api/ingest: сначала S-01 за 6-й месяц, потом M-01 и дальше по порядку
// из data/sample/truth.json → demo.order. Shift+D открывает панель со всеми
// демо-анкетами. Уведомление и обновление данных приходят обычным путём, через
// /api/events. Клавиши не срабатывают в полях ввода и с Ctrl, Cmd, Alt.
// Файлы *.json здесь копия data/sample/demo/. Пульт работает только с анкетами людей, которые есть
// в /api/people: на данных МГТС (СТ-001, Н-001) старых S-01 и M-01 нет, и тогда n и Shift+D ничего не делают.

import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { api, ApiError } from '../api/client'
import { invalidateAfterResponse, usePeople } from '../api/queries'
import type { IngestRequest, People } from '../api/types'
import { formatCount, personName, ROLE_LABEL, type Forms } from '../lib/format'
import s from './DemoPanel.module.css'

// Порядок живого демо: первая анкета красит P-01, вторая даёт разрыв.
const ORDER = [
  'intern_S-01_m6.json',
  'mentor_M-01_m6.json',
  'mentor_M-02_m6.json',
  'intern_S-03_m6.json',
  'intern_S-04_m6.json',
  'mentor_M-05_m6.json',
]

const NEW_SIGNAL: Forms = ['новый сигнал', 'новых сигнала', 'новых сигналов']

const files = import.meta.glob<IngestRequest>('./*.json', { eager: true, import: 'default' })
const DEMO: IngestRequest[] = ORDER.map((name) => files[`./${name}`]).filter((d): d is IngestRequest => d != null)

function person(d: IngestRequest, people: People | undefined) {
  const list = d.role === 'intern' ? people?.interns : people?.mentors
  return list?.find((p) => p.id === d.person_id)
}

// Анкета этого человека за этот месяц уже есть в базе.
function isSent(d: IngestRequest, people: People | undefined): boolean {
  const next = person(d, people)?.next_month
  return next === null || (next != null && next > d.month)
}

// Поле ввода или редактор: там n и Shift+D печатают буквы.
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

type Result = { ok: boolean; text: string }

export function DemoPanel() {
  const qc = useQueryClient()
  const people = usePeople()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const busyRef = useRef(false)

  const nameOf = useCallback((d: IngestRequest) => personName(person(d, people.data)?.name, d.person_id), [people.data])

  const send = useCallback(
    async (d: IngestRequest) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      try {
        const res = await api.ingest(d)
        invalidateAfterResponse(qc)
        const n = res.new_signals.length
        setResult({ ok: true, text: `${nameOf(d)}: ${n ? formatCount(n, NEW_SIGNAL) : 'новых сигналов нет'}` })
      } catch (e) {
        setResult({ ok: false, text: e instanceof ApiError ? e.message : 'Сервер не ответил' })
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [qc, nameOf],
  )

  const reset = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await api.reset()
      void qc.invalidateQueries()
      setResult({ ok: true, text: 'База сброшена' })
    } catch (e) {
      setResult({ ok: false, text: e instanceof ApiError ? e.message : 'Сервер не ответил' })
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  // Только анкеты людей из базы: анкета на чужой ID вернёт ошибку.
  const live = DEMO.filter((d) => person(d, people.data) != null)
  // Следующая анкета: первая из ORDER, которой ещё нет в базе. Все есть: первая заново.
  const next = live.find((d) => !isSent(d, people.data)) ?? live[0]
  const enabled = live.length > 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      if (!enabled) return
      // e.code, а не e.key: в русской раскладке n печатает «т».
      if (e.code === 'KeyN' && !e.shiftKey && next) {
        e.preventDefault()
        void send(next)
      } else if (e.code === 'KeyD' && e.shiftKey) {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.code === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, send, enabled])

  if (!open || !enabled) return null

  return (
    <section className={s.panel} aria-label="Демо-пульт" aria-busy={busy || undefined}>
      <div className={s.head}>
        <b>Демо, {live[0]?.month}-й месяц</b>
        <button type="button" className={s.close} aria-label="Скрыть демо-пульт" onClick={() => setOpen(false)}>
          <X aria-hidden="true" strokeWidth={1.8} />
        </button>
      </div>
      <ul className={s.list}>
        {live.map((d) => {
          const sent = isSent(d, people.data)
          return (
            <li key={`${d.role}:${d.person_id}:${d.month}`}>
              <button type="button" className={s.item} onClick={() => void send(d)} aria-busy={busy || undefined}>
                <i className={clsx(s.role, d.role === 'mentor' && s.mentor)} aria-hidden="true" />
                <span className={s.who}>
                  {nameOf(d)}, {ROLE_LABEL[d.role]}
                </span>
                <span className={s.meta}>{sent ? 'отправлена' : d === next ? 'следующая' : ''}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {result && (
        <p className={s.result} role={result.ok ? 'status' : 'alert'}>
          {result.text}
        </p>
      )}
      <div className={s.foot}>
        <span>
          <kbd>n</kbd> следующая
        </span>
        <button type="button" className={s.reset} onClick={() => void reset()} aria-busy={busy || undefined}>
          Сбросить базу
        </button>
      </div>
    </section>
  )
}
