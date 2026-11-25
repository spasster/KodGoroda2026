// Экран «Разговор», левая колонка: о чём говорить и что спросить.
// Каждый повод идёт вместе со своим доказательством: цифры, цитата и ссылка
// на комментарий месяца. Решение HR принимает в «Итоге встречи» справа.

import clsx from 'clsx'
import { ArrowDown } from 'lucide-react'

import { useBrief } from '../../api/queries'
import type { PairDetail, Role, Signal } from '../../api/types'
import { afterReview, byModelOnly, isActive, situationMonths } from '../../lib/rules'
import { Marked } from './Marked'
import { explanationLine, marksWorthShowing, openSignals, signalQuote, type QuoteView } from './model'
import s from './Talk.module.css'

const WHO: Record<Role, string> = { intern: 'стажёр', mentor: 'наставник' }

export function Topics({ pair, onQuote }: { pair: PairDetail; onQuote: (month: number) => void }) {
  const open = openSignals(pair.signals)
  const anyActive = pair.signals.some(isActive)
  // Одна и та же цитата на экране один раз.
  const seen = new Set<string>()
  const quotes = open.map((sig) => {
    const q = signalQuote(sig, pair.comments)
    if (!q || seen.has(q.text)) return null
    seen.add(q.text)
    return q
  })

  return (
    <section className={s.block} aria-labelledby="talk-topics">
      <h2 id="talk-topics" className={s.blockTitle}>
        О чём говорить
        {open.length > 0 && <span className={s.count}>{open.length}</span>}
      </h2>
      {open.length === 0 ? (
        <p className={s.none}>
          {anyActive
            ? 'Все поводы разобраны. Итог виден справа.'
            : 'Поводов для отдельного разговора нет. Это не значит, что всё в порядке: в именной анкете пишут не обо всём.'}
        </p>
      ) : (
        <ol className={s.topics}>
          {open.map((sig, i) => (
            <li key={sig.key}>
              <Topic signal={sig} quote={quotes[i]} quoteMonth={sig.quotes[0]?.month ?? null} onQuote={onQuote} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Topic({
  signal,
  quote,
  quoteMonth,
  onQuote,
}: {
  signal: Signal
  quote: QuoteView | null
  quoteMonth: number | null
  onQuote: (month: number) => void
}) {
  const textSignal = signal.type === 'text_vs_score'
  return (
    <article className={s.topic} data-sev={signal.severity}>
      <h3 className={s.topicTitle}>
        {signal.title}
        <span className={s.when}> · {situationMonths(signal)}</span>
      </h3>
      <p className={s.fact}>{explanationLine(signal)}</p>
      {quote && (
        <figure className={s.quote}>
          {textSignal && (
            <p className={clsx(s.origin, byModelOnly(signal) && s.originAi)}>
              {byModelOnly(signal) ? 'ИИ нашёл жалобу · словарь её не видит' : 'Цитата сверена с ответом дословно'}
            </p>
          )}
          <blockquote>
            «<Marked text={quote.text} marks={marksWorthShowing(quote.text, quote.marks)} />»
          </blockquote>
          <figcaption>
            {WHO[quote.role]}
            {quoteMonth != null && (
              <>
                , {quoteMonth}-й месяц ·{' '}
                <button type="button" className={s.toComment} onClick={() => onQuote(quoteMonth)}>
                  весь комментарий
                  <ArrowDown aria-hidden="true" size={14} strokeWidth={2} />
                </button>
              </>
            )}
          </figcaption>
        </figure>
      )}
      <p className={s.action}>
        <span className={s.actionLabel}>Что сделать</span>
        {signal.action}
      </p>
      {afterReview(signal).map((line) => (
        <p key={line} className={s.after}>
          {line}
        </p>
      ))}
    </article>
  )
}

const GROUPS: { to: Role | 'both'; title: string }[] = [
  { to: 'intern', title: 'Стажёру, наедине' },
  { to: 'mentor', title: 'Наставнику' },
  { to: 'both', title: 'Обоим' },
]

export function Questions({ pairId }: { pairId: string }) {
  const brief = useBrief(pairId)
  const list = brief.data?.questions ?? []
  if (list.length === 0) return null
  return (
    <section className={s.block} aria-labelledby="talk-questions">
      <h2 id="talk-questions" className={s.blockTitle}>
        Что спросить
      </h2>
      <div className={s.askGroups}>
        {GROUPS.map(({ to, title }) => {
          const qs = list.filter((q) => (q.to as string) === to)
          if (qs.length === 0) return null
          return (
            <div key={to}>
              <p className="overline">{title}</p>
              <ul className={s.asks}>
                {qs.map((q) => (
                  <li key={q.text}>{q.text}</li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
