// Цитата из комментария: черта слева, текст 20px в ёлочках, подчёркнутые места,
// на которые опирается сигнал, и подпись «● Стажёр S-04, 5-й месяц».

import clsx from 'clsx'
import type { ReactNode } from 'react'

import type { Role } from '../api/types'
import { sentenceAround } from '../lib/rules'
import s from './Evidence.module.css'
import { RoleMark } from './Role'

export interface MarkRange {
  start: number
  end: number
}

// Текст с подчёркнутыми фрагментами. Позиции по исходному тексту, как в API
// (Quote.start/end, CommentItem.highlights). Пересечения склеиваются.
export function MarkedText({ text, marks = [] }: { text: string; marks?: readonly MarkRange[] }) {
  const ranges = [...marks]
    .filter((m) => m.end > m.start)
    .sort((a, b) => a.start - b.start)
    .reduce<MarkRange[]>((acc, m) => {
      const prev = acc[acc.length - 1]
      if (prev && m.start <= prev.end) prev.end = Math.max(prev.end, m.end)
      else acc.push({ start: Math.max(0, m.start), end: Math.min(text.length, m.end) })
      return acc
    }, [])
  const parts: ReactNode[] = []
  let i = 0
  ranges.forEach((r, k) => {
    if (r.start > i) parts.push(text.slice(i, r.start))
    parts.push(<mark key={k}>{text.slice(r.start, r.end)}</mark>)
    i = r.end
  })
  if (i < text.length) parts.push(text.slice(i))
  return <>{parts}</>
}

export interface QuoteProps {
  // Комментарий целиком. Пустая строка: «Комментарий пустой».
  text: string
  marks?: readonly MarkRange[]
  // Знак роли в подписи.
  role?: Role
  // Подпись без знака: «Стажёр S-04, 5-й месяц».
  caption?: ReactNode
  // Дописать в подпись «Сверено с анкетой дословно.» (очередь на обзоре).
  verified?: boolean
  // Показать только предложение с первым подчёркнутым местом (очередь на обзоре).
  sentence?: boolean
  // Черта --text-2 вместо чернил: реплика второй стороны рядом с главной.
  secondary?: boolean
  className?: string
}

export function Quote({ text, marks = [], role, caption, verified, sentence, secondary, className }: QuoteProps) {
  let shown = text
  let shownMarks = marks
  if (sentence && marks.length > 0) {
    const cut = sentenceAround(text, marks[0].start, marks[0].end)
    shown = cut.text
    shownMarks = [{ start: cut.start, end: cut.end }]
  }
  const hasCaption = caption != null || verified
  return (
    <figure className={clsx(s.quote, secondary && s.secondary, className)}>
      <blockquote className={s['quote-text']}>
        {shown.trim() ? (
          <>
            «<MarkedText text={shown} marks={shownMarks} />»
          </>
        ) : (
          <span className={s['quote-empty']}>Комментарий пустой</span>
        )}
      </blockquote>
      {hasCaption && (
        <figcaption className={s.caption}>
          {role && <RoleMark role={role} />}
          <span>
            {caption}
            {caption != null && verified ? '. ' : ''}
            {verified ? 'Сверено с анкетой дословно.' : ''}
          </span>
        </figcaption>
      )}
    </figure>
  )
}
