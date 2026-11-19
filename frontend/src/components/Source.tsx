// Откуда взялся вывод: метка «формула» или «ИИ по тексту» и строка происхождения
// под доказательствами. При analyzer=rules вместо модели пишем словарь.

import clsx from 'clsx'
import { SquareCheck } from 'lucide-react'

import { useAnalyzer } from '../api/queries'
import type { Signal, SignalType } from '../api/types'
import { isTextSignal } from '../lib/rules'
import s from './Marks.module.css'

export function SourceTag({ type, className }: { type: SignalType; className?: string }) {
  const analyzer = useAnalyzer()
  if (!isTextSignal(type)) {
    return (
      <span className={clsx(s.tag, className)} title="Посчитано формулой, без модели">
        формула
      </span>
    )
  }
  return (
    <span className={clsx(s.tag, s['tag-text'], className)} title="Сигнал держится на разборе комментария">
      {analyzer === 'model' ? 'ИИ по тексту' : 'разбор текста'}
    </span>
  )
}

const BY_TYPE: Record<SignalType, string> = {
  gap_intern_low: 'Оценки и разрыв посчитаны формулой.',
  gap_mentor_low: 'Оценки и разрыв посчитаны формулой.',
  decline: 'Оценки посчитаны формулой.',
  text_vs_score: 'Оценка посчитана формулой.',
  silence: 'Посчитано формулой по анкетам и комментариям, без модели.',
}

// Текст строки происхождения: пригодится, если нужен без значка.
export function provenanceText(signal: Pick<Signal, 'type' | 'quotes'>, analyzer: 'model' | 'rules'): string {
  const quote = signal.quotes.length
    ? analyzer === 'model'
      ? 'Фрагмент выделила модель, сервис сверил его с анкетой дословно. '
      : 'Фрагмент нашёл словарь, сервис сверил его с анкетой дословно. '
    : ''
  return quote + BY_TYPE[signal.type]
}

export function Provenance({ signal, className }: { signal: Pick<Signal, 'type' | 'quotes'>; className?: string }) {
  const analyzer = useAnalyzer()
  return (
    <p className={clsx(s.prov, className)}>
      <SquareCheck aria-hidden="true" strokeWidth={1.6} />
      <span>{provenanceText(signal, analyzer)}</span>
    </p>
  )
}
