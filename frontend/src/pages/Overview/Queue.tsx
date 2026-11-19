// «С кем поговорить» на обзоре: одна строка на пару, а не на сигнал. Главный
// открытый сигнал, одна цитата на пару и ссылка в карточку.

import { Link } from 'react-router-dom'

import { usePair } from '../../api/queries'
import type { PairStatus, PairSummary, Signal } from '../../api/types'
import { EmptyState, PairChip, Quote, SectionHead, SeverityLabel, SourceTag } from '../../components'
import { formatCount, monthOrdinal, ROLE_TITLE, WORDS } from '../../lib/format'
import s from './Lower.module.css'

export interface QueueItem {
  pair: PairSummary
  status: PairStatus
  // Открытые сигналы пары, отсортированы по compareSignals.
  open: Signal[]
}

export function Queue({ items, collect }: { items: QueueItem[]; collect: number | null }) {
  return (
    <section aria-labelledby="queue-h">
      <SectionHead id="queue-h" title="С кем поговорить" note="Сначала пары с сигналами высокой важности. Решение за вами." />
      {items.length === 0 ? (
        <EmptyState
          className={s.queueEmpty}
          title="Сегодня говорить не с кем"
          text={`Открытых сигналов нет. Новые появятся, когда придут анкеты${collect ? ` за ${collect}-й месяц` : ''}.`}
        />
      ) : (
        items.map((item) => <QueueGroup key={item.pair.pair_id} {...item} />)
      )}
    </section>
  )
}

function QueueGroup({ pair, status, open }: QueueItem) {
  const main = open[0]
  const high = open.filter((x) => x.severity === 'high').length
  // Цитата только из главного сигнала: под его заголовком она читается как его
  // доказательство. Нет цитаты у главного, нет и блока.
  const q = main.quotes[0]
  // Цитату показываем предложением целиком: оно лежит в комментарии из карточки пары.
  const detail = usePair(q ? pair.pair_id : undefined)
  const comment = q && detail.data?.comments.find((c) => c.role === q.role && c.month === q.month && c.question_id === q.question_id)
  const whole = comment && comment.text.slice(q.start, q.end) === q.text ? comment.text : null
  const rest = open.length - 1

  return (
    <article className={s.group}>
      <div className={s.who}>
        <PairChip pairId={pair.pair_id} status={status} />
        <span>
          {pair.intern_id} и {pair.mentor_id}
        </span>
        <span>
          {formatCount(open.length, WORDS.signal)}
          {high > 0 && (
            <>
              {' '}
              <br />
              из них {high} высокой важности
            </>
          )}
        </span>
      </div>
      <div className={s.body}>
        <div className={s.meta}>
          <SeverityLabel severity={main.severity} />
          <SourceTag type={main.type} />
          <span>{monthOrdinal(main.month)}</span>
        </div>
        <h3 className={s.title}>{main.title}</h3>
        <p className={s.expl}>{main.explanation}</p>
        {q && (
          <Quote
            className={s.quote}
            text={whole ?? q.text}
            marks={whole ? [{ start: q.start, end: q.end }] : [{ start: 0, end: q.text.length }]}
            sentence={whole != null}
            role={q.role}
            caption={`${ROLE_TITLE[q.role]} ${q.role === 'intern' ? pair.intern_id : pair.mentor_id}, ${monthOrdinal(q.month)}`}
            verified
          />
        )}
        <div className={s.links}>
          <Link className="link" to={`/pairs/${pair.pair_id}`}>
            Открыть пару
          </Link>
          {rest > 0 && <span className="muted">ещё {formatCount(rest, WORDS.signal)} в карточке</span>}
        </div>
      </div>
    </article>
  )
}
