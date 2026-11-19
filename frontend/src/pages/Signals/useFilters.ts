// Фильтры экрана в адресной строке. Роутер применяет новый адрес в переходе
// (startTransition), поэтому, если читать фильтры только из адреса, флажок на кадр
// откатывается, а два быстрых нажатия читают один и тот же старый адрес и второе
// затирает первое. Держим фильтры у себя и пишем их в адрес. Адрес, который
// пришёл не от нас (назад, вперёд, пункт меню), побеждает.

import { useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { readFilters, writeFilters, type Filters } from './model'

export function useFilters(): [Filters, (patch: Partial<Filters>) => void] {
  const [params, setParams] = useSearchParams()
  const url = params.toString()
  const [state, setState] = useState(() => ({ url, filters: readFilters(params) }))
  const written = useRef<string[]>([])

  let filters = state.filters
  if (state.url !== url) {
    const mine = written.current.indexOf(url)
    if (mine >= 0) written.current.splice(0, mine + 1)
    else filters = readFilters(params)
    setState({ url, filters })
  }

  const latest = useRef(filters)
  latest.current = filters

  const update = useCallback(
    (patch: Partial<Filters>) => {
      const next = { ...latest.current, ...patch }
      latest.current = next
      const nextUrl = writeFilters(next).toString()
      written.current.push(nextUrl)
      setState((s) => ({ ...s, filters: next }))
      setParams(nextUrl, { replace: true, preventScrollReset: true })
    },
    [setParams],
  )

  return [filters, update]
}
