import React from "react";
import { Logo } from "../ds/components/brand/Logo";
import { Switch } from "../ds/components/forms/Switch";
import { Link } from "../ds/components/core/Link";
import { Foundations } from "./sections/Foundations";
import { Core } from "./sections/Core";
import { Forms } from "./sections/Forms";
import { DataDisplay } from "./sections/DataDisplay";
import { Feedback } from "./sections/Feedback";
import { Navigation } from "./sections/Navigation";
import { Icons } from "./sections/Icons";

const SECTIONS = [
  { id: "foundations", label: "Основы", count: "9 карточек" },
  { id: "core", label: "Кнопки и действия", count: "10" },
  { id: "forms", label: "Формы", count: "21" },
  { id: "data", label: "Данные", count: "13" },
  { id: "feedback", label: "Обратная связь", count: "11" },
  { id: "navigation", label: "Навигация", count: "10" },
  { id: "icons", label: "Иконки", count: "1063" },
];

export function App() {
  const [dark, setDark] = React.useState(false);
  const [current, setCurrent] = React.useState("foundations");

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setCurrent(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -80% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sc-shell">
      <aside className="sc-side">
        <div className="sc-brand">
          <Logo variant="mark" size={28} />
          <div>
            <div className="sc-brand-title">Дизайн-система</div>
            <div className="sc-brand-sub">МГТС · версия 2.0</div>
          </div>
        </div>

        <nav className="sc-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={current === s.id}
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <span>{s.label}</span>
              <span className="sc-count">{s.count}</span>
            </button>
          ))}
        </nav>

        <div className="sc-side-foot">
          <Switch checked={dark} onChange={setDark} label="Тёмная тема" />
          <Link href="https://github.com" onClick={(e) => e.preventDefault()}>
            README проекта
          </Link>
        </div>
      </aside>

      <main className="sc-main">
        <header className="sc-head">
          <h1 className="sc-h1">Дизайн-система МГТС</h1>
          <p className="sc-lead">
            73 компонента, 1063 иконки, токены и шрифты MTS. Собрана из двух выгрузок Figma:
            базовой версии и дополнения по файлам «Web Components Molecules 2.0», «Organisms 2.0» и «Icons.fig».
            Бренд — синий #008ae0; красный МТС не используется никогда.
          </p>
        </header>

        <Foundations />
        <Core />
        <Forms />
        <DataDisplay />
        <Feedback />
        <Navigation />
        <Icons />
      </main>
    </div>
  );
}
