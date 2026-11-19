// Пустая база: первый запуск или после сброса. Одна кнопка: загрузить выгрузку
// из Excel. Форма без пар не откроется: люди в ней берутся из базы.

import { useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'

import { api, ApiError } from '../../api/client'
import type { ImportReport } from '../../api/types'
import { ErrorBanner } from '../../components'
import s from './Overview.module.css'

export function EmptyOverview() {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Файл наставников узнаём по имени, остальное считаем таблицей стажёров.
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length === 0 || busy) return
    const mentors = files.find((f) => /mentor|наставн/i.test(f.name))
    const interns = files.find((f) => f !== mentors)
    setBusy(true)
    setError(null)
    try {
      const report = await api.importExcel({ interns, mentors, replace: false })
      // Бэкенд отвечает 200 и тогда, когда ни одна строка не подошла: говорим почему.
      if (report.imported === 0) setError(emptyImportReason(report))
      await qc.invalidateQueries()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Сервер не ответил.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wrap">
      <div className={s.empty}>
        <h1 className={s.emptyTitle}>Анкет пока нет</h1>
        <label className={s.upload} aria-busy={busy || undefined}>
          <Upload aria-hidden="true" strokeWidth={1.8} />
          Загрузить Excel
          <input type="file" accept=".xlsx,.csv" multiple className="sr-only" onChange={upload} disabled={busy} />
        </label>
      </div>
      {error && <ErrorBanner className={s.emptyError} title={error} />}
    </div>
  )
}

// Первая ошибка отчёта импорта и колонки, которые не узнали.
function emptyImportReason(report: ImportReport): string {
  const first = report.files.flatMap((f) => f.errors.map((e) => e.message))[0]
  const unknown = report.files.flatMap((f) => f.unrecognized)
  const head = first ? `В файле не нашлось анкет: ${first.charAt(0).toLowerCase()}${first.slice(1)}.` : 'В файле не нашлось анкет.'
  const tail = unknown.length > 0 ? ` Не узнали колонки: ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '…' : ''}.` : ''
  return (head + tail).replace('..', '.')
}
