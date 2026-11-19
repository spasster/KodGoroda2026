// Переключатель роли для демо: HR, стажёр или наставник. Входа по паролю нет,
// это показ того, что увидит каждый участник программы.

import { UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { usePeople } from '../api/queries'
import { personName } from '../lib/format'
import s from './AppShell.module.css'

export function RoleSwitch() {
  const people = usePeople()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const m = /^\/me\/(intern|mentor)\/([^/]+)/.exec(pathname)
  const value = m ? `${m[1]}:${decodeURIComponent(m[2]).toUpperCase()}` : 'hr'

  return (
    <label className={s.role}>
      <UserRound size={16} aria-hidden="true" />
      <span className="sr-only">Чей кабинет показать</span>
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value
          if (v === 'hr') navigate('/')
          else {
            const [role, id] = v.split(':')
            navigate(`/me/${role}/${encodeURIComponent(id)}`)
          }
        }}
      >
        <option value="hr">HR-менеджер</option>
        <optgroup label="Стажёр">
          {(people.data?.interns ?? []).map((p) => (
            <option key={p.id} value={`intern:${p.id}`}>
              {personName(p.name, p.id)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Наставник">
          {(people.data?.mentors ?? []).map((p) => (
            <option key={p.id} value={`mentor:${p.id}`}>
              {personName(p.name, p.id)}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  )
}
