// Экран «Как считаем» (/method): принципы, проверка ИИ и таблица сигналов.
// Всё берётся из GET /api/method, текстов методики во фронте нет.

import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { Fragment, useState } from 'react'

import { useMethod } from '../../api/queries'
import type { Quality, QualitySet } from '../../api/types'
import { LoadError, Loading, PageHeader, Skeleton } from '../../components'
import { formatNumber, plural } from '../../lib/format'
import s from './Method.module.css'

export function MethodPage() {
  const method = useMethod()
  const m = method.data
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

            <p className={s.baseline}>{m.baseline}</p>
          </>
        )}
      </div>
    </>
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
