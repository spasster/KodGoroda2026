// QR-код со ссылкой на /form для проектора: жюри сканирует его с телефона
// (docs/design/v2.md, «QR»). Адрес туннеля cloudflared (make tunnel) вставляется
// в поле и запоминается в localStorage. Пока адрес локальный, кода нет: телефон
// в зале localhost не откроет.

import clsx from 'clsx'
import { QrCode as QrIcon } from 'lucide-react'
import QRCode from 'qrcode'
import { useMemo, useState, type FormEvent } from 'react'

import { useDocumentTitle } from './title'
import s from './Qr.module.css'

const STORAGE_KEY = 'form-qr-base'

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeStored(value: string) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Приватный режим: адрес живёт до перезагрузки.
  }
}

// «abc.trycloudflare.com/form/» → «https://abc.trycloudflare.com». null: не адрес.
function normalizeBase(raw: string): string | null {
  let value = raw.trim()
  if (!value) return null
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) value = `https://${value}`
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null
  const path = url.pathname.replace(/\/+$/, '').replace(/\/form(\/qr)?$/, '')
  return url.origin + path
}

// Адрес, который телефон в зале не откроет: этот же ноутбук.
function isLocalHost(base: string): boolean {
  const host = new URL(base).hostname
  return host === 'localhost' || host === '0.0.0.0' || host === '[::1]' || host.startsWith('127.')
}

// Свой SVG по матрице qrcode. Поле в 4 модуля вокруг кода входит в viewBox.
function QrCode({ value }: { value: string }) {
  const { d, size } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' })
    let path = ''
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.data[row * modules.size + col]) path += `M${col} ${row}h1v1h-1z`
      }
    }
    return { d: path, size: modules.size }
  }, [value])
  return (
    <svg className={s.code} viewBox={`-4 -4 ${size + 8} ${size + 8}`} role="img" aria-label={`QR-код: ${value}`} shapeRendering="crispEdges">
      <path d={d} />
    </svg>
  )
}

export function FormQrPage() {
  useDocumentTitle('QR-код анкеты')
  const [stored, setStored] = useState(readStored)
  const [draft, setDraft] = useState(stored)
  const [editing, setEditing] = useState(false)
  const [invalid, setInvalid] = useState(false)

  const base = normalizeBase(stored) ?? window.location.origin
  const formUrl = `${base}/form`
  const local = isLocalHost(base)

  const save = (next: string) => {
    setStored(next)
    setDraft(next)
    writeStored(next)
    setInvalid(false)
    setEditing(false)
  }

  const apply = (e: FormEvent) => {
    e.preventDefault()
    // Пустое поле: снова адрес этого компьютера.
    if (!draft.trim()) return save('')
    const next = normalizeBase(draft)
    if (next) save(next)
    else setInvalid(true)
  }

  return (
    <main className={s.page}>
      <section className={s.card}>
        {local ? (
          <div className={s.plate}>
            <QrIcon className={s.icon} aria-hidden="true" strokeWidth={1.5} />
            <p>Вставьте адрес туннеля</p>
          </div>
        ) : (
          <div className={clsx(s.plate, s.white)} key={formUrl}>
            <QrCode value={formUrl} />
          </div>
        )}

        <h1 className={s.title}>Анкета стажировки МГТС</h1>
        <a className={s.url} href={formUrl} target="_blank" rel="noopener">
          {formUrl.replace(/^https?:\/\//, '')}
        </a>

        {local || editing ? (
          <form className={s.form} onSubmit={apply} noValidate>
            <input
              className={clsx(s.input, invalid && s.invalid)}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="xxx.trycloudflare.com"
              aria-label="Адрес туннеля"
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? 'qr-invalid' : undefined}
              value={draft}
              autoFocus={editing}
              onChange={(e) => {
                setDraft(e.target.value)
                setInvalid(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && editing) {
                  setDraft(stored)
                  setInvalid(false)
                  setEditing(false)
                }
              }}
            />
            <button type="submit" className={s.button}>
              Показать
            </button>
            {invalid && (
              <p className={s.error} id="qr-invalid" role="alert">
                Не похоже на адрес
              </p>
            )}
          </form>
        ) : (
          <button type="button" className={s.link} onClick={() => setEditing(true)}>
            Изменить адрес
          </button>
        )}
      </section>
    </main>
  )
}
