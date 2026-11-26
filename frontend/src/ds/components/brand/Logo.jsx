import React from 'react';

/**
 * MGTS Logo — МГТС wordmark lockup. Знак — квадрат из assets/logo.svg
 * (пути повторены инлайном, чтобы tone мог перекрашивать заливки).
 * variant: full (знак + «МГТС») | mark (только знак) | text (только текст)
 * tone: brand (синий квадрат) | mono (графит) | inverted (белый, на тёмном)
 */

/* Буквы «МГТС» из assets/logo.svg, viewBox 0 0 488.93 488.93. */
const GLYPHS = [
  'M55.09 373.77v77.93H37.68v-93.84h29.65L96 434.7l29-76.84h28.7v93.84h-18.9v-78.33l-29.66 78.33H84.6Z',
  'M243.58 357.86v15.51H188.5v78.33h-19v-93.84Z',
  'M253.51 373.37v-15.51h95.75v15.51H310.9v78.33h-19v-78.33Z',
  'M404.88 356.23c29.92 0 46.78 9 49.5 32.1h-19.17c-2.45-13.47-12.38-17.28-30.33-17.28-20 0-32.91 6.67-32.91 28.84v9.52c0 21.76 12.65 29.1 32.91 29.1 17.27 0 27.34-3.26 30.46-16.18h19.18c-3.4 22.16-20 31-49.64 31-33.19 0-52.09-12.64-52.09-48.41s18.9-48.69 52.09-48.69Z',
];

export function Logo({ variant = 'full', tone = 'brand', size = 28, style, ...rest }) {
  const markBg = tone === 'inverted' ? '#fff' : tone === 'mono' ? 'var(--color-text-primary)' : 'var(--color-brand)';
  const markFg = tone === 'inverted' ? 'var(--color-brand)' : '#fff';
  const textColor = tone === 'inverted' ? '#fff' : 'var(--color-text-primary)';
  const mark = (
    <svg width={size} height={size} viewBox="0 0 488.93 488.93" role="img" aria-label="МГТС"
      style={{ display: 'block', flexShrink: 0 }}>
      <path d="M0 0h488.93v488.93H0z" fill={markBg} />
      <g fill={markFg}>{GLYPHS.map((d, i) => <path key={i} d={d} />)}</g>
    </svg>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.36, ...style }} {...rest}>
      {variant !== 'text' && mark}
      {variant !== 'mark' && (
        <span style={{ fontFamily: 'var(--font-wide)', fontWeight: 700, fontSize: size * 0.64, color: textColor, letterSpacing: '0.01em' }}>МГТС</span>
      )}
    </span>
  );
}

export default Logo;
