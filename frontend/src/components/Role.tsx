// Стажёр и наставник различаются формой: круг и квадрат. Цвет берут от текста.

import clsx from 'clsx'

import type { Role } from '../api/types'
import { ROLE_TITLE } from '../lib/format'
import s from './Marks.module.css'

// size 8: в таблице и подписях; 12: на графике и в легенде графика.
export function RoleMark({ role, size = 8, className }: { role: Role; size?: 8 | 12; className?: string }) {
  return <i aria-hidden="true" className={clsx(s.mk, s[`mk-${role}`], s[`mk-${size}`], className)} />
}

// «● Стажёр S-03», «■ Наставник M-03». Без id: «● Стажёр».
export function RoleLabel({ role, id, className }: { role: Role; id?: string; className?: string }) {
  return (
    <span className={clsx(s.role, className)}>
      <RoleMark role={role} />
      {id ? `${ROLE_TITLE[role]} ${id}` : ROLE_TITLE[role]}
    </span>
  )
}

// «● S-03 ■ M-03» рядом с ID пары, 14px --text-2.
export function PairPeople({ internId, mentorId, className }: { internId: string; mentorId: string; className?: string }) {
  return (
    <span className={clsx(s.people, className)}>
      <span>
        <RoleMark role="intern" />
        <span className="sr-only">стажёр </span>
        {internId}
      </span>
      <span>
        <RoleMark role="mentor" />
        <span className="sr-only">наставник </span>
        {mentorId}
      </span>
    </span>
  )
}
