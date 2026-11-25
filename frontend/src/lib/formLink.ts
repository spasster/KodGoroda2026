// Личная ссылка на анкету: открывает форму сразу на вопросах нужного человека.
// Один источник для «Сбора анкет», QR и уведомлений.

import type { Role } from '../api/types'

export function formLink(role: Role, personId: string, origin: string = location.origin): string {
  return `${origin}/form?role=${role}&id=${encodeURIComponent(personId)}`
}
