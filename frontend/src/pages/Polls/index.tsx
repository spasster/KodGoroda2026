import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { api, HR_KEY_STORAGE } from '../../api/client'
import type { GoogleForm, GoogleFormsStatus, Role } from '../../api/types'
import { ErrorBanner, PageHeader } from '../../components'
import { Button } from '../../components/Button'
import s from './Polls.module.css'

export function PollsPage() {
  const [key, setKey] = useState(() => sessionStorage.getItem(HR_KEY_STORAGE) ?? '')
  const [status, setStatus] = useState<GoogleFormsStatus | null>(null)
  const [cohort, setCohort] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const forms = status?.forms ?? []
  const savedCohort = forms[0]?.cohort
  const complete = forms.length === 2 && forms.every((form) => form.published)

  async function run(request: () => Promise<GoogleFormsStatus>, success = '') {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const result = await request()
      sessionStorage.setItem(HR_KEY_STORAGE, key.trim())
      setStatus(result)
      setMessage(success)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Запрос не выполнен.')
    } finally {
      setBusy(false)
    }
  }

  function unlock(e: FormEvent) {
    e.preventDefault()
    void run(() => api.googleForms(key.trim()))
  }

  return (
    <>
      <PageHeader title="Опросы" facts="Две Google Формы на весь поток стажировки" />
      <div className={`wrap ${s.page}`}>
        {status === null ? (
          <form className={s.panel} onSubmit={unlock}>
            <h2>Доступ HR</h2>
            <label>Ключ доступа HR
              <input autoComplete="off" type="password" required value={key} onChange={(e) => setKey(e.target.value)} />
            </label>
            <Button variant="brand" type="submit" disabled={busy || !key.trim()}>Открыть опросы</Button>
          </form>
        ) : (
          <>
            <section className={s.panel}>
              <h2>{savedCohort ?? 'Создание форм'}</h2>
              {!complete && !savedCohort && (
                <label>Название потока
                  <input value={cohort} maxLength={80} onChange={(e) => setCohort(e.target.value)} />
                </label>
              )}
              <div className={s.actions}>
                {!complete && (
                  <Button variant="brand" disabled={busy || !(savedCohort ?? cohort.trim())}
                    onClick={() => void run(() => api.createGoogleForms(key.trim(), savedCohort ?? cohort.trim()),
                      'Формы опубликованы. Сохраните ссылку предзаполнения для каждой роли.')}>
                    {savedCohort ? 'Завершить создание' : 'Создать две формы'}
                  </Button>
                )}
                {forms.some((form) => form.ready) && (
                  <Button disabled={busy} onClick={() => void run(() => api.syncGoogleForms(key.trim()), 'Проверка завершена')}>
                    Проверить подключение
                  </Button>
                )}
              </div>
              <Link to="/analytics#collect">Статус прохождения опросов и личные ссылки</Link>
              {busy && <p role="status">Выполняем запрос…</p>}
              {message && <p role="status">{message}</p>}
            </section>
            {forms.map((form) => (
              <FormSetup key={form.role} form={form} sample={status.prefill_sample} busy={busy}
                onSave={(role, url) => void run(() => api.setupGooglePrefill(key.trim(), role, url), 'Предзаполнение подключено')} />
            ))}
          </>
        )}
        {error && <ErrorBanner title={error} />}
      </div>
    </>
  )
}

function FormSetup({ form, sample, busy, onSave }: {
  form: GoogleForm; sample: string; busy: boolean; onSave: (role: Role, url: string) => void
}) {
  const [url, setUrl] = useState('')
  const delivery = form.last_delivery
  return (
    <section className={s.panel}>
      <h2>{form.title}</h2>
      {!form.published ? <p>Создание не завершено</p> : (
        <>
          <p>{form.ready ? 'Личные ссылки доступны' : 'Ожидается настройка предзаполнения'}</p>
          {delivery?.rejection && <p role="alert">{delivery.rejection}</p>}
          {delivery && !delivery.rejection && (
            <p>Ответ принят. Пара {delivery.pair_id}, месяц {delivery.month}. {delivery.analyzed_at ? 'Аналитика обновлена.' : 'Идёт анализ.'}</p>
          )}
          {form.sync_error && <p role="alert">{form.sync_error}</p>}
          {form.synced_at && <p>Последняя проверка {new Date(form.synced_at).toLocaleString('ru-RU')}</p>}
          {form.edit_url && <a href={form.edit_url} target="_blank" rel="noreferrer">Открыть редактор Google Формы</a>}
          <details open={form.ready ? undefined : true}>
            <summary>Предзаполнение личных ссылок</summary>
            <form className={s.fields} onSubmit={(event) => { event.preventDefault(); onSave(form.role, url.trim()) }}>
              <p>В редакторе откройте меню «Ещё» и выберите «Форма с предварительным заполнением».
                Введите <code>{sample}</code> только в поле «Код приглашения», получите ссылку и вставьте её ниже.</p>
              <label>Ссылка предзаполнения<input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} /></label>
              <Button type="submit" disabled={busy || !url.trim()}>Сохранить ссылку</Button>
            </form>
          </details>
        </>
      )}
    </section>
  )
}
