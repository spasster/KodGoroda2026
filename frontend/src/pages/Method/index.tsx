// Экран «Как считаем» (/method): принципы, проверка ИИ и карточка на каждый сигнал.
// Всё берётся из GET /api/method, текстов методики во фронте нет.

import clsx from 'clsx'

import { useMethod } from '../../api/queries'
import type { MethodSignal, Quality, QualitySet } from '../../api/types'
import { Hero, LoadError, Loading, Skeleton } from '../../components'
import { formatNumber, plural } from '../../lib/format'
import s from './Method.module.css'

export function MethodPage() {
  const method = useMethod()
  const m = method.data

  return (
    <>
      <Hero title="Как считаем сигналы" />
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
            <section className={s.card}>
              <ul className={s.principles}>
                {m.principles.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>

            <section className={s.card} aria-labelledby="method-quality">
              <h2 id="method-quality" className={s.h2}>
                Проверка
              </h2>
              <QualityBlock quality={m.quality} />
            </section>

            {m.signals.map((sig) => (
              <SignalCard key={sig.type} signal={sig} />
            ))}

            <p className={s.baseline}>{m.baseline}</p>
          </>
        )}
      </div>
    </>
  )
}

function setLine(x: QualitySet): string {
  const n = x.comments
  const { model: m, rules: r } = x
  return (
    `${x.name}. ${n} ${plural(n, ['комментарий', 'комментария', 'комментариев'])}, ${x.problems} с проблемой. ` +
    `ИИ нашёл ${m.found} из ${x.problems} проблем, ложных тревог ${m.false_alarms}. ` +
    `Словарь нашёл ${r.found} из ${x.problems}, ложных тревог ${r.false_alarms}.`
  )
}

function QualityBlock({ quality }: { quality: Quality | null }) {
  if (!quality) return <p className={s.text}>Проверка ИИ ещё не запускалась</p>
  return (
    <>
      <ul className={s.sets}>
        {quality.sets.map((x) => (
          <li key={x.id}>{setLine(x)}</li>
        ))}
      </ul>
      <p className={s.text}>
        ИИ {quality.model}, {formatNumber(quality.seconds_per_comment)} с на комментарий.
      </p>
      {quality.errors.length > 0 && (
        <>
          <h3 className={s.h3}>Где ошибается</h3>
          <ul className={s.list}>
            {quality.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function SignalCard({ signal: x }: { signal: MethodSignal }) {
  return (
    <section className={s.card} aria-labelledby={`method-${x.type}`}>
      <h2 id={`method-${x.type}`} className={s.h2}>
        {x.name}
      </h2>
      <h3 className={s.h3}>Как считаем</h3>
      <p className={s.text}>{x.how}</p>
      <h3 className={s.h3}>Почему важен</h3>
      <ol className={s.list}>
        {x.why.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ol>
      <h3 className={s.h3}>Что делает HR</h3>
      <p className={s.text}>{x.action}</p>
      <h3 className={s.h3}>Где ошибается</h3>
      <p className={s.text}>{x.limit}</p>
      {x.source && (
        <>
          <h3 className={s.h3}>Опора</h3>
          <p className={s.text}>{x.source}</p>
        </>
      )}
      <p className={s.counts}>
        Открыто {x.open}, подтвердилось {x.confirmed}, проблемы нет {x.rejected}
      </p>
    </section>
  )
}
