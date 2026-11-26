# Дизайн-система МГТС

Объединённая дизайн-система: **73 компонента, 1063 иконки, 60 цветовых токенов
и шрифты MTS**, плюс витрина, где всё это видно и кликается.

Этот файл — про устройство репозитория и историю слияний. Как этим пользоваться —
в отдельном руководстве: токены, каталог компонентов со скриншотами, правила выбора
между похожими компонентами, паттерны экранов —
https://claude.ai/code/artifact/4458909a-e374-4f76-bde0-3568479742da

Собрана из двух выгрузок Figma:

| Источник | Что дал |
| --- | --- |
| «МГТС Design System» (базовая выгрузка) | 49 компонентов, 1012 иконок, токены, шрифты |
| «Дополнение дизайн-системы из Figma» — по файлам «Web Components Molecules 2.0», «Web Components Organisms 2.0», «Icons.fig» | +23 файла компонентов, +51 иконка, гайдлайны, `logo.svg` |
| Правки в проекте после выгрузок | +30 цветовых токенов, снятие утечки примитивов, настоящий знак в `Logo`, четвёртая проверка в `check-ds.mjs` |

Бренд — **МГТС синий `#008ae0`**. Красный МТС (`#e30611`, `#ff0032`) не используется никогда.

## Запуск

```bash
npm install
```

```bash
npm run dev
```

Витрина откроется на `http://localhost:5180`. Разделы: основы (токены, типографика,
отступы, радиусы, тени), кнопки и действия, формы, данные, обратная связь, навигация,
галерея иконок с поиском. Переключатель тёмной темы — внизу бокового меню.

## Структура

```
src/ds/                     ← сама дизайн-система, переносится в проект как есть
  styles.css                ← единственная точка входа: @import шрифтов и токенов
  tokens/                   ← colors · typography · spacing · fonts
  assets/fonts/             ← MTS Wide · Compact · Sans · Text (woff + woff2)
  assets/icons/             ← icon-data.js (1063) + Icon.jsx + Icon.d.ts
  components/<группа>/      ← <Имя>.jsx + <Имя>.d.ts (+ .prompt.md у базовых)
  guidelines/               ← справочные карточки из дизайн-тула, кодом не импортируются
src/showcase/               ← витрина, в продукт не переносится
scripts/check-ds.mjs        ← проверка целостности системы
```

## Как подключить к продукту

1. Скопировать `src/ds/` в приложение.
2. Один раз импортировать `ds/styles.css` в корне — он подтянет шрифты и токены.
3. Импортировать компоненты **без расширения** — Vite подставит `.jsx`, TypeScript возьмёт `.d.ts`:

```tsx
import { Table } from "./ds/components/data-display/Table";
import { Icon } from "./ds/assets/icons/Icon";
```

Внешних зависимостей у компонентов нет — только React и соседний `Icon`.
`Icon` читает `window.__MGTS_ICONS` через сайд-эффект `import './icon-data.js'`.

## Состав

| Группа | Компоненты |
| --- | --- |
| `brand` | Logo |
| `core` | Button, ButtonPrice, **ButtonWithIndicator**, **BottomButton**, Chip, IconButton, **IconButtonSet**, Link, SegmentedControl, Spinner |
| `forms` | **Attach** (Dropzone + AttachFile), Autocomplete, Checkbox, **ChoiceChip** + **ChoiceChipGroup**, CodeInput, **ControlList**, **DatePicker**, **Droplist**, FileUpload, FormChip, InlineEdit, Radio, RangeSlider, SearchInput, Select, Slider, Stepper, Switch, Textarea, TextField |
| `data-display` | Avatar, Badge, Card, Counter, Divider, **FilterBar**, **FilterChip**, ListItem, **ScrollArea**, **StatusPill**, **Table**, **TableSelectionBar**, **TableToolbar**, Tag, TextList |
| `feedback` | Banner, CookieBanner, **EmptyState**, Modal, ProgressBar, **ProgressCircle**, Skeleton, Snackbar, StickyBanner, Toast, Tooltip |
| `navigation` | ActionBar, **AppHeader**, Breadcrumbs, Collapsible, **ContextMenu** + `useContextMenu`, **Drawer**, Menu, Pagination, **PaginationDots**, SidebarNav, Steps, Tabs, **Tree**, **Wizard** |

**Жирным** — то, что пришло из дополнения.

