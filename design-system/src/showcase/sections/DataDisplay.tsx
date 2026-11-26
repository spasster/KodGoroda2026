import { Demo, Group, Label } from "../kit";
import { Avatar } from "../../ds/components/data-display/Avatar";
import { Badge } from "../../ds/components/data-display/Badge";
import { Card } from "../../ds/components/data-display/Card";
import { Counter } from "../../ds/components/data-display/Counter";
import { Divider } from "../../ds/components/data-display/Divider";
import { FilterBar } from "../../ds/components/data-display/FilterBar";
import { FilterChip } from "../../ds/components/data-display/FilterChip";
import { ListItem } from "../../ds/components/data-display/ListItem";
import { ScrollArea } from "../../ds/components/data-display/ScrollArea";
import { StatusPill } from "../../ds/components/data-display/StatusPill";
import { Table } from "../../ds/components/data-display/Table";
import { TableSelectionBar } from "../../ds/components/data-display/TableSelectionBar";
import { TableToolbar } from "../../ds/components/data-display/TableToolbar";
import { Tag } from "../../ds/components/data-display/Tag";
import { TextList } from "../../ds/components/data-display/TextList";
import { Switch } from "../../ds/components/forms/Switch";

const COLUMNS = [
  { key: "name", title: "Документ", type: "icon-text" as const, iconKey: "icon", captionKey: "kind", sortable: true },
  { key: "owner", title: "Ответственный", type: "avatar" as const, sortable: true },
  { key: "status", title: "Статус", type: "status" as const, toneKey: "tone" },
  { key: "ready", title: "Готовность", type: "progress" as const },
  { key: "size", title: "Размер", type: "number" as const, width: 120 },
];

const ROWS = [
  { id: 1, name: "Договор №14-2026", kind: "PDF", icon: "DocumentSize24StyleOutline", owner: "Анна Сергеева", status: "Подписан", tone: "positive", ready: 100, size: "2,4 МБ" },
  { id: 2, name: "Смета на монтаж", kind: "XLSX", icon: "TableSize24StyleOutline", owner: "Марк Ильин", status: "На согласовании", tone: "warning", ready: 60, size: "840 КБ" },
  { id: 3, name: "Акт приёмки", kind: "PDF", icon: "SignatureSize24StyleOutline", owner: "Соня Панова", status: "Отклонён", tone: "negative", ready: 20, size: "310 КБ" },
  { id: 4, name: "Техническое задание", kind: "DOCX", icon: "DocumentSize24StyleOutline", owner: "Дима Ковалёв", status: "Черновик", tone: "neutral", ready: 0, size: "1,2 МБ" },
];

