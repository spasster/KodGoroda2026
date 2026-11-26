import React from "react";
import { Demo, Group, Label } from "../kit";
import { ActionBar } from "../../ds/components/navigation/ActionBar";
import { AppHeader } from "../../ds/components/navigation/AppHeader";
import { Breadcrumbs } from "../../ds/components/navigation/Breadcrumbs";
import { Collapsible } from "../../ds/components/navigation/Collapsible";
import { ContextMenu, useContextMenu } from "../../ds/components/navigation/ContextMenu";
import { Drawer } from "../../ds/components/navigation/Drawer";
import { Menu } from "../../ds/components/navigation/Menu";
import { Pagination } from "../../ds/components/navigation/Pagination";
import { PaginationDots } from "../../ds/components/navigation/PaginationDots";
import { SidebarNav } from "../../ds/components/navigation/SidebarNav";
import { Steps } from "../../ds/components/navigation/Steps";
import { Tabs } from "../../ds/components/navigation/Tabs";
import { Tree } from "../../ds/components/navigation/Tree";
import { Wizard } from "../../ds/components/navigation/Wizard";
import { Button } from "../../ds/components/core/Button";

export function Navigation() {
  const [tab, setTab] = React.useState("plan");
  const [page, setPage] = React.useState(1);
  const [dot, setDot] = React.useState(0);
  const [nav, setNav] = React.useState("docs");
  const [drawer, setDrawer] = React.useState(false);
  const [treeSel, setTreeSel] = React.useState<string | number | null>("dogovory");
  const menu = useContextMenu<string>();

  return (
    <Group id="navigation" title="Навигация" note="Группа navigation — перемещение по разделам и шагам.">
      <Demo name="Tabs" path="components/navigation/Tabs" column>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "plan", label: "План" },
            { value: "docs", label: "Документы" },
            { value: "team", label: "Команда" },
            { value: "log", label: "История" },
          ]}
        />
        <div className="sc-swatch-value">Активная вкладка: {tab}</div>
      </Demo>

      <Demo name="Breadcrumbs" path="components/navigation/Breadcrumbs" column>
        <Breadcrumbs
          items={[
            { label: "Проекты", onClick: () => undefined },
            { label: "Модернизация сети", onClick: () => undefined },
            { label: "Документы" },
          ]}
        />
      </Demo>

      <Demo name="Steps" path="components/navigation/Steps" column>
        <Steps
          current={1}
          steps={[
            { label: "Заявка", description: "Принята" },
            { label: "Согласование", description: "В работе" },
            { label: "Договор" },
            { label: "Монтаж" },
          ]}
        />
      </Demo>

      <Demo name="SidebarNav" path="components/navigation/SidebarNav">
        <div className="sc-w280 sc-stack" style={{ gap: 2 }}>
          <SidebarNav icon="HomeSize24StyleOutline" label="Обзор" active={nav === "home"} onClick={() => setNav("home")} />
          <SidebarNav icon="DocumentSize24StyleOutline" label="Документы" badge={12} active={nav === "docs"} onClick={() => setNav("docs")} />
          <SidebarNav icon="UserSize24StyleOutline" label="Участники" badge="4" active={nav === "team"} onClick={() => setNav("team")} />
          <SidebarNav icon="SettingsSize24StyleOutline" label="Настройки" active={nav === "settings"} onClick={() => setNav("settings")} />
        </div>
      </Demo>

      <Demo name="Menu" path="components/navigation/Menu">
        <div className="sc-w280">
          <Menu
            items={[
              { label: "Открыть", icon: "OpenInNewSize24StyleOutline" },
              { label: "Дублировать", icon: "DuplicateSize24StyleOutline", shortcut: "Ctrl+D" },
              { label: "Скачать", icon: "DownloadSize24StyleOutline" },
              { divider: true },
              { label: "Архивировать", icon: "ArchiveSize24StyleOutline", disabled: true },
              { label: "Удалить", icon: "DeleteSize24StyleOutline", tone: "negative" },
            ]}
          />
        </div>
      </Demo>

      <Demo name="Collapsible" path="components/navigation/Collapsible" column>
        <Collapsible title="Что входит в согласование" defaultOpen>
          Смета, техническое задание и график работ. Каждый документ подписывают руководитель проекта и заказчик.
        </Collapsible>
        <Collapsible title="Сколько занимает монтаж">Срок зависит от объёма: от трёх рабочих дней.</Collapsible>
      </Demo>

      <Demo name="Pagination · PaginationDots" path="components/navigation/" note="PaginationDots — новое в v2">
        <div className="sc-stack">
          <Label>Pagination</Label>
          <Pagination count={5} active={page} onChange={setPage} />
        </div>
        <div className="sc-stack">
          <Label>PaginationDots</Label>
          <PaginationDots count={4} active={dot} onChange={setDot} />
          <PaginationDots count={6} active={2} size={12} />
        </div>
      </Demo>

      <Demo name="ActionBar" path="components/navigation/ActionBar" column>
        <ActionBar align="between">
          <Button variant="ghost">Назад</Button>
          <Button>Продолжить</Button>
        </ActionBar>
      </Demo>

      <Demo name="Drawer" path="components/navigation/Drawer" note="новое в v2 · боковая панель">
        <Button onClick={() => setDrawer(true)}>Открыть панель</Button>
        <Drawer
          open={drawer}
          onClose={() => setDrawer(false)}
          title="Фильтры"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDrawer(false)}>
                Сбросить
              </Button>
              <Button onClick={() => setDrawer(false)}>Применить</Button>
            </>
          }
        >
          Содержимое панели — форма, список или что угодно ещё.
        </Drawer>
      </Demo>

      <Demo name="AppHeader" path="components/navigation/AppHeader" note="новое · шапка продукта" column>
        <AppHeader
          product="Документооборот"
          search
          searchPlaceholder="Поиск по документам и контрагентам"
          actions={[
            { id: "help", icon: "QuestionSize24StyleOutline", title: "Справка" },
            { id: "bell", icon: "NotificationSize24StyleOutline", title: "Уведомления", count: 4 },
            { id: "settings", icon: "SettingsSize24StyleOutline", title: "Настройки", dot: true },
          ]}
          user={{ name: "Мария Иванова", online: true }}
        />
        <AppHeader compact product="Заявки" search={false} user={{ name: "Олег Петров" }} />
      </Demo>

      <Demo name="Tree" path="components/navigation/Tree" note="новое · дерево разделов" column>
        <Tree
          nodes={[
            {
              id: "docs",
              label: "Документы",
              caption: "24 активных",
              icon: "DocumentSize24StyleOutline",
              children: [
                { id: "dogovory", label: "Договоры", count: 12, icon: "DocumentSize24StyleOutline" },
                { id: "soglasheniya", label: "Соглашения", count: 6, icon: "DocumentSize24StyleOutline" },
                {
                  id: "prilozheniya",
                  label: "Приложения",
                  children: [
                    { id: "specs", label: "Спецификации", count: 3 },
                    { id: "acts", label: "Акты", count: 8 },
                  ],
                },
              ],
            },
            { id: "archive", label: "Архив", caption: "2024–2025", icon: "ArchiveSize24StyleOutline", count: 148 },
            { id: "trash", label: "Корзина", icon: "DeleteSize24StyleOutline", disabled: true },
          ]}
          defaultExpanded={["docs"]}
          selectedId={treeSel}
          onSelect={(id) => setTreeSel(id)}
        />
        <div className="sc-swatch-value">Выбран узел: {String(treeSel)}</div>
      </Demo>

      <Demo name="Wizard" path="components/navigation/Wizard" note="новое · многошаговая форма" column>
        <Wizard
          steps={[
            { title: "Контрагент", description: "Кто вторая сторона договора" },
            { title: "Условия", description: "Сумма, срок и порядок оплаты" },
            { title: "Согласование", description: "Кто и в каком порядке подписывает" },
          ]}
          hint="Черновик сохранён"
          onCancel={() => undefined}
          onFinish={() => undefined}
        >
          Содержимое шага — форма, таблица или сводка перед отправкой.
        </Wizard>
      </Demo>

      <Demo name="ContextMenu" path="components/navigation/ContextMenu" note="новое · правый клик или «…»" column>
        <div
          onContextMenu={(e) => menu.openAt(e, "Договор № 2024-118")}
          style={{
            padding: "20px 16px",
            border: "1px dashed var(--color-line)",
            borderRadius: "var(--radius-m)",
            fontFamily: "var(--font-compact)",
            fontSize: 14,
            color: "var(--color-text-secondary)",
          }}
        >
          Правый клик по этой области
        </div>
        <Button variant="secondary" onClick={(e) => menu.openUnder(e, "Кнопка «…»")}>
          Действия
        </Button>
        <ContextMenu
          open={menu.open}
          x={menu.x}
          y={menu.y}
          onClose={menu.close}
          onSelect={() => menu.close()}
          items={[
            { id: "open", label: "Открыть", icon: "DocumentSize24StyleOutline" },
            { id: "copy", label: "Копировать ссылку", icon: "LinkSize24StyleOutline", shortcut: "Ctrl+C" },
            { divider: true },
            { id: "archive", label: "В архив", icon: "ArchiveSize24StyleOutline" },
            { id: "delete", label: "Удалить", icon: "DeleteSize24StyleOutline", tone: "negative" },
          ]}
        />
        <div className="sc-swatch-value">Объект: {menu.payload ?? "—"}</div>
      </Demo>
    </Group>
  );
}
