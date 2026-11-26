// Экран «Как считаем» (/method): принципы, проверка ИИ и таблица сигналов.
// Всё берётся из GET /api/method, текстов методики во фронте нет.

import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Fragment, useEffect, useState, type FormEvent } from 'react'

import { api, HR_KEY_STORAGE } from '../../api/client'
import { queryKeys, useAnalytics, useMethod, useThresholdSettings } from '../../api/queries'
import type { Quality, QualitySet, ThresholdSettings } from '../../api/types'
import { LoadError, Loading, PageHeader, Skeleton } from '../../components'
import { Button } from '../../components/Button'
import { formatNumber, plural } from '../../lib/format'
import s from './Method.module.css'

export function MethodPage() {
  const method = useMethod()
  const m = method.data
  // Сравнение сигналов со средней оценкой считает бэкенд по текущим данным.
  const compare = useAnalytics().data?.effect.conclusion
  // Раскрыта одна строка, по умолчанию первая.
  const [openType, setOpenType] = useState<string | null | undefined>(undefined)
  const current = openType === undefined ? (m?.signals[0]?.type ?? null) : openType

  return (
    <>
      <PageHeader title="Как считаем сигналы" />
      <div className={clsx('wrap', s.page)}>
        {method.isError && !m && <LoadError query={method} className={s.error} />}
        {!m && !method.isError && (
          <Loading className={s.stack}>
            <Skeleton height={140} radius="var(--r-card)" />
            <Skeleton height={320} radius="var(--r-card)" />
          </Loading>
        )}
        {m && (
          <>
            <QualityHero quality={m.quality} />

            <section className={s.card}>
              <ul className={s.principles}>
                {m.principles.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>

            <QualityDetails quality={m.quality} />

            <section className={s.card} aria-labelledby="method-signals">
              <h2 id="method-signals" className="sr-only">
                Сигналы
              </h2>
              <div className={s.scroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th scope="col" className={s.cName}>
                        Сигнал
                      </th>
                      <th scope="col">Как считаем</th>
                      <th scope="col" className={s.cNow}>
                        Сейчас
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.signals.map((x) => {
                      const open = current === x.type
                      return (
                        <Fragment key={x.type}>
                          <tr className={clsx(s.row, open && s.rowOpen)} onClick={() => setOpenType(open ? null : x.type)}>
                            <td className={s.cName}>
                              <button
                                type="button"
                                className={s.toggle}
                                aria-expanded={open}
                                aria-controls={`method-${x.type}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenType(open ? null : x.type)
                                }}
                              >
                                <ChevronRight className={s.chevron} aria-hidden="true" size={16} strokeWidth={1.8} />
                                {x.name}
                              </button>
                            </td>
                            <td>{x.how}</td>
                            <td className={s.cNow}>
                              открыто {x.open} · подтвердилось {x.confirmed} · проблемы нет {x.rejected}
                            </td>
                          </tr>
                          {open && (
                            <tr id={`method-${x.type}`} className={s.detail}>
                              <td colSpan={3}>
                                <div className={s.detailInner}>
                                  <h3 className={s.h3}>Почему важен</h3>
                                  <ol className={s.list}>
                                    {x.why.map((w) => (
                                      <li key={w}>{w}</li>
                                    ))}
                                  </ol>
                                  <h3 className={s.h3}>Что делает HR</h3>
                                  <p>{x.action}</p>
                                  <h3 className={s.h3}>Где ошибается</h3>
                                  <p>{x.limit}</p>
                                  {x.source && (
                                    <>
                                      <h3 className={s.h3}>Опора</h3>
                                      <p>{x.source}</p>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <ThresholdsCard />

            {compare && (
              <section className={s.card} aria-labelledby="method-compare">
                <h2 id="method-compare" className={s.h2}>
                  Что средняя оценка не показывает
                </h2>
                <p className={s.compare}>{compare}</p>
              </section>
            )}
            <p className={s.baseline}>{m.baseline}</p>
          </>
        )}
      </div>
    </>
  )
}

// Порог как есть, с запятой: 0,48 нельзя округлять до 0,5, иначе форма сохранит другое значение.
const plainNumber = (value: number) => String(value).replace('.', ',')

// Пороги сигналов: HR меняет их здесь, файл survey/signals.json остаётся исходным значением.
function ThresholdsCard() {
  const qc = useQueryClient()
  const settings = useThresholdSettings().data
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [key, setKey] = useState(() => sessionStorage.getItem(HR_KEY_STORAGE) ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Сервер прислал новые значения (сохранили здесь или в другой вкладке): форма показывает их.
  useEffect(() => {
    if (settings) setDraft(Object.fromEntries(settings.fields.map((f) => [f.id, plainNumber(f.value)])))
  }, [settings])

  if (!settings) return null
  const parsed = Object.fromEntries(settings.fields.map((f) => [f.id, Number((draft[f.id] ?? '').replace(',', '.'))]))
  const invalid = settings.fields.some((f) => (draft[f.id] ?? '').trim() === '' || Number.isNaN(parsed[f.id]))
  const dirty = settings.fields.some((f) => parsed[f.id] !== f.value)

  async function run(request: () => Promise<ThresholdSettings>, success: string) {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const result = await request()
      sessionStorage.setItem(HR_KEY_STORAGE, key.trim())
      qc.setQueryData(queryKeys.thresholdSettings, result)
      // Сигналы, светофор и формулировки выше зависят от порогов: перечитываем всё.
      void qc.invalidateQueries()
      setMessage(success)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Запрос не выполнен.')
    } finally {
      setBusy(false)
    }
  }

  function save(e: FormEvent) {
    e.preventDefault()
    void run(() => api.saveThresholds(key.trim(), parsed), 'Пороги сохранены, сигналы пересчитаны.')
  }

  return (
    <section className={s.card} aria-labelledby="method-thresholds">
      <h2 id="method-thresholds" className={s.h2}>
        Пороги сигналов
      </h2>
      <p className={s.tuneLead}>
        {settings.can_edit
          ? 'Меняются здесь, без правки кода. После сохранения сигналы и светофор пересчитываются по всей истории.'
          : 'Чтобы менять пороги, администратор должен настроить ключ HR. Сейчас действуют значения из файла настроек.'}
      </p>
      <form className={s.tune} onSubmit={save}>
        {settings.fields.map((f) => (
          <div key={f.id} className={s.tuneRow}>
            <label htmlFor={`th-${f.id}`} className={s.tuneLabel}>
              {f.label}
              <span className={s.tuneHint}>{f.hint}</span>
            </label>
            <div className={s.tuneValue}>
              <input
                id={`th-${f.id}`}
                className={s.tuneInput}
                inputMode="decimal"
                autoComplete="off"
                disabled={!settings.can_edit || busy}
                value={draft[f.id] ?? ''}
                onChange={(e) => setDraft({ ...draft, [f.id]: e.target.value })}
              />
              {f.unit && !Number.isNaN(parsed[f.id]) && <span className={s.tuneUnit}>{plural(parsed[f.id], ['балл', 'балла', 'баллов'])}</span>}
              {parsed[f.id] !== f.default && <span className={s.tuneDefault}>исходно {plainNumber(f.default)}</span>}
            </div>
          </div>
        ))}
        {settings.can_edit && (
          <div className={s.tuneFoot}>
            <label htmlFor="th-key" className={s.tuneKey}>
              Ключ доступа HR
              <input id="th-key" className={s.tuneKeyInput} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
            </label>
            <div className={s.tuneActions}>
              <Button variant="brand" type="submit" busy={busy} disabled={!dirty || invalid || !key.trim()}>
                Сохранить пороги
              </Button>
              {settings.changed && (
                <Button busy={busy} disabled={!key.trim()} onClick={() => void run(() => api.resetThresholds(key.trim()), 'Вернули исходные пороги.')}>
                  Вернуть исходные
                </Button>
              )}
            </div>
          </div>
        )}
        {message && <p role="status" className={s.tuneOk}>{message}</p>}
        {error && <p role="alert" className={s.tuneError}>{error}</p>}
      </form>
    </section>
  )
}

// Настоящие отзывы: набор, по которому не настраивали ни словарь, ни промпт.
function realSet(quality: Quality): QualitySet | undefined {
  return quality.sets.find((x) => x.id === 'holdout') ?? quality.sets.find((x) => /настоящ/i.test(x.name))
}

function QualityHero({ quality }: { quality: Quality | null }) {
  const real = quality && realSet(quality)
  if (!quality || !real) return null
  const n = real.comments
  return (
    <section className={s.card} aria-labelledby="method-proof">
      <h2 id="method-proof" className="sr-only">
        Проверка на настоящих отзывах
      </h2>
      <div className={s.big}>
        <div>
          <p className={s.bigNum}>
            {real.model.found} из {real.problems}
          </p>
          <p className={s.bigLabel}>ИИ нашёл проблем</p>
        </div>
        <div>
          <p className={s.bigNum}>
            {real.rules.found} из {real.problems}
          </p>
          <p className={s.bigLabel}>нашёл словарь</p>
        </div>
        <div>
          <p className={s.bigNum}>{real.model.false_alarms}</p>
          <p className={s.bigLabel}>ложных тревог у ИИ</p>
        </div>
      </div>
      <p className={s.caption}>
        {n} {plural(n, ['настоящий отзыв', 'настоящих отзыва', 'настоящих отзывов'])} стажёров и наставников. По ним не настраивали ни словарь, ни промпт.
      </p>
    </section>
  )
}

function QualityDetails({ quality }: { quality: Quality | null }) {
  if (!quality) return null
  const real = realSet(quality)
  const tests = quality.sets.filter((x) => x !== real)
  return (
    <section className={s.card} aria-labelledby="method-quality">
      <h2 id="method-quality" className={s.h2}>
        Где ошибается
      </h2>
      {quality.errors.length > 0 && (
        <ul className={s.list}>
          {quality.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <p className={s.text}>
        ИИ {quality.model}, {formatNumber(quality.seconds_per_comment)} с на комментарий
      </p>
      {tests.length > 0 && (
        <details className={s.details}>
          <summary>Тестовый набор, под который писали словарь</summary>
          <div className={s.sets}>
            {tests.map((x) => (
              <QualitySetView key={x.id} set={x} />
            ))}
          </div>
        </details>
      )}
    </section>
  )
}

function QualitySetView({ set: x }: { set: QualitySet }) {
  const n = x.comments
  return (
    <div className={s.set}>
      <p className={s.setName}>{x.name}</p>
      <p className={s.setSub}>
        {n} {plural(n, ['комментарий', 'комментария', 'комментариев'])}, {x.problems} с проблемой
      </p>
      <Bar label={`ИИ: найдено ${x.model.found} из ${x.problems}, ложных тревог ${x.model.false_alarms}`} value={x.model.found} total={x.problems} ai />
      <Bar label={`Словарь: найдено ${x.rules.found} из ${x.problems}, ложных тревог ${x.rules.false_alarms}`} value={x.rules.found} total={x.problems} />
    </div>
  )
}

// Полоски двух способов в одной шкале от 0 до числа проблем.
function Bar({ label, value, total, ai = false }: { label: string; value: number; total: number; ai?: boolean }) {
  return (
    <div className={s.bar}>
      <span className={s.barLabel}>{label}</span>
      <span className={s.track} aria-hidden="true">
        <i className={ai ? s.fillAi : s.fillRules} style={{ width: `${total ? Math.min(100, (value / total) * 100) : 0}%` }} />
      </span>
    </div>
  )
}
