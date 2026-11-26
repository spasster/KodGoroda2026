import React from "react";
import { Demo, Group, Label } from "../kit";
import { Logo } from "../../ds/components/brand/Logo";

const BRAND = [
  "--color-brand",
  "--color-brand-hover",
  "--color-brand-active",
  "--color-brand-subtle",
  "--mgts-blue-50",
  "--mgts-blue-100",
  "--mgts-blue-300",
  "--mgts-blue-500",
  "--mgts-blue-600",
  "--mgts-blue-700",
];

const SURFACES = [
  "--color-background-primary",
  "--color-background-secondary",
  "--color-background-lower",
  "--color-background-inverted",
  "--color-line",
  "--color-control-stroke",
  "--color-control-stroke-hover",
  "--color-overlay-light",
];

const SURFACES_STATE = [
  "--color-background-elevated",
  "--color-background-secondary-elevated",
  "--color-background-modal",
  "--color-background-bar",
  "--color-background-disabled",
  "--color-background-hover",
  "--color-background-highlight",
  "--color-stroke-soft",
  "--color-stroke-soft-disabled",
  "--color-control-hover",
  "--color-control-inactive",
];

const TEXT = [
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary",
  "--color-text-inverted",
  "--color-text-brand",
];

const TEXT_ON_TINT = [
  "--color-text-positive",
  "--color-text-positive-strong",
  "--color-text-warning-strong",
  "--color-text-negative-strong",
  "--color-text-negative",
  "--color-text-highlight-strong",
  "--color-text-link",
  "--color-text-link-visited",
];

const ACCENTS = [
  "--color-accent-positive",
  "--color-accent-warning",
  "--color-accent-negative",
  "--granat-violet",
  "--color-accent-positive-bg",
  "--color-accent-warning-bg",
  "--color-accent-negative-bg",
  "--color-accent-brand-bg",
];

const ACCENTS_EXTRA = [
  "--color-accent-negative-hover",
  "--color-accent-negative-active",
  "--color-accent-positive-inverted",
  "--color-accent-warning-inverted",
  "--color-accent-negative-inverted",
  "--color-accent-notification",
];

const SPACE = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64];
const RADII: Array<[string, string]> = [
  ["--radius-s", "8px — теги, чекбоксы"],
  ["--radius-m", "12px — карточки, поля, кнопки"],
  ["--radius-l", "32px — крупные карточки, модальные окна"],
  ["--radius-xl", "80px — пилюли, аватары"],
];
const SHADOWS = ["--shadow-low", "--shadow-middle", "--shadow-high"];

const TYPE: Array<[string, string, React.CSSProperties]> = [
  ["H1 · MTS Wide 32/36 bold", "--type-h1", { fontFamily: "var(--font-wide)", fontSize: 32, lineHeight: "36px", fontWeight: 700 }],
  ["H2 · MTS Wide 24/28 bold", "--type-h2", { fontFamily: "var(--font-wide)", fontSize: 24, lineHeight: "28px", fontWeight: 700 }],
  ["H3 · MTS Compact 20/24 bold", "--type-h3", { fontFamily: "var(--font-compact)", fontSize: 20, lineHeight: "24px", fontWeight: 700 }],
  ["H4 · MTS Compact 17/24 medium", "--type-h4", { fontFamily: "var(--font-compact)", fontSize: 17, lineHeight: "24px", fontWeight: 500 }],
  ["Body L · MTS Compact 17/24", "--type-body-lg", { fontFamily: "var(--font-compact)", fontSize: 17, lineHeight: "24px" }],
  ["Body · MTS Compact 15/20", "--type-body", { fontFamily: "var(--font-compact)", fontSize: 15, lineHeight: "20px" }],
  ["Body S · MTS Compact 14/20", "--type-body-sm", { fontFamily: "var(--font-compact)", fontSize: 14, lineHeight: "20px" }],
  ["Caption · MTS Text 12/16", "--type-caption", { fontFamily: "var(--font-text)", fontSize: 12, lineHeight: "16px" }],
  ["Long-form · MTS Sans 15/22", "--font-sans", { fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: "22px" }],
];

