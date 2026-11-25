import { describe, expect, it } from 'vitest'

import { formLink, parseFormToken } from './formLink'

describe('formLink', () => {
  it('без токена открывает выбор человека по ID', () => {
    expect(formLink('intern', 'S-03', undefined, 'https://x.ru')).toBe('https://x.ru/form?role=intern&id=S-03')
  })

  it('с токеном даёт личную ссылку, которую разбирает parseFormToken', () => {
    const url = new URL(formLink('mentor', 'M 1.2', 'ab-_9Zk', 'https://x.ru'))
    expect(parseFormToken(url.searchParams.get('t'))).toEqual({ role: 'mentor', id: 'M 1.2', token: 'ab-_9Zk' })
  })

  it('мусор вместо токена не разбирается', () => {
    for (const bad of [null, '', 'intern', 'intern.S-01', 'boss.S-01.abc', 'intern..abc']) expect(parseFormToken(bad)).toBeNull()
  })
})
