// Экран «Разговор», левая колонка: о чём говорить и что спросить.
// Каждый повод идёт вместе со своим доказательством: цифры, цитата и ссылка
// на комментарий месяца. Решение HR принимает в «Итоге встречи» справа.

import { ArrowDown } from 'lucide-react'

import { useBrief } from '../../api/queries'
import type { PairDetail, Role, Signal } from '../../api/types'
import { Badge } from '../../ds/components/data-display/Badge'
import { Tag } from '../../ds/components/data-display/Tag'
import { formatNumber } from '../../lib/format'
import { afterReview, byModelOnly, isActive, situationMonths } from '../../lib/rules'
import { Marked } from './Marked'
import {
  explanationLine,
  marksWorthShowing,
  monthsLabel,
  noteSignals,
  openSignals,
  pastSignals,
  recovery,
  signalQuote,
  signalSources,
  valueTags,
  type QuoteView,
} from './model'
import s from './Talk.module.css'

const WHO: Record<Role, string> = { intern: 'стажёр', mentor: 'наставник' }

export function Topics({ pair, onQuote }: { pair: PairDetail; onQuote: (month: number) => void }) {
  const open = openSignals(pair.signals).filter((sig) => sig.severity !== 'low')
  const anyActive = pair.signals.some((sig) => isActive(sig) && sig.severity !== 'low')
  const past = pastSignals(pair.signals)
  const notes = noteSignals(pair.signals)
  // Одна и та же цитата на экране один раз.
  const seen = new Set<string>()
  const quoteOf = (sig: Signal) => {
    const q = signalQuote(sig, pair.comments)
    if (!q || seen.has(q.text)) return null
    seen.add(q.text)
    return q
  }
  const openQuotes = open.map(quoteOf)
  const pastQuotes = past.map(quoteOf)

  return (
    <section className={s.block} aria-labelledby="talk-topics">
      <h2 id="talk-topics" className={s.blockTitle}>
        Сигналы
        {open.length > 0 && <span className={s.count}>{open.length}</span>}
      </h2>
      {open.length === 0 ? (
        <p className={s.none}>
          {anyActive ? 'Сейчас все поводы разобраны. Итог виден справа.' : 'Сейчас поводов для разговора нет.'}
        </p>
      ) : (
        <>
          <h3 className={s.subTitle}>Сейчас</h3>
          <ol className={s.topics}>
            {open.map((sig, i) => (
              <li key={sig.key}>
                <Topic signal={sig} quote={openQuotes[i] ?? null} onQuote={onQuote} />
              </li>
            ))}
          </ol>
        </>
      )}
      {past.length > 0 && (
        <>
          <h3 className={s.subTitle}>Было за программу</h3>
          <ol className={s.topics}>
            {past.map((sig, i) => (
              <li key={sig.key}>
                <Topic signal={sig} quote={pastQuotes[i] ?? null} onQuote={onQuote} recovered={recovery(sig, pair.cells)} />
              </li>
            ))}
          </ol>
        </>
      )}
      {notes.length > 0 && (
        <>
          <h3 className={s.subTitle}>Заметки из комментариев</h3>
          <ul className={s.noteList}>
            {notes.map((sig) => {
              const q = sig.quotes[0]
              return (
                <li key={sig.key}>
                  {sig.title}
                  <span className={s.when}> · {monthsLabel(sig)}</span>
                  {q && (
                    <>
                      {': '}
                      <button type="button" className={s.noteQuote} onClick={() => onQuote(q.month)}>
                        «{q.text}»
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function Topic({
  signal,
  quote,
  onQuote,
  recovered,
}: {
  signal: Signal
  quote: QuoteView | null
  onQuote: (month: number) => void
  /** Есть у прошлой ситуации: чем кончилось. undefined: ситуация текущая. */
  recovered?: ReturnType<typeof recovery>
}) {
  const textSignal = signal.type === 'text_vs_score'
  const past = recovered !== undefined
  const quoteMonth = signal.quotes[0]?.month ?? null
  const who = signal.role === 'mentor' ? 'наставника' : 'стажёра'
  return (
    <article className={s.topic} data-sev={signal.severity} data-past={past || undefined}>
      <h4 className={s.topicTitle}>
        {signal.title}
        <span className={s.when}> · {past ? monthsLabel(signal) : situationMonths(signal)}</span>
      </h4>
      {recovered && (
        <p className={s.recovered}>
          Выправилось к {recovered.month}-му месяцу: оценка {who} {formatNumber(recovered.from)} → {formatNumber(recovered.to)}
        </p>
      )}
      <p className={s.fact}>{past ? signal.explanation : explanationLine(signal)}</p>
      <Basis signal={signal} />
      {quote && (
        <figure className={s.quote}>
          {textSignal && (
            <p className={s.origin}>
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
      {!past && (
        <p className={s.action}>
          <span className={s.actionLabel}>Что сделать</span>
          {signal.action}
        </p>
      )}
      {afterReview(signal).map((line) => (
        <p key={line} className={s.after}>
          {line}
        </p>
      ))}
    </article>
  )
}

// Inline-стиль Tag системы перебивается только через style.
const TAG_STYLE = { height: 24, fontSize: 13, fontVariantNumeric: 'tabular-nums' } as const

// Основание вывода: откуда он (формула или разбор текста) и цифры, на которых стоит.
function Basis({ signal }: { signal: Signal }) {
  const tags = valueTags(signal)
  return (
    <div className={s.basis}>
      {signalSources(signal).map((src) => (
        <Badge key={src} tone="neutral">
          {src}
        </Badge>
      ))}
      {tags.map((v) => (
        <Tag key={v} style={TAG_STYLE}>
          {v}
        </Tag>
      ))}
    </div>
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
