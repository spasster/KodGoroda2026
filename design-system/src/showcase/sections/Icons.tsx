import React from "react";
import { Demo, Group } from "../kit";
import { Icon, type IconName } from "../../ds/assets/icons/Icon";
import { SearchInput } from "../../ds/components/forms/SearchInput";
import { SegmentedControl } from "../../ds/components/core/SegmentedControl";
import { Badge } from "../../ds/components/data-display/Badge";
import { Snackbar } from "../../ds/components/feedback/Snackbar";

/** Имена, добавленные в v2 — подсвечиваются в галерее. */
const ADDED_IN_V2 = new Set([
  "AddAttachment", "AddFile", "Attachment", "Flag", "Notification",
  "Save", "Signature", "Sort", "Table", "Tag", "Unlock",
]);

function familyOf(name: string) {
  return name.replace(/Size\d+.*$/, "");
}

export function Icons() {
  const [query, setQuery] = React.useState("");
  const [style, setStyle] = React.useState("all");
  const [copied, setCopied] = React.useState<string | null>(null);

  const all = React.useMemo(() => {
    const map = (window as unknown as { __MGTS_ICONS?: Record<string, unknown> }).__MGTS_ICONS || {};
    return Object.keys(map).sort();
  }, []);

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((n) => {
      if (q && !n.toLowerCase().includes(q)) return false;
      if (style === "outline" && !n.endsWith("StyleOutline")) return false;
      if (style === "fill" && !n.endsWith("StyleFill")) return false;
      if (style === "new" && !ADDED_IN_V2.has(familyOf(n))) return false;
      return true;
    });
  }, [all, query, style]);

  const families = React.useMemo(() => new Set(all.map(familyOf)).size, [all]);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = (name: string) => {
    navigator.clipboard?.writeText(name).then(
      () => setCopied(name),
      () => setCopied(null),
    );
  };

  return (
    <Group
      id="icons"
      title="Иконки"
      note={`${all.length} начертаний в ${families} семействах. Отрисовка — <Icon name="…" size={24} />, цвет наследуется из CSS color.`}
    >
      <Demo name="Галерея" path="assets/icons/Icon" note="клик по иконке копирует имя" column>
        <div className="sc-row">
          <div className="sc-w360">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
              placeholder="Поиск по имени, например «table»"
            />
          </div>
          <SegmentedControl
            value={style}
            onChange={setStyle}
            segments={[
              { value: "all", label: "Все" },
              { value: "outline", label: "Outline" },
              { value: "fill", label: "Fill" },
              { value: "new", label: "Добор v2" },
            ]}
          />
          <Badge tone="brand">{shown.length}</Badge>
        </div>

        {shown.length === 0 ? (
          <div className="sc-icon-empty">Ничего не найдено. Попробуйте другой запрос.</div>
        ) : (
          <div className="sc-icon-grid">
            {shown.slice(0, 600).map((name) => (
              <button
                key={name}
                type="button"
                className={ADDED_IN_V2.has(familyOf(name)) ? "sc-icon-cell sc-new" : "sc-icon-cell"}
                onClick={() => copy(name)}
                title={name}
              >
                <Icon name={name as IconName} size={24} />
                <span className="sc-icon-name">
                  {name.replace(/Size(\d+)(?:Style)?/, " · $1 · ").replace(/ · $/, "").trim()}
                </span>
              </button>
            ))}
          </div>
        )}

        {shown.length > 600 && (
          <div className="sc-icon-empty">
            Показаны первые 600 из {shown.length}. Уточните запрос, чтобы увидеть остальные.
          </div>
        )}
      </Demo>

      {copied && (
        <div className="sc-copied">
          <Snackbar tone="positive" message={`Скопировано: ${copied}`} />
        </div>
      )}
    </Group>
  );
}
