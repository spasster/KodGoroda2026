// Ссылка на анкету. С токеном (people[].token) она личная: /form?t=<роль>.<ID>.<токен>,
// форма открывается сразу на вопросах и принимает ответы только от этого человека.
// Без токена старый вид /form?role=intern&id=S-01: форма сама спросит «Кто вы?».
// Один источник для «Сбора анкет», QR и уведомлений.

import type { Role } from '../api/types'

export function formLink(role: Role, personId: string, token?: string, origin: string = location.origin): string {
  if (token) return `${origin}/form?t=${role}.${encodeURIComponent(personId)}.${token}`
  return `${origin}/form?role=${role}&id=${encodeURIComponent(personId)}`
}

export interface FormToken {
  role: Role
  id: string
  token: string
}

// Токен base64url, точек в нём нет. ID может быть любым, поэтому роль берём слева, токен справа.
export function parseFormToken(raw: string | null): FormToken | null {
  const first = raw?.indexOf('.') ?? -1
  const last = raw?.lastIndexOf('.') ?? -1
  if (!raw || first < 1 || last <= first) return null
  const role = raw.slice(0, first)
  const id = raw.slice(first + 1, last)
  const token = raw.slice(last + 1)
  if ((role !== 'intern' && role !== 'mentor') || !id || !token) return null
  return { role, id, token }
}