export function DataDisplay() {
  return (
    <Group id="data" title="Данные" note="Группа data-display — показ содержимого.">
      <Demo name="Table" path="components/data-display/Table" note="новое в v2 · сортировка, выбор строк, типы ячеек" column>
        <TableToolbar title="Документы" count={ROWS.length} onSearch={() => undefined} />
        <Table columns={COLUMNS} rows={ROWS} selectable stickyHeader rowActions={() => undefined} />
      </Demo>

      <Demo name="Table · density=compact, пустая" path="components/data-display/Table" column>
        <Table columns={COLUMNS.slice(0, 3)} rows={ROWS} density="compact" />
        <Table
          columns={COLUMNS.slice(0, 3)}
          rows={[]}
          emptyTitle="Документов пока нет"
          emptyDescription="Загрузите первый файл — он появится в этом списке."
        />
      </Demo>

      <Demo name="TableToolbar · TableSelectionBar" path="components/data-display/" note="новое в v2" column>
        <TableToolbar title="Задачи" count={128} searchPlaceholder="Найти задачу" onSearch={() => undefined}>
          <Switch label="Только мои" />
        </TableToolbar>
        <TableSelectionBar
          count={3}
          label="документа выбрано"
          onCancel={() => undefined}
          actions={[
            { label: "Скачать", icon: "DownloadSize24StyleOutline" },
            { label: "Пометить", icon: "TagSize24StyleOutline" },
            { label: "Удалить", icon: "DeleteSize24StyleOutline" },
          ]}
        />
      </Demo>

      <Demo name="StatusPill" path="components/data-display/StatusPill" note="новое в v2">
        <StatusPill>Черновик</StatusPill>
        <StatusPill tone="positive">Подписан</StatusPill>
        <StatusPill tone="warning">На согласовании</StatusPill>
        <StatusPill tone="negative">Отклонён</StatusPill>
        <StatusPill tone="brand">В работе</StatusPill>
      </Demo>

      <Demo name="Badge · Counter · Tag" path="components/data-display/">
        <div className="sc-stack">
          <Label>Badge</Label>
          <div className="sc-row">
            <Badge>Нейтральный</Badge>
            <Badge tone="positive">Готово</Badge>
            <Badge tone="warning">Внимание</Badge>
            <Badge tone="negative">Ошибка</Badge>
            <Badge tone="brand">Новое</Badge>
          </div>
        </div>
        <div className="sc-stack">
          <Label>Counter</Label>
          <div className="sc-row">
            <Counter value={7} />
            <Counter value={128} max={99} />
            <Counter value={3} tone="negative" />
            <Counter value={12} tone="neutral" />
          </div>
        </div>
        <div className="sc-stack">
          <Label>Tag</Label>
          <div className="sc-row">
            <Tag>Обычный</Tag>
            <Tag selected>Выбранный</Tag>
            <Tag icon="TagSize24StyleOutline">С иконкой</Tag>
            <Tag onRemove={() => undefined}>С удалением</Tag>
          </div>
        </div>
      </Demo>

      <Demo name="Avatar" path="components/data-display/Avatar">
        <Avatar name="Анна Сергеева" size="s" />
        <Avatar name="Марк Ильин" />
        <Avatar name="Соня Панова" size="l" status="online" />
        <Avatar name="Дима Ковалёв" status="busy" />
        <Avatar name="Пётр Лыков" status="away" />
      </Demo>

      <Demo name="Card" path="components/data-display/Card">
        <Card style={{ width: 220 }}>
          <b>elevated</b>
          <div className="sc-swatch-value">С тенью, основная поверхность</div>
        </Card>
        <Card variant="outlined" style={{ width: 220 }}>
          <b>outlined</b>
          <div className="sc-swatch-value">Контур без тени</div>
        </Card>
        <Card variant="flat" radius="l" style={{ width: 220 }}>
          <b>flat · radius=l</b>
          <div className="sc-swatch-value">Заливка вторичной поверхностью</div>
        </Card>
      </Demo>

      <Demo name="ListItem" path="components/data-display/ListItem" column>
        <ListItem icon="DocumentSize24StyleOutline" title="Договор №14-2026" description="Подписан 12 августа" trailing={<Badge tone="positive">Готово</Badge>} />
        <ListItem icon="UserSize24StyleOutline" title="Участники" description="4 человека" trailing={<Counter value={4} />} onClick={() => undefined} />
        <ListItem icon="SettingsSize24StyleOutline" title="Настройки уведомлений" trailing={<Switch checked />} selected />
      </Demo>

      <Demo name="Divider · TextList" path="components/data-display/">
        <div className="sc-w360">
          <Label>Divider</Label>
          <Divider />
          <Divider label="или" />
          <div className="sc-row" style={{ height: 40 }}>
            слева
            <Divider orientation="vertical" />
            справа
          </div>
        </div>
        <div className="sc-w360">
          <Label>TextList</Label>
          <TextList items={["Согласование сметы", "Монтаж оборудования", "Приёмка работ"]} />
          <TextList type="number" items={["Заявка", "Проверка", "Договор"]} />
        </div>
      </Demo>

      <Demo name="ScrollArea" path="components/data-display/ScrollArea" note="новое в v2 · тонкий бегунок">
        <div className="sc-w360">
          <ScrollArea height={160} thin>
            <div style={{ padding: 12 }}>
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--color-line)" }}>
                  Строка {i + 1}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </Demo>

      <Demo name="FilterBar · FilterChip" path="components/data-display/" note="новое · фильтры над списком" column>
        <FilterBar
          filters={[
            {
              id: "year",
              label: "Год",
              icon: "CalendarSize24StyleOutline",
              options: [
                { id: "2026", label: "2026", count: 24 },
                { id: "2025", label: "2025", count: 118 },
                { id: "2024", label: "2024", count: 96 },
              ],
            },
            {
              id: "type",
              label: "Тип документа",
              options: [
                { id: "contract", label: "Договоры", count: 12 },
                { id: "agreement", label: "Соглашения", count: 6 },
                { id: "act", label: "Акты", count: 8 },
              ],
            },
            {
              id: "owner",
              label: "Ответственный",
              options: [
                { id: "ivanova", label: "Иванова М." },
                { id: "petrov", label: "Петров О." },
                { id: "smirnova", label: "Смирнова А." },
              ],
            },
          ]}
          defaultValues={{ year: "2026" }}
        />
        <div className="sc-row">
          <Label>Отдельный чип</Label>
          <FilterChip label="Статус" />
          <FilterChip label="Статус" value="Согласован" onRemove={() => undefined} />
        </div>
      </Demo>
    </Group>
  );
}
