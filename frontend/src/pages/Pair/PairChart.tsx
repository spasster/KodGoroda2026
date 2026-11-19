// График карточки пары: средняя оценка стажёра и наставника по месяцам, полоса
// разрыва, месяц сбора, статусы месяцев под осью и подсказка по месяцу.
// Собран на SVG по ширине контейнера, а не через viewBox: так подписи остаются
// 14px на любой ширине. Описание: system.md, «Две линии в карточке пары».
//
// Движение: при открытии линии рисуются от первого месяца, точки проявляются по
// месяцам, потом полоса разрыва и подписи концов. Пришла анкета при открытом
// графике: новый участок открывается слева направо от прошлой последней точки,
// остальное стоит на месте.

import { AnimatePresence, motion } from 'motion/react'
import { useId, useLayoutEffect, useRef, useState } from 'react'

import type { Cell, PairDetail, Role } from '../../api/types'
import { RoleMark } from '../../components'
import { formatNumber, PAIR_STATUS_LABEL } from '../../lib/format'
import { arrival, dur, ease, stagger, useReduced, variants } from '../../lib/motion'
import type { Scale } from '../../lib/rules'
import { hasData, indexOf } from './model'
import s from './PairChart.module.css'

const H = 330
const T = 16
const B = 70
const L = 58

export interface PairChartProps {
  pair: PairDetail
  months: number
  scale: Scale
  // Месяц сбора: колонка «ждём анкеты», пока у пары нет за него анкет.
  collect: number | null
  // «октябрь» для подсказки, если известен календарь программы.
  monthName: (month: number) => string | null
}

export function PairChart(props: PairChartProps) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={box} className={s.box} style={{ height: H }}>
      {width > 0 && <Plot {...props} width={width} />}
    </div>
  )
}

interface Pt {
  m: number
  v: number
}

function points(cells: readonly Cell[], role: Role): Pt[] {
  return cells
    .filter((c) => indexOf(c, role) != null)
    .map((c) => ({ m: c.month, v: indexOf(c, role) as number }))
    .sort((a, b) => a.m - b.m)
}

