// Личный кабинет стажёра или наставника: свои ответы по месяцам и кнопка «Заполнить анкету».
// Ответы второй стороны пары сюда не приходят: бэкенд отдаёт только свои.

import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { useCabinet } from '../../api/queries'
import type { Role } from '../../api/types'
import { Hero, LoadError, Loading, Skeleton } from '../../components'
import { formatNumber, personName } from '../../lib/format'
import { StoryChart } from '../Overview/StoryChart'
import s from './Cabinet.module.css'

export function CabinetPage() {
  const params = useParams()
  const role: Role = params.role === 'mentor' ? 'mentor' : 'intern'
  const id = (params.id ?? '').trim().toUpperCase()
  const cabinet = useCabinet(role, id)
  const c = cabinet.data

  if (cabinet.isError && !c) {
    return (
      <div className="wrap">
        <LoadError query={cabinet} className={s.state} />
      </div>
    )
  }
  if (!c) {
    return (
      <div className="wrap">
        <Loading className={s.state}>
          <Skeleton height={260} radius="var(--r-card)" />
        </Loading>
      </div>
    )
  }

  const filled = c.history.filter((h) => h.filled)
  const partner = personName(c.partner_name, c.partner_id)
  const formUrl = `/form?role=${role}&id=${encodeURIComponent(c.id)}`

  return (
    <>
      <Hero
        top={role === 'intern' ? `Кабинет стажёра · наставник ${partner}` : `Кабинет наставника · стажёр ${partner}`}
        title={personName(c.name, c.id)}
        aside={
          c.next_month != null ? (
            <a href={formUrl} className={s.fill}>
              Заполнить анкету за {c.next_month}-й месяц
            </a>
          ) : (
            <span className={s.done}>
              <Check size={18} aria-hidden="true" />
              Все анкеты заполнены
            </span>
          )
        }
      />
      <div className={clsx('wrap', s.page)}>
        <section className={s.card}>
          <h2 className={s.title}>Стажировка</h2>
          <ol className={s.track}>
            {c.history.map((h) => (
              <li key={h.month} className={clsx(h.filled && s.on, h.month === c.next_month && s.now)}>
                <span>{h.filled ? <Check size={16} aria-hidden="true" /> : h.month}</span>
                {h.month}-й месяц
              </li>
            ))}
          </ol>
        </section>

        <section className={s.card}>
          <h2 className={s.title}>{role === 'intern' ? 'Мои оценки стажировки' : 'Мои оценки стажёра'}</h2>
          {filled.length > 0 ? (
            <StoryChart
              cells={c.history.map((h) => ({
                month: h.month,
                intern_index: role === 'intern' ? h.index : null,
                mentor_index: role === 'mentor' ? h.index : null,
              }))}
              months={c.history.map((h) => h.month)}
              scale={c.scale}
              status="ok"
            />
          ) : (
            <p className={s.muted}>Анкет пока нет</p>
          )}
        </section>

        <section className={clsx(s.card, s.full)}>
          <h2 className={s.title}>Мои анкеты</h2>
          {filled.length === 0 && <p className={s.muted}>Здесь появятся ваши ответы</p>}
          <ul className={s.history}>
            {[...filled].reverse().map((h) => (
              <li key={h.month}>
                <div className={s.month}>
                  {h.month}-й месяц<b>{formatNumber(h.index)}</b>
                </div>
                <div>
                  <ul className={s.answers}>
                    {c.questions.map((q) => (
                      <li key={q.id}>
                        <span>{q.text}</span>
                        <b>{h.answers[q.id] == null ? '—' : formatNumber(h.answers[q.id], 0)}</b>
                      </li>
                    ))}
                  </ul>
                  {h.comment && <blockquote className={s.comment}>«{h.comment}»</blockquote>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
