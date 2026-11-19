// Цепочка значений по месяцам: «разрыв по месяцам 0,4 › 1,0 › 1,8», последнее
// значение залито чернилами. Разрыв пишется по модулю, направление даёт слово.

import clsx from 'clsx'
import { Fragment } from 'react'

import { formatNumber } from '../lib/format'
import s from './Evidence.module.css'

export interface GapChainProps {
  values: (number | null)[]
  // Подпись перед цепочкой. null убирает её: в блоке разрыва карточки подпись своя.
  label?: string | null
  // По модулю: для разрыва да, для «оценка стажёра 4,4 › 3,8 › 3,0» нет.
  abs?: boolean
  className?: string
}

export function GapChain({ values, label = 'разрыв по месяцам', abs = true, className }: GapChainProps) {
  const shown = values.filter((v): v is number => v != null).map((v) => formatNumber(abs ? Math.abs(v) : v))
  if (shown.length === 0) return null
  return (
    <div className={clsx(s.chainline, className)}>
      {label && (
        <span className={s['chain-label']} aria-hidden="true">
          {label}
        </span>
      )}
      <span className={s.chain} aria-label={label ? `${label}: ${shown.join(', ')}` : shown.join(', ')} role="img">
        {shown.map((v, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <i className={s['chain-sep']} aria-hidden="true">
                ›
              </i>
            )}
            <b className={clsx(s['chain-v'], i === shown.length - 1 && s.last)}>{v}</b>
          </Fragment>
        ))}
      </span>
    </div>
  )
}
