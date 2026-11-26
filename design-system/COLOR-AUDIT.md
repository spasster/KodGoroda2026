# Сверка цветов с Base 2.0.fig

Источник — `Base 2.0.fig` (fig-kiwi, 1232 цветовые переменные, набор `Brand` в режиме **MGTS**).
Брендовые токены (`--color-brand*`, `--mgts-blue-*`, `--color-text-brand`, `--color-icons-brand`,
`--color-accent-brand-bg`) из сверки исключены по условию задачи.

## Совпадает (24 токенов)

- `--granat-white`
- `--granat-bg-grey`
- `--granat-line-grey`
- `--granat-grey-400`
- `--granat-grey-500`
- `--granat-grey-600`
- `--granat-grey-800`
- `--granat-graphite`
- `--granat-near-white`
- `--granat-green`
- `--granat-yellow`
- `--color-background-primary (light)`
- `--color-background-secondary (light)`
- `--color-background-inverted (light)`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-text-tertiary`
- `--color-text-inverted`
- `--color-icons-primary`
- `--color-icons-secondary (light)`
- `--color-icons-inverted`
- `--color-line (light)`
- `--color-accent-positive`
- `--color-accent-warning`

## Расходится (16)

| Токен | Тема | В проекте | Переменная в файле | В файле | Что именно |
|---|---|---|---|---|---|
| `--granat-grey-200` | light | `#bbc1c9` | Constant/Greyscale/300 | `#bbc1c7` | опечатка: −2 по синему, #bbc1c9 в палитре отсутствует |
| `--granat-grey-100 / --color-background-lower` | light | `#d8dce5 / #e9ecf0` | Constant/Greyscale/300, Background/Lower | `#bbc1c7, #f2f3f7` | обоих значений в палитре нет |
| `--granat-violet` | light | `#7b61ff` | Constant/Blackberry/400 | `#9e66ff` | #7b61ff в палитре нет |
| `--color-accent-negative` | light | `#f95721` | Accent/Negative | `#ea1f49` | роль: в файле negative — малиновый, в проекте оранжевый |
| `--color-control-stroke` | light | `#969fa8` | Controls/Stroke | `#8d969f` | взят соседний оттенок |
| `--color-icons-tertiary` | light | `#969fa8` | Icons/Tertiary | `#bbc1c7` | взят оттенок из Text/Tertiary |
| `--color-accent-positive-bg` | light | `#e3f9ea` | Background/Positive Soft | `#bef4bd` | подложка бледнее, в палитре нет |
| `--color-accent-warning-bg` | light | `#fff4d6` | Background/Warning Soft | `#fae89e` | подложка бледнее, в палитре нет |
| `--color-accent-negative-bg` | light | `#ffe5dc` | Background/Negative Soft | `#fcd4c9` | подложка бледнее, в палитре нет |
| `--color-overlay` | light | `#1d2023 50%` | Background/Overlay | `#1d2023 40%` | в палитре есть только 40% |
| `--color-background-primary` | dark | `#1d2023` | Background/Primary | `#000000` | совпадает с Background/Primary Elevated, не с Primary |
| `--color-background-secondary` | dark | `#26292c` | Background/Secondary | `#626c77 25%` | в файле — полупрозрачная подложка, не плотный серый |
| `--color-background-lower` | dark | `#141719` | Background/Lower | `#000000` | значения в палитре нет |
| `--color-background-inverted` | dark | `#fafafa` | Background/Inverted | `#ffffff` | на шаг светлее в файле |
| `--color-icons-secondary` | dark | `#8d969f` | Icons/Secondary | `#969fa8` | в тёмной теме файл светлее |
| `--color-control-stroke` | dark | `#3a4045` | Controls/Stroke | `#636b72` | значения в палитре нет |

## Значения, которых нет в палитре `Granat/*` (300 примитивов)

- `#e9ecf0`
- `#d8dce5`
- `#bbc1c9`
- `#7b61ff`
- `#e3f9ea`
- `#fff4d6`
- `#ffe5dc`
- `#26292c`
- `#141719`
- `#3a4045`

Все десять — собственные значения проекта, в файле их нет ни под каким именем.

## Тёмная тема

В файле тёмная тема строится на чёрном фоне и полупрозрачных подложках
(`Background/Primary` = `#000000`, `Background/Secondary` = `#626c77 25%`),
в проекте — на плотных серых (`#1d2023` / `#26292c` / `#141719`).
Это разные стратегии, а не расхождение в отдельных значениях.

## Добавлено (по итогам сверки)

