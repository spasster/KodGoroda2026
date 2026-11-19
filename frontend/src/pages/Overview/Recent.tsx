// «Последние анкеты»: живые анкеты по одной, импорт из Excel одной строкой.
// Пока за месяц сбора анкет нет, сверху ссылка на форму.

import { Check, FileText } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'

import type { RecentItem } from '../../api/types'
import { Button, RoleMark, SectionHead } from '../../components'
import { formatCount, formatRelative, ROLE_TITLE, sourceLabel, WORDS } from '../../lib/format'
import type { ExcelLine } from './model'
import s from './Lower.module.css'

export interface RecentProps {
  live: RecentItem[]
  excel: ExcelLine | null
  // Месяц сбора и есть ли за него анкеты.
  collect: number | null
  collectEmpty: boolean
  isFresh: (item: RecentItem) => boolean
}

export function Recent({ live, excel, collect, collectEmpty, isFresh }: RecentProps) {
  // «только что» через минуту превращается в «1 минуту назад».
  const [, tick] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const t = window.setInterval(tick, 30_000)
    return () => window.clearInterval(t)
  }, [])

  return (
    <section aria-labelledby="recent-h">
      <SectionHead id="recent-h" title="Последние анкеты" />
      {collect != null && collectEmpty && <FormInvite month={collect} />}
      {(live.length > 0 || excel) && (
        <ul className={s.recent}>
          {live.map((r) => (
            <li key={`${r.pair_id}:${r.role}:${r.month}:${r.at}`}>
              <span className={s.rMark}>
                <RoleMark role={r.role} />
              </span>
              <span className={s.rWho}>
                {ROLE_TITLE[r.role]} {r.person_id}
                {isFresh(r) && <span className={s.rNew}>новое</span>}
              </span>
              <time className={s.rWhen} dateTime={r.at}>
                {formatRelative(r.at)}
              </time>
              <span className={s.rWhat}>
                анкета за {r.month}-й месяц, {sourceLabel(r.source)}
              </span>
            </li>
          ))}
          {excel && (
            <li>
              <span className={s.rFile}>
                <FileText aria-hidden="true" strokeWidth={1.5} />
              </span>
              <span className={s.rWho}>{formatCount(excel.count, WORDS.response)} из Excel</span>
              <time className={s.rWhen} dateTime={excel.lastAt}>
                {formatRelative(excel.lastAt)}
              </time>
              <span className={s.rWhat}>
                история за {excel.from === excel.to ? `${excel.to}-й месяц` : `${excel.from}–${excel.to}-й месяцы`}
              </span>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

function FormInvite({ month }: { month: number }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL('/form', window.location.origin).href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className={s.invite}>
      <p>За {month}-й месяц анкет пока нет. Форма открыта для стажёров и наставников.</p>
      <Button onClick={copy} aria-live="polite">
        {copied ? (
          <>
            <Check aria-hidden="true" />
            Ссылка скопирована
          </>
        ) : (
          'Скопировать ссылку на форму'
        )}
      </Button>
    </div>
  )
}
