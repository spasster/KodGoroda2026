// Сбор анкет: кто заполнил анкету за какой месяц. Месяц, за который анкет в программе ещё нет, считаем текущим сбором:
// у тех, кто не заполнил, в строке кнопка «скопировать ссылку».

import clsx from 'clsx'
import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { Overview, Role } from '../../api/types'
import { formLink } from '../../lib/formLink'
import { ROLE_LABEL, personName, plural } from '../../lib/format'
import { api, HR_KEY_STORAGE } from '../../api/client'
import { dueMonths } from '../../lib/rules'
import s from './Collect.module.css'

export function Collect({ overview, months, fallback }: { overview: Overview | undefined; months: number[]; fallback: number | null }) {
  if (!overview) return <p className={s.muted}>Нет данных</p>
  const answered = (month: number) => overview.pairs.some((p) => p.cells.some((c) => c.month === month && (!c.missing.intern || !c.missing.mentor)))
  const current = months.find((m) => !answered(m)) ?? fallback
  const rows = [
    ...overview.pairs.map((p) => ({ role: 'intern' as Role, pairId: p.pair_id, id: p.intern_id, name: personName(p.intern_name, p.intern_id), cells: p.cells, due: dueMonths(p) })),
    ...overview.pairs.map((p) => ({ role: 'mentor' as Role, pairId: p.pair_id, id: p.mentor_id, name: personName(p.mentor_name, p.mentor_id), cells: p.cells, due: dueMonths(p) })),
  ]
  const has = (role: Role, cells: Overview['pairs'][number]['cells'], m: number) => {
    const c = cells.find((x) => x.month === m)
    return !!c && !c.missing[role]
  }
  // Итог за месяцы программы: каждая сторона пары заполняет одну анкету в месяц.
  const got = (role: Role) => rows.filter((r) => r.role === role).reduce((n, r) => n + months.filter((m) => has(role, r.cells, m)).length, 0)
  // Ждём анкету за каждый месяц, до которого пара дошла: новая пара не должна за месяцы остальных.
  const need = overview.pairs.reduce((n, p) => n + Math.min(dueMonths(p), months.length), 0)
  const interns = got('intern')
  const mentors = got('mentor')
  return (
    <>
      <p className={s.total}>
        Собрано {interns + mentors} из {need * 2} {plural(need * 2, ['анкеты', 'анкет', 'анкет'])}: стажёры {interns} из {need}, наставники {mentors} из {need}
      </p>
      <p className={s.legend}>
        <span>
          <Check className={s.yes} aria-hidden="true" size={16} strokeWidth={2.2} /> анкета есть
        </span>
        <span>
          <span className={s.no}>нет</span> нет анкеты
        </span>
      </p>
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
            const filled = (m: number) => has(r.role, r.cells, m)
            return (
              <tr key={`${r.role}-${r.id}`}>
                <th scope="row" className={s.who}>
                  {r.name} <span className={s.role}>{ROLE_LABEL[r.role]}</span>
                </th>
                {months.map((m) => (
                  <td key={m} className={clsx(s.month, m === current && s.current, !filled(m) && m <= r.due && s.missing)}>
                    {filled(m) ? (
                      <Check className={s.yes} role="img" aria-label="анкета есть" size={16} strokeWidth={2.2} />
                    ) : m > r.due ? null : (
                      <span className={s.no} title="Нет анкеты" aria-label="нет анкеты">
                        нет
                      </span>
                    )}
                  </td>
                ))}
                <td className={s.act}>
                  {((current != null && !filled(current)) || months.some((m) => m <= r.due && !filled(m))) && <CopyLink role={r.role} id={r.id} pairId={r.pairId} name={r.name} />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}

function CopyLink({ role, id, pairId, name }: { role: Role; id: string; pairId: string; name: string }) {
  const [done, setDone] = useState(false)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = async () => {
    // HR открыл раздел «Опросы» с ключом: выдаём личную ссылку на Google Форму с кодом приглашения.
    // Ключа нет или Google не настроен: ссылка на нашу форму.
    let url = formLink(role, id)
    const key = sessionStorage.getItem(HR_KEY_STORAGE)
    if (key) {
      try {
        url = (await api.googleFormLink(key, pairId, role)).url
      } catch {
        // остаёмся на ссылке нашей формы
      }
    }
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
