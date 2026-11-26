import React from "react";

/** Заголовок раздела витрины. */
export function Group({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sc-group" id={id}>
      <h2 className="sc-h2">{title}</h2>
      {note && <p className="sc-group-note">{note}</p>}
      {children}
    </section>
  );
}

/** Карточка одного компонента: имя, путь к файлу, демо. */
export function Demo({
  name,
  path,
  note,
  column = false,
  popover = false,
  children,
}: {
  name: string;
  path: string;
  note?: string;
  column?: boolean;
  /** Разрешает содержимому выходить за границы карточки — для поповеров. */
  popover?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className={popover ? "sc-card sc-popover" : "sc-card"}>
      <header className="sc-card-head">
        <span className="sc-card-name">{name}</span>
        <span className="sc-card-path">{path}</span>
        {note && <span className="sc-card-note">{note}</span>}
      </header>
      <div className={column ? "sc-card-body sc-col" : "sc-card-body"}>{children}</div>
    </article>
  );
}

/** Подпись над примером — какой это вариант компонента. */
export function Label({ children }: { children: React.ReactNode }) {
  return <div className="sc-label">{children}</div>;
}

/** Колонка «подпись + пример». */
export function Case({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sc-stack">
      <Label>{label}</Label>
      <div className="sc-row">{children}</div>
    </div>
  );
}