function Plot({ pair, months, scale, collect, monthName, width: W }: PairChartProps & { width: number }) {
  const reduce = useReduced()
  const clipId = `clip-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  // Геометрия. Справа место под подписи концов «4,8 наставник».
  const R = W < 560 ? 124 : 150
  const span = Math.max(1, months - 1)
  const colW = (W - L - R) / span
  const xs = (m: number) => (months > 1 ? L + (m - 1) * colW : L + (W - L - R) / 2)
  const range = scale.max - scale.min || 1
  const ys = (v: number) => T + ((scale.max - v) / range) * (H - T - B)
  const base = H - B
  const right = xs(months) + 24

  const cells = [...pair.cells].sort((a, b) => a.month - b.month)
  const cellOf = (m: number) => cells.find((c) => c.month === m)
  const I = points(cells, 'intern')
  const M = points(cells, 'mentor')
  const path = (list: Pt[]) => list.map((p, i) => `${i ? 'L' : 'M'}${xs(p.m).toFixed(1)},${ys(p.v).toFixed(1)}`).join('')

  // Полоса разрыва по непрерывным участкам, где ответили обе стороны.
  const bands: { key: string; d: string }[] = []
  let run: Cell[] = []
  const flush = () => {
    if (run.length > 1) {
      const top = run.map((c, i) => `${i ? 'L' : 'M'}${xs(c.month).toFixed(1)},${ys(c.mentor_index as number).toFixed(1)}`)
      const bottom = [...run].reverse().map((c) => `L${xs(c.month).toFixed(1)},${ys(c.intern_index as number).toFixed(1)}`)
      bands.push({ key: `${run[0].month}-${run[run.length - 1].month}`, d: `${top.join('')}${bottom.join('')}Z` })
    }
    run = []
  }
  for (let m = 1; m <= months; m++) {
    const c = cellOf(m)
    if (c && c.intern_index != null && c.mentor_index != null) run.push(c)
    else flush()
  }
  flush()

  // Подписи концов: значение первым. Ближе 22px по высоте, нижняя уходит вниз.
  const li = I[I.length - 1]
  const lm = M[M.length - 1]
  let yi = li ? ys(li.v) + 5 : 0
  let ym = lm ? ys(lm.v) + 5 : 0
  if (li && lm && Math.abs(yi - ym) < 22) {
    if (li.v <= lm.v) yi = Math.max(yi, ym + 22)
    else ym = Math.max(ym, yi + 22)
  }

  const collectEmpty = collect != null && collect <= months && !(cellOf(collect) && hasData(cellOf(collect)!))
  const collectX = collect != null ? xs(collect) - colW / 2 : 0
  // Подложка кончается вместе с сеткой. Если «ждём анкеты» не влезает, пишем «ждём».
  const collectW = collect === months ? right - collectX : colW
  const collectRect = { x: collectX, w: collectW, label: collectW >= 108 ? 'ждём анкеты' : 'ждём' }

  // Первый показ рисует линии; дальше новые участки открываются шторкой.
  const first = useRef(true)
  const maxMonth = Math.max(0, ...cells.filter(hasData).map((c) => c.month))
  const prevMax = useRef(maxMonth)
  const [reveal, setReveal] = useState<{ from: number; id: number } | null>(null)
  useLayoutEffect(() => {
    first.current = false
  })
  useLayoutEffect(() => {
    if (maxMonth > prevMax.current && prevMax.current > 0 && !reduce) setReveal({ from: prevMax.current, id: Date.now() })
    prevMax.current = maxMonth
  }, [maxMonth, reduce])

  // Изменились сами оценки (пришла анкета), а не только статусы после отметки HR:
  // тогда новые знаки статуса ждут шторку, как клетка на обзоре.
  const signature = cells.map((c) => `${c.month}:${c.intern_index}:${c.mentor_index}`).join('|')
  const prevSignature = useRef(signature)
  const dataChanged = prevSignature.current !== signature
  useLayoutEffect(() => {
    prevSignature.current = signature
  }, [signature])

  const draw = first.current && !reduce
  // Подсказка: фокус с клавиатуры главнее мыши. Справа от месяца подпись конца
  // или край графика, значит подсказка встаёт слева, чтобы не закрыть цифры.
  const [hovered, setHovered] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const hover = focused ?? hovered
  const hoverX = hover != null ? xs(hover) : 0
  const TIP_W = 230
  const labelsFrom = Math.min(li ? xs(li.m) : Infinity, lm ? xs(lm.m) : Infinity) + 8
  const rightFits = hoverX + 16 + TIP_W <= Math.min(W, labelsFrom) || hoverX - 16 - TIP_W < 0
  const tipLeft = rightFits ? hoverX + 16 : hoverX - 16 - TIP_W

  const zoneLabel = (m: number) => {
    const c = cellOf(m)
    if (!c || !hasData(c)) return `${m}-й месяц: ${m === collect ? 'ждём анкеты' : 'анкет нет'}`
    const part = (role: Role, word: string) => `${word} ${indexOf(c, role) != null ? formatNumber(indexOf(c, role)) : 'нет анкеты'}`
    const gap = c.gap != null ? `, разрыв ${formatNumber(Math.abs(c.gap))}` : ''
    return `${m}-й месяц: ${part('intern', 'стажёр')}, ${part('mentor', 'наставник')}${gap}. ${PAIR_STATUS_LABEL[c.status]}.`
  }

  const monthsList = Array.from({ length: months }, (_, i) => i + 1)
  const ticks = Array.from({ length: Math.floor(range) + 1 }, (_, i) => scale.min + i)

  return (
    <>
      <svg
        className={s.svg}
        width={W}
        height={H}
        role="group"
        aria-label="Средняя оценка стажёра и наставника по месяцам"
      >
        {reveal && (
          <defs>
            <clipPath id={clipId}>
              <motion.rect
                key={reveal.id}
                x={-24}
                y={-24}
                height={H + 48}
                initial={{ width: xs(reveal.from) + 9 + 24 }}
                animate={{ width: W + 48 }}
                transition={{ duration: 0.7, ease: ease.inOut, delay: arrival.cellAppear }}
                onAnimationComplete={() => setReveal(null)}
              />
            </clipPath>
          </defs>
        )}

        <AnimatePresence>
          {collectEmpty && (
            <motion.g key="collect" initial={false} exit={{ opacity: 0, transition: { duration: dur.m } }}>
              <rect className={s.collect} x={collectRect.x} y={T} width={collectRect.w} height={base - T} rx={4} />
              <text className={s.collectText} x={collectRect.x + 10} y={base - 12}>
                {collectRect.label}
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {ticks.map((v) => (
          <g key={v}>
            <line className={v === scale.min ? s.axis : s.grid} x1={L} x2={right} y1={ys(v)} y2={ys(v)} />
            <text className={s.ax} x={L - 14} y={ys(v) + 5} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <text className={s.ax} x={L - 14} y={base + 24} textAnchor="end">
          месяц
        </text>
        <text className={s.ax} x={L - 14} y={base + 51} textAnchor="end">
          статус
        </text>
        {monthsList.map((m) => (
          <text key={m} className={s.ax} x={xs(m)} y={base + 24} textAnchor="middle">
            {m}
          </text>
        ))}
        {monthsList.map((m) => {
          const c = cellOf(m)
          const kind = c && hasData(c) ? c.status : m === collect ? 'collect' : null
          if (!kind) return null
          const born = !first.current && !reduce
          return (
            <motion.g
              key={`${m}:${kind}`}
              initial={born ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: dur.l, ease: ease.out, delay: dataChanged ? arrival.cellFill : 0 }}
            >
              <StatusMark kind={kind} x={xs(m)} y={base + 46} />
            </motion.g>
          )
        })}

        <line className={s.cross} x1={hoverX} x2={hoverX} y1={T} y2={base} style={{ opacity: hover != null ? 1 : 0 }} />

        <g clipPath={reveal ? `url(#${clipId})` : undefined}>
          {bands.map((b) => (
            <motion.path
              key={b.key}
              className={s.band}
              d={b.d}
              initial={draw ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.52, ease: ease.out, delay: 0.7 }}
            />
          ))}
          {M.length > 0 && (
            <motion.path
              className={s.lineMentor}
              d={path(M)}
              initial={draw ? { pathLength: 0 } : false}
              animate={{ pathLength: 1 }}
              transition={{ duration: dur.xl, ease: ease.inOut, delay: 0.08 }}
            />
          )}
          {I.length > 0 && (
            <motion.path
              className={s.lineIntern}
              d={path(I)}
              initial={draw ? { pathLength: 0 } : false}
              animate={{ pathLength: 1 }}
              transition={{ duration: dur.xl, ease: ease.inOut }}
            />
          )}
          {M.map((p, k) => (
            <motion.rect
              key={`m${p.m}`}
              className={s.dotMentor}
              x={xs(p.m) - 5.5}
              y={ys(p.v) - 5.5}
              width={11}
              height={11}
              rx={1.5}
              initial={draw ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: dur.s, ease: ease.out, delay: stagger.chartPoint(k) }}
            />
          ))}
          {I.map((p, k) => (
            <motion.circle
              key={`i${p.m}`}
              className={s.dotIntern}
              cx={xs(p.m)}
              cy={ys(p.v)}
              r={6}
              initial={draw ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: dur.s, ease: ease.out, delay: stagger.chartPoint(k) }}
            />
          ))}
        </g>

        {[
          lm && { role: 'mentor' as const, p: lm, y: ym, word: 'наставник' },
          li && { role: 'intern' as const, p: li, y: yi, word: 'стажёр' },
        ].map(
          (e) =>
            e && (
              <motion.text
                key={`${e.role}:${e.p.m}:${e.p.v}`}
                className={s.endLabel}
                x={xs(e.p.m) + 14}
                y={e.y}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: dur.m, ease: ease.out, delay: draw ? 0.95 : 0.9 }}
              >
                <tspan className={s.endValue}>{formatNumber(e.p.v)}</tspan>
                <tspan className={s.endWord}> {e.word}</tspan>
              </motion.text>
            ),
        )}

        {monthsList.map((m) => (
          <rect
            key={m}
            className={s.zone}
            x={xs(m) - colW / 2}
            y={T}
            width={colW}
            height={H - T - 8}
            rx={6}
            tabIndex={0}
            role="img"
            aria-label={zoneLabel(m)}
            onMouseEnter={() => setHovered(m)}
            onMouseLeave={() => setHovered((h) => (h === m ? null : h))}
            onFocus={() => setFocused(m)}
            onBlur={() => setFocused((h) => (h === m ? null : h))}
          />
        ))}
      </svg>

      <AnimatePresence>
        {hover != null && (
          <motion.div
            key="tip"
            className={s.tip}
            style={{ left: tipLeft, width: TIP_W }}
            variants={variants.tip}
            initial="hidden"
            animate="shown"
            exit="gone"
            aria-hidden="true"
          >
            <Tip month={hover} cell={cellOf(hover)} name={monthName(hover)} collect={collect} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function StatusMark({ kind, x, y }: { kind: Cell['status'] | 'collect'; x: number; y: number }) {
  if (kind === 'risk') return <rect x={x - 6} y={y - 6} width={12} height={12} rx={2} fill="var(--ink)" />
  if (kind === 'watch')
    return <rect x={x - 5} y={y - 5} width={10} height={10} rx={1.5} fill="none" stroke="var(--ink)" strokeWidth={2} />
  if (kind === 'ok') return <rect x={x - 6} y={y - 1.5} width={12} height={3} fill="var(--text-2)" />
  return <circle cx={x} cy={y} r={4} fill="none" stroke="var(--text-3)" strokeWidth={2} />
}

function Tip({ month, cell, name, collect }: { month: number; cell: Cell | undefined; name: string | null; collect: number | null }) {
  const title = `${month}-й месяц${name ? `, ${name}` : ''}`
  if (!cell || !hasData(cell)) {
    return (
      <>
        <b>{title}</b>
        <div className={s.tipRow}>
          <span>{month === collect ? 'Ждём анкеты' : 'Анкет нет'}</span>
        </div>
      </>
    )
  }
  const value = (role: Role) => {
    const v = indexOf(cell, role)
    return v != null ? formatNumber(v) : 'нет анкеты'
  }
  return (
    <>
      <b>{title}</b>
      <div className={s.tipRow}>
        <span>
          <RoleMark role="intern" />
          Стажёр
        </span>
        <strong>{value('intern')}</strong>
      </div>
      <div className={s.tipRow}>
        <span>
          <RoleMark role="mentor" />
          Наставник
        </span>
        <strong>{value('mentor')}</strong>
      </div>
      {cell.gap != null && (
        <div className={s.tipRow}>
          <span>Разрыв</span>
          <strong>{formatNumber(Math.abs(cell.gap))}</strong>
        </div>
      )}
      <div className={s.tipRow}>
        <span>Статус</span>
        <strong>{PAIR_STATUS_LABEL[cell.status]}</strong>
      </div>
    </>
  )
}

// Легенда над графиком: цвет текста --text-2, а не цвет серии.
export function ChartLegend() {
  return (
    <span className={s.legend} aria-hidden="true">
      <span>
        <RoleMark role="intern" />
        стажёр
      </span>
      <span>
        <RoleMark role="mentor" />
        наставник
      </span>
      <span>
        <i className={s.legendGap} />
        разрыв
      </span>
    </span>
  )
}
