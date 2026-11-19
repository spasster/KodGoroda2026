# Общие компоненты

Экраны в v2 собраны в своих папках (`src/pages/*`) по `docs/design/v2.md`. Здесь осталось только то, что нужно больше чем одному месту.

```tsx
import { EmptyState, ErrorBanner, LinkButton, LoadError, Loading, Skeleton } from '../../components'
```

| Компонент | Что делает | Где |
|---|---|---|
| `LinkButton` | Ссылка внутри приложения в виде кнопки. `variant="brand"` даёт синюю заливку, без него кнопка серая на `--sunken`. | 404 в `app/router.tsx` |
| `EmptyState` | Белая карточка: короткий заголовок и кнопки. | 404 в `app/router.tsx` |
| `ErrorBanner` | Белая карточка с `role="alert"`: заголовок, необязательная строка и «Повторить». | ошибка импорта Excel на пустом обзоре |
| `LoadError` | `ErrorBanner` по результату `useQuery`: «Не удалось загрузить данные» или «Сервер не отвечает» со временем данных на экране, `detail` бэкенда для 4xx. | обзор |
| `Loading`, `Skeleton` | Первые 300 мс пусто, потом серые блоки по форме экрана. `Loading` только пока `isPending`. | обзор |

## Оболочка

`src/app` делает общее для `/`, `/pairs/:id` и `/signals`:

- шапка: знак МГТС, «Стажировки», меню «Обзор», «Сигналы N», «Форма ↗», точка связи с подсказкой «Обновлено в 23:40», кнопка темы;
- уведомление о новой анкете в правом нижнем углу (`Toasts.tsx`), исчезает через 8 секунд;
- при открытии пары снимает её метки «новое» и уведомления;
- статус пары: `Dot` и `StatusText` из `app/status.tsx`, подписи в `PAIR_STATUS_LABEL` (`lib/format.ts`);
- демо-пульт (`src/demo`): клавиша `n` шлёт следующую демо-анкету, `Shift+D` открывает панель со сбросом базы.

`/form` и `/form/qr` живут без оболочки.

## Рядом

- `src/lib/format.ts`: `formatNumber` («4,6», «—»), `plural`, `formatCount`, `monthsPhrase` («4–5-й месяцы»), `formatClock`, `personName`, подписи ролей, важности и статусов.
- `src/lib/rules.ts`: `isActive`, `isOpen`, `compareSignals`, `collectMonth`, `calendarMonthName`, `sentenceAround`, `DEFAULT_THRESHOLDS`.
- `src/lib/motion.ts`: `ease`, `dur`, варианты `toast`, `swap`, `collapse`, `roll` для итогов, `useReduced()`.
- `src/lib/theme.ts`: `useTheme()`.
- Цвета, шрифты, радиусы и тени только из `src/styles/tokens.css`.