function Swatch({ token }: { token: string }) {
  const [value, setValue] = React.useState("");
  React.useEffect(() => {
    setValue(getComputedStyle(document.documentElement).getPropertyValue(token).trim());
  }, [token]);
  return (
    <div className="sc-swatch">
      <div className="sc-swatch-chip" style={{ background: `var(${token})` }} />
      <div className="sc-swatch-meta">
        <div className="sc-swatch-name">{token}</div>
        <div className="sc-swatch-value">{value || "—"}</div>
      </div>
    </div>
  );
}

function Swatches({ tokens }: { tokens: string[] }) {
  return (
    <div className="sc-swatches">
      {tokens.map((t) => (
        <Swatch key={t} token={t} />
      ))}
    </div>
  );
}

export function Foundations() {
  return (
    <Group
      id="foundations"
      title="Основы"
      note="Токены — единственный источник цвета, размера и радиуса. В компонентах нельзя ни hex, ни примитивы --granat-* / --mgts-* напрямую: тему переключает только слой --color-*. Это проверяет npm run check."
    >
      <Demo name="Логотип" path="components/brand/Logo" note="variant: full · mark · text">
        <div className="sc-stack">
          <Label>full · brand</Label>
          <Logo />
        </div>
        <div className="sc-stack">
          <Label>mark</Label>
          <Logo variant="mark" />
        </div>
        <div className="sc-stack">
          <Label>text · mono</Label>
          <Logo variant="text" tone="mono" />
        </div>
        <div
          className="sc-stack"
          style={{ background: "var(--color-background-inverted)", padding: "12px 16px", borderRadius: "var(--radius-m)" }}
        >
          <Label>inverted</Label>
          <Logo tone="inverted" />
        </div>
      </Demo>

      <Demo name="Бренд" path="tokens/colors.css" note="МГТС синий #008ae0 — везде, где МТС использует красный" column>
        <Swatches tokens={BRAND} />
      </Demo>

      <Demo name="Поверхности и линии" path="tokens/colors.css" column>
        <Swatches tokens={SURFACES} />
      </Demo>

      <Demo name="Уровни и состояния" path="tokens/colors.css" note="Granat Background/* и Controls/* — модалки, hover, disabled" column>
        <Swatches tokens={SURFACES_STATE} />
      </Demo>

      <Demo name="Текст" path="tokens/colors.css" column>
        <Swatches tokens={TEXT} />
      </Demo>

      <Demo name="Текст на подложке и ссылки" path="tokens/colors.css" note="Granat *Strong* — пара к --color-accent-*-bg" column>
        <Swatches tokens={TEXT_ON_TINT} />
      </Demo>

      <Demo name="Акценты" path="tokens/colors.css" note="красный МТС #e30611 / #ff0032 не используется" column>
        <Swatches tokens={ACCENTS} />
      </Demo>

      <Demo name="Акценты: состояния и инверсия" path="tokens/colors.css" note="hover / active и варианты для тёмной подложки" column>
        <Swatches tokens={ACCENTS_EXTRA} />
      </Demo>

      <Demo name="Типографика" path="tokens/typography.css" note="MTS Wide · Compact · Sans · Text" column>
        <div className="sc-scale">
          {TYPE.map(([label, token, style]) => (
            <div className="sc-scale-row" key={label}>
              <span className="sc-scale-key">{token}</span>
              <span style={style}>{label}</span>
            </div>
          ))}
        </div>
      </Demo>

      <Demo name="Отступы" path="tokens/spacing.css" note="сетка 4px" column>
        <div className="sc-scale">
          {SPACE.map((n) => (
            <div className="sc-scale-row" key={n}>
              <span className="sc-scale-key">--space-{n}</span>
              <span className="sc-space-bar" style={{ width: n }} />
              <span className="sc-swatch-value">{n}px</span>
            </div>
          ))}
        </div>
      </Demo>

      <Demo name="Радиусы" path="tokens/spacing.css" note="только 8 / 12 / 32 / 80">
        {RADII.map(([token, note]) => (
          <div className="sc-stack" key={token}>
            <Label>{token}</Label>
            <div className="sc-radius-box" style={{ borderRadius: `var(${token})` }} />
            <span className="sc-swatch-value">{note}</span>
          </div>
        ))}
      </Demo>

      <Demo name="Тени" path="tokens/spacing.css">
        {SHADOWS.map((token) => (
          <div className="sc-stack" key={token}>
            <Label>{token}</Label>
            <div className="sc-shadow-box" style={{ boxShadow: `var(${token})` }} />
          </div>
        ))}
      </Demo>
    </Group>
  );
}