В `colors.css` заведены 26 токенов из файла, светлая и тёмная тема:

| Группа | Токены |
|---|---|
| Текст на подложке | `--color-text-positive`, `--color-text-positive-strong`, `--color-text-warning-strong`, `--color-text-negative-strong`, `--color-text-negative`, `--color-text-highlight-strong` |
| Ссылки | `--color-text-link`, `--color-text-link-visited` |
| Уровни поверхности | `--color-background-elevated`, `--color-background-secondary-elevated`, `--color-background-modal`, `--color-background-bar` |
| Состояния фона | `--color-background-disabled`, `--color-background-hover`, `--color-background-highlight` |
| Обводка и контролы | `--color-stroke-soft`, `--color-stroke-soft-disabled`, `--color-control-hover`, `--color-control-inactive` |
| Акценты | `--color-accent-negative-hover`, `--color-accent-negative-active`, `--color-accent-*-inverted`, `--color-accent-notification` |

Хардкоды переведены на токены: `Badge`, `StatusPill`, `StickyBanner`, `EmptyState`
(`#9a7000` / `#1b8c3c` / `#c43c12`), `Tree`, `Wizard` (`rgba(188,195,208,0.502)`),
`Button`, `ButtonWithIndicator` (`#e0481a` / `#c93f16`), `Modal` (теперь
`--color-background-modal`). Все новые токены показаны в витрине, раздел «Основы».

## Осталось решить

- `--granat-grey-200` = `#bbc1c9`, в файле `#bbc1c7`. Используется в 9 местах
  (`Checkbox`, `ControlList`, `Counter`, `ScrollArea`, `Switch`, `Table`) как цвет
  выключенного контрола. В файле эту роль играет `Controls/Inactive` = `#bcc3d0 50%`.
- Цвет ссылки. `Link` красится в `--color-text-brand` (`#008ae0`), в файле ссылка —
  `#0070e5`. Токен добавлен, но не подключён: иначе в интерфейсе будет два синих.
- `AppHeader` использует `--color-background-primary`; `--color-background-bar`
  (`#ffffff 88%`) потребует `backdrop-filter`.
- Полупрозрачные белые (`rgba(255,255,255,0.24…0.85)` в `ButtonPrice`, `ChoiceChip`,
  `StickyBanner`, `TableSelectionBar`) в файле не определены — оставлены локальными.

## Убрана утечка примитивов в компоненты

Было 53 обращения к `var(--granat-*)` в 26 файлах из 71. Блок `.dark` переопределяет
только `--color-*`, поэтому эти цвета в тёмной теме не менялись: дорожки прогресса
и слайдеров, выключенные контролы, фон `Snackbar` и `Tooltip`, скроллбар, точки
пагинации. Сейчас обращений ноль.

Часть ролей легла на уже существующие токены — `--color-background-inverted`
(`Snackbar`, `Tooltip`, выбранный день в `DatePicker`), `--color-text-inverted`
(`TableSelectionBar`), `--color-icons-secondary` (`Tree`), `--color-icons-tertiary`
(`ProgressCircle`, скроллбар), `--color-text-tertiary` (подписи на тёмном).

Для остальных заведено пять токенов. Светлые значения намеренно оставлены
прежними — светлая тема не изменилась ни на пиксель, изменилось только то,
что у них появился тёмный вариант:

| Токен | Светлая | Тёмная | Роль |
|---|---|---|---|
| `--color-control-track` | `#d8dce5` | `rgba(127,140,153,0.35)` | дорожка прогресса и слайдера |
| `--color-control-disabled` | `#bbc1c9` | `rgba(127,140,153,0.35)` | выключенный или недоступный контрол |
| `--color-surface-disabled` | `#d8dce5` | `rgba(127,140,153,0.25)` | недоступная поверхность (кнопка) |
| `--color-surface-hover-strong` | `#d8dce5` | `rgba(242,243,247,0.2)` | ховер чипа на вторичном фоне |
| `--color-text-link-inverted` | `#45b6fc` | `#0070e5` | ссылка на инвертированной поверхности |

Заодно `Snackbar` и `Tooltip` перестали писать `color: '#fff'` — теперь
`--color-text-inverted`, иначе в тёмной теме был бы белый текст на светлом фоне.

Регресс закрыт проверкой: `npm run check` теперь падает, если компонент
обращается к `--granat-*` / `--mgts-*` или пишет hex (кроме `#fff` — белый
от темы не зависит). Именно эта проверка нашла последние два обращения
к `--mgts-blue-300` в `Snackbar` и `StickyBanner`.
