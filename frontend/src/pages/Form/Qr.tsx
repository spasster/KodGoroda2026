// QR-код со ссылкой на /form для проектора: жюри сканирует его с телефона.
// Без оболочки дашборда. Адрес туннеля cloudflared (make tunnel) вставляется в
// поле и запоминается в localStorage. Пока адрес локальный, кода нет: телефон
// в зале localhost не откроет, а рабочий на вид код обещал бы обратное.

import clsx from 'clsx'
import QRCode from 'qrcode'
import { useId, useMemo, useState, type FormEvent } from 'react'

import { Button } from '../../components'
import { FormHeader, useDocumentTitle } from './FormHeader'
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
export function normalizeBase(raw: string): string | null {
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

// Свой SVG по матрице qrcode: цвет и фон задаёт CSS, тема меняется без перерисовки.
// Поле в 4 модуля вокруг кода входит в viewBox.
function QrCode({ value, label }: { value: string; label: string }) {
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
    <svg className={s.code} viewBox={`-4 -4 ${size + 8} ${size + 8}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <path d={d} fill="currentColor" />
    </svg>
  )
}

export function FormQrPage() {
  useDocumentTitle('QR-код анкеты')
  const inputId = useId()
  const [stored, setStored] = useState(readStored)
  const [draft, setDraft] = useState(stored)
  const [invalid, setInvalid] = useState(false)

  const base = normalizeBase(stored) ?? window.location.origin
  const formUrl = `${base}/form`
  const local = isLocalHost(base)

  const apply = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) {
      reset()
      return
    }
    const next = normalizeBase(draft)
    if (!next) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setStored(next)
    setDraft(next)
    writeStored(next)
  }

  const reset = () => {
    setInvalid(false)
    setStored('')
    setDraft('')
    writeStored('')
  }

  return (
    <div className={s.page}>
      <FormHeader wide />
      <main className={`wrap ${s.main}`}>
        <div className={s.text}>
          {local ? (
            <>
              <h1>Сначала адрес туннеля</h1>
              <p className={s.lead}>
                Телефон в зале не откроет адрес ноутбука. Запустите make tunnel и вставьте адрес из его вывода в поле ниже.
              </p>
            </>
          ) : (
            <>
              <h1>Откройте камерой телефона</h1>
              <p className={s.lead}>Откроется анкета стажёра и наставника. Ответ сразу появится на дашборде.</p>
              <p className={s.url}>
                <a href={formUrl} target="_blank" rel="noopener">
                  {formUrl.replace(/^https?:\/\//, '')}
                </a>
              </p>
            </>
          )}

          <form className={s.form} onSubmit={apply} noValidate>
            <label className={s.label} htmlFor={inputId}>
              Адрес туннеля
            </label>
            <div className={s.row}>
              <input
                id={inputId}
                className={s.input}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://….trycloudflare.com"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setInvalid(false)
                }}
                aria-invalid={invalid || undefined}
                aria-describedby={`${inputId}-hint`}
              />
              <Button type="submit">Показать</Button>
            </div>
            <p className={clsx(s.hint, invalid && s['hint-error'])} id={`${inputId}-hint`}>
              {invalid
                ? 'Это не похоже на адрес. Пример: https://abc-def.trycloudflare.com'
                : 'Адрес из make tunnel. Он запомнится в этом браузере.'}
            </p>
            {stored && (
              <Button variant="quiet" size="s" className={s.reset} onClick={reset}>
                Сбросить адрес
              </Button>
            )}
          </form>
        </div>

        {local ? (
          <div className={clsx(s.plate, s.placeholder)}>
            <p>Вставьте адрес из make tunnel, и здесь появится QR&#8209;код.</p>
          </div>
        ) : (
          <figure className={s.plate}>
            <QrCode value={formUrl} label={`QR-код ссылки на анкету: ${formUrl}`} />
          </figure>
        )}
      </main>
    </div>
  )
}
