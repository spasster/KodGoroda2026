# МГТС Design System в Takt

Копия дизайн-системы МГТС, вкомпилированная в `apps/web`. Источник — экспорт из
Figma-файлов «Web Components Molecules 2.0», «Web Components Organisms 2.0», «Icons.fig».

Подключение: `src/tokens.css` делает `@import './ds/styles.css'` (шрифты + токены).
Компоненты — обычные `.jsx` с сайдкаром `.d.ts`, импортируются **без расширения**
(Vite резолвит `.jsx`, TypeScript — `.d.ts`):

```tsx
import { Table } from "../ds/components/data-display/Table";
```

## Версии

| Ревизия | Что вошло |
| --- | --- |
| v1 (авг-2026) | 49 компонентов, 1012 иконок, токены, шрифты MTS |
| **v2 (26.08.2026)** | +16 файлов компонентов (18 экспортов), +51 иконка, `guidelines/`, `assets/logo.svg` |

Токены (`tokens/*.css`), шрифты и базовые 1012 иконок в v2 **не изменились** —
сверено по хэшам, расхождений нет.

## Что добавила v2

| Группа | Компоненты |
| --- | --- |
| `core/` | BottomButton, ButtonWithIndicator, IconButtonSet |
| `data-display/` | Table, TableToolbar, TableSelectionBar, StatusPill, ScrollArea |
| `feedback/` | EmptyState, ProgressCircle |
| `forms/` | Attach (Dropzone + AttachFile), ChoiceChip + ChoiceChipGroup, ControlList, Droplist |
| `navigation/` | Drawer, PaginationDots |

Иконки: 1012 → 1063. Добор — вложения, флаги, уведомления, сохранение, подпись,
сортировка, таблица, теги, замок. `assets/icons/Icon.d.ts` перегенерирован из
`icon-data.js` (порядок имён повторяет порядок ключей в данных).

`guidelines/*.card.html` — справочные карточки по цвету, типографике, отступам,
радиусам и теням. Это документация из дизайн-тула, кодом не импортируется.

## Расхождения с экспортом — держать при следующем обновлении

1. **`forms/Stepper.jsx` — версия проекта новее экспорта.** В проекте значение можно
   ввести с клавиатуры (Enter / потеря фокуса, ArrowUp/Down, Escape — откат);
   в экспорте — только кнопки ±. При обновлении ДС файл **не перезаписывать**.

2. **Правки при вливании v2** (в экспорте были дефекты, чинить снова при повторном импорте):
   - `const const` вместо `const` в 6 файлах: ButtonWithIndicator, StatusPill,
     ProgressCircle, Attach, ControlList, Droplist — синтаксическая ошибка, модули не грузились;
   - `forms/Attach.jsx` — `export default Attach` при неопределённом `Attach`; добавлены
     `export { Dropzone, AttachFile }`, `export const Attach = { Dropzone, File: AttachFile }`,
     `export default Dropzone` — как объявлено в `Attach.d.ts`;
   - `forms/ChoiceChip.jsx` — `ChoiceChipGroup` объявлен в `.d.ts`, но не экспортировался;
   - `core/ButtonWithIndicator.jsx` — приведён к палитре `core/Button.jsx`: negative
     hover/active `#e0481a`/`#c93f16` (было `#d8400c`/`#b93509`), secondary/ghost active
     `--color-brand-subtle` вместо `--mgts-blue-100` (последний ломался в тёмной теме),
     `#fff` → `#ffffff`.

## Соглашения

- Бренд — МГТС синий `#008ae0`. Красный МТС (`#e30611`, `#ff0032`) не используется никогда.
- Цвета берутся из семантических токенов. Исключения, уже принятые в системе:
  `#ffffff` на брендовой заливке и текстовые оттенки статусов `#1b8c3c` / `#9a7000` /
  `#c43c12` (так же в `data-display/Badge.jsx`) — под них токенов нет.
- Радиусы — только `--radius-*` (8 / 12 / 32 / 80).
- Русский язык, sentence case, без эмодзи.

## Проверка после обновления

```bash
cd apps/web && npx tsc --noEmit && npx vite build
```

Дополнительно стоит прогнать рендер новых компонентов через `react-dom/server`:
`tsc` не смотрит внутрь `.jsx`, а `vite build` не тянет то, что ещё нигде не импортировано,
— обе проверки пропустили бы `const const` и сломанный `Attach`.

## Чего в экспорте пока нет

Из молекул — Store/AI-кнопки, промо-баннеры, Form Family; мобильный Tabbar вне скоупа
(система десктопная, 1280+). Из организмов — Header, варианты Modal, Context Menu, Tree,
Calendar / Time Picker, Steps.
