// Эффект: графитовая лента с тремя числами и списком стажёров, у кого сигнал пришёл раньше средней оценки.

import { Link } from 'react-router-dom'

import type { Analytics } from '../../api/types'
import { formatNumber, monthIn, personName, plural } from '../../lib/format'
import s from './Effect.module.css'

// Минуты на анкету: наша оценка, не данные HR.
const MANUAL_MIN = 15
const TOOL_MIN = 3

export function Effect({ analytics: a }: { analytics: Analytics }) {
  const e = a.effect
  const baseline = formatNumber(e.baseline_score)
  const surveys = a.pairs * 2
  const saved = ((MANUAL_MIN - TOOL_MIN) * surveys) / 60
  const stats: { value: string; label: string }[] = []
  // Раньше средней не пришёл ни один сигнал: крупные числа ничего не говорят, оставляем список по стажёрам.
  const none = e.pairs_with_signals > 0 && e.earlier === 0
  if (!none && e.avg_lead != null) {
    stats.push({ value: `на ${formatNumber(e.avg_lead)} мес.`, label: `раньше, чем средняя оценка упадёт ниже ${baseline}: так в среднем приходит сигнал` })
  }
  if (!none && e.pairs_with_signals > 0) {
    stats.push({ value: `${e.earlier} из ${e.pairs_with_signals}`, label: `${plural(e.pairs_with_signals, ['стажёр', 'стажёра', 'стажёров'])}: сигнал пришёл раньше средней оценки` })
  }
  if (!none && e.invisible > 0) {
    stats.push({ value: String(e.invisible), label: `${plural(e.invisible, ['стажёр', 'стажёра', 'стажёров'])}: по средней оценке проблему не видно совсем` })
  }

  return (
    <section className={s.hero} aria-labelledby="effect-title">
      <span className={s.overline}>Эффект</span>
      <h2 id="effect-title" className={s.title}>
        {none ? 'Что средняя оценка не показывает' : 'Сигнал приходит раньше средней оценки'}
      </h2>
      {e.conclusion && <p className={s.conclusion}>{e.conclusion}</p>}
      {none ? null : stats.length > 0 ? (
        <dl className={s.stats}>
          {stats.map((st) => (
            <div key={st.value} className={s.stat}>
              <dt className={s.value}>{st.value}</dt>
              <dd className={s.label}>{st.label}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className={s.label}>Сигналов пока не было</p>
      )}
      <p className={s.note}>
        Сравниваем с тем, как это видно без дашборда: HR смотрит среднюю за месяц и реагирует ниже {baseline}. Порог выбрали мы, его нужно уточнить у HR.
      </p>
      {a.early.length > 0 && (
        <ul className={s.early}>
          {a.early.map((x) => (
            <li key={x.pair_id}>
              <Link to={`/pairs/${x.pair_id}`}>{personName(x.intern_name, x.intern_id)}</Link>
              <span>{leadLine(x)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={s.note}>
        Разбор анкеты: {MANUAL_MIN} мин вручную, {TOOL_MIN} мин с дашбордом. Наша оценка, уточнить у HR. Это около {formatNumber(saved, 0)} ч в месяц при {surveys}{' '}
        {plural(surveys, ['анкете', 'анкетах', 'анкетах'])}.
      </p>
      <span className={s.trace} aria-hidden="true" />
    </section>
  )
}

function leadLine(e: Analytics['early'][number]): string {
  const signal = `сигнал ${monthIn(e.first_signal_month)}`
  if (e.baseline_month == null || e.lead_months == null) return `${signal}, по средней не видно`
  if (e.lead_months === 0) return `${signal}, одновременно со средней`
  const n = Math.abs(e.lead_months)
  const by = `на ${n} ${plural(n, ['месяц', 'месяца', 'месяцев'])} ${e.lead_months > 0 ? 'раньше' : 'позже'}`
  return `${signal}, средняя ниже порога ${e.baseline_month === 2 ? 'со' : 'с'} ${e.baseline_month}-го: ${by}`
}