Иконки: 1012 → 1063. Добор — вложения, флаги, уведомления, сохранение, подпись,
сортировка, таблица, теги, замок. Токены, шрифты и базовые 1012 иконок в обеих
выгрузках совпали побайтово, конфликтов сливать не пришлось.

## Правки при слиянии

Выгрузка приезжает с дефектами. Если будете вливать новую версию — их придётся вычистить заново.

1. **`const const` вместо `const`** в шести файлах: ButtonWithIndicator, StatusPill,
   ProgressCircle, Attach, ControlList, Droplist. Синтаксическая ошибка — модули не грузились.
2. **`forms/Attach.jsx`** — `export default Attach` при неопределённом `Attach`, а `Dropzone`
   и `AttachFile` вообще не экспортировались. Приведено к тому, что объявлено в `Attach.d.ts`.
3. **`forms/ChoiceChip.jsx`** — `ChoiceChipGroup` объявлен в `.d.ts`, но не экспортировался.
4. **`core/ButtonWithIndicator.jsx`** — палитра сведена с `core/Button.jsx`: negative
   hover/active `#e0481a` / `#c93f16` (было `#d8400c` / `#b93509`), secondary и ghost
   active — `--color-brand-subtle` вместо `--mgts-blue-100` (последний ломался в тёмной теме).
5. **`navigation/Drawer.jsx`** — корень был `position: absolute`, и закрытая панель,
   уехавшая за правый край, растягивала документ по горизонтали на свою ширину (480 px).
   Стало `position: fixed` + `overflow: hidden` + `visibility` — как в `Modal.jsx`.

Отдельно: `forms/Stepper.jsx` в проекте новее, чем в выгрузке — значение можно ввести
с клавиатуры (Enter / потеря фокуса, стрелки, Escape — откат). При следующем слиянии
не затирайте его вариантом из Figma. То же касается `ButtonWithIndicator`, `ChoiceChip`,
`Droplist` и `Drawer`.

## Проверка

```bash
npm run check
```

`scripts/check-ds.mjs` делает то, чего не делают `tsc` и `vite build`:

- собирает и **исполняет** каждый `.jsx` — ловит синтаксис и ссылки на необъявленные
  идентификаторы (`tsc` внутрь `.jsx` не смотрит, а `vite build` не тянет то, что нигде
  не импортировано — обе проверки пропустили бы и `const const`, и сломанный `Attach`);
- рендерит каждый экспорт с пустыми пропсами;
- сверяет экспорты `.jsx` с объявлениями в `.d.ts`;
- проверяет, что все имена иконок в коде существуют, а `Icon.d.ts` и `icon-data.js` совпадают;
- **следит за дисциплиной токенов**: падает, если в компоненте есть hex (кроме `#fff`)
  или обращение к примитивам `--granat-*` / `--mgts-*`. Тему переключает только слой
  `--color-*`, поэтому примитив в компоненте — это баг тёмной темы.

Плюс обычное:

```bash
npm run typecheck
```

## Правила

- Цвета, размеры и радиусы — только из токенов. Единственное исключение — `#fff`
  на брендовой заливке: белый не зависит от темы. Оттенки текста статусов теперь
  живут в токенах `--color-text-*-strong`.
- Примитивы `--granat-*` и `--mgts-*` — только внутри `tokens/colors.css`.
- Радиусы — только сетка `8 / 12 / 32 / 80` (`--radius-s/m/l/xl`).
- Русский язык, sentence case, без эмодзи.
- Тёмная тема — класс `dark` на `<html>`.
- Десктоп в первую очередь, от 1280 px.

## Чего пока нет

Из молекул — Store/AI-кнопки, промо-баннеры, Form Family; мобильный Tabbar вне скоупа.
Header, Context Menu, Tree, Calendar и Steps из организмов уже влиты.

Открытые вопросы по цвету: в системе два цвета negative (оранжевый `#f95721`
в акцентах и малиновый `#ea1f49` в неподключённом `--color-text-negative`),
и `Link` красится в брендовый синий, хотя в Granat цвет ссылки другой.
Подробности — в `COLOR-AUDIT.md`.

## Доступность

Слабое место: ховер реализован у 26 компонентов из 71, фокус — у 10, активное
состояние — у 4. Двенадцать кликабельных элементов сделаны через `span` без
`role` и обработчика клавиатуры. Новые компоненты должны приезжать с видимым
фокусом и клавиатурой сразу.
