// Сбор анкет: кто заполнил анкету за какой месяц. Месяц, за который анкет в программе ещё нет, считаем текущим сбором:
// у тех, кто не заполнил, в строке кнопка «скопировать ссылку».

import clsx from 'clsx'
import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { Overview, Role } from '../../api/types'
import { formLink } from '../../lib/formLink'
import { ROLE_LABEL, personName } from '../../lib/format'
import s from './Collect.module.css'

export function Collect({ overview, months, fallback }: { overview: Overview | undefined; months: number[]; fallback: number | null }) {
  if (!overview) return <p className={s.muted}>Нет данных</p>
  const answered = (month: number) => overview.pairs.some((p) => p.cells.some((c) => c.month === month && (!c.missing.intern || !c.missing.mentor)))
  const current = months.find((m) => !answered(m)) ?? fallback
  const rows = [
    ...overview.pairs.map((p) => ({ role: 'intern' as Role, id: p.intern_id, name: personName(p.intern_name, p.intern_id), cells: p.cells })),
    ...overview.pairs.map((p) => ({ role: 'mentor' as Role, id: p.mentor_id, name: personName(p.mentor_name, p.mentor_id), cells: p.cells })),
  ]
  return (
    <div className={s.scroll}>
      <table className={s.matrix}>
        <thead>
          <tr>
            <th scope="col" className={s.who}>
              Кто
            </th>
            {months.map((m) => (
              <th key={m} scope="col" className={clsx(s.month, m === current && s.current)}>
                {m}
              </th>
            ))}
            <th scope="col" className={s.act}>
              <span className="sr-only">Ссылка на анкету</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const has = (m: number) => {
              const c = r.cells.find((x) => x.month === m)
              return !!c && !c.missing[r.role]
            }
            return (
              <tr key={`${r.role}-${r.id}`}>
                <th scope="row" className={s.who}>
                  {r.name} <span className={s.role}>{ROLE_LABEL[r.role]}</span>
                </th>
                {months.map((m) => (
                  <td key={m} className={clsx(s.month, m === current && s.current)}>
                    <i className={has(m) ? s.full : s.ring} role="img" aria-label={has(m) ? 'заполнил' : 'не заполнил'} />
                  </td>
                ))}
                <td className={s.act}>{current != null && !has(current) && <CopyLink role={r.role} id={r.id} name={r.name} />}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CopyLink({ role, id, name }: { role: Role; id: string; name: string }) {
  const [done, setDone] = useState(false)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const url = formLink(role, id)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setDone(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setDone(false), 1500)
    } catch {
      window.prompt('Ссылка на анкету', url)
    }
  }
  const label = done ? 'Ссылка скопирована' : `Скопировать ссылку для ${name}`
  return (
    <button type="button" className={s.copy} aria-label={`Скопировать ссылку для ${name}`} title={label} onClick={() => void copy()}>
      {done ? <Check aria-hidden="true" size={16} strokeWidth={2} /> : <Copy aria-hidden="true" size={16} strokeWidth={1.8} />}
    </button>
  )
}
