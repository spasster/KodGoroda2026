# Общие компоненты «Сверки»

Всё, из чего собираются экраны `/`, `/pairs/:id`, `/signals`, `/form` и `/form/qr`. Источник правды по виду и подписям: `docs/design/system.md`, эталон: `docs/design/reference.html` и `docs/design/shots/`.

Импорт одной строкой:

```tsx
import { PairChip, StatusLabel, SignalBlock, Loading, LoadError } from '../../components'
```

## Правила для экранов

- Страница сама оборачивает себя в `<div className="wrap">`: оболочка даёт только шапку и `<main>`. Липкая полоса под шапкой ставит `top: var(--header-h)`.
- Стили страницы лежат рядом с ней в `*.module.css`. Цвета, размеры, радиусы и тени только из токенов (`src/styles/tokens.css`), своих hex нет. Тогда обе темы и красный бренд МГТС работают сами.
- Общие файлы не правим: `components/`, `lib/`, `app/`, `styles/`, `api/`, `live/`, `main.tsx`, `package.json`. Не хватает чего-то общего, значит пишем у себя в папке страницы и говорим об этом в отчёте.
- Новых зависимостей не ставим. Есть: `react-query`, `recharts`, `motion`, `lucide-react`, `clsx`, `qrcode`, `react-router-dom`.
- Числа, которые стоят в столбик или меняются на месте, получают класс `num` (табличные цифры). Дробные пишем через `formatNumber`: `4,6`, `3,0`, минус `−`.
- Подписи берём из словаря `system.md`. Регистр как в предложении, без эмодзи и восклицательных знаков, ничего мельче 14px.
- Загрузка и ошибка: `<Loading>` только пока `isPending`, `<LoadError query={q} />` при `isError`. Повторные запросы после событий SSE экран не перекрывают.

## Что делает оболочка, а не страница

`src/app/AppShell.tsx` уже делает это за всех:

- шапка: логотип, меню с бейджем (пары в `risk` и `watch`), лампа связи со строкой «Только что анкета S-01 за 6-й месяц», переключатель темы;
- уведомления о новых анкетах в левом нижнем углу (`Toasts.tsx`);
- при открытии `/pairs/:id` снимает метки «новое» этой пары (`markPairSeen`) и её уведомления;
- демо-пульт (`src/demo/DemoPanel.tsx`): клавиша `n` шлёт следующую анкету живого демо (сначала S-01 за 6-й месяц, потом M-01 и дальше), `Shift+D` открывает панель со всеми шестью демо-анкетами и кнопкой «Сбросить базу». В полях ввода клавиши не срабатывают.

`/form` и `/form/qr` живут без оболочки, свою шапку им собирает агент формы.

---

## Статус

### `StatusSign`

Знак статуса 12px: залитый квадрат, квадрат с обводкой, черта, кольцо месяца сбора.

| Проп | Тип | По умолчанию | |
|---|---|---|---|
| `status` | `'risk' \| 'watch' \| 'ok' \| 'collect'` | | `collect`: месяц сбора без анкет |
| `small` | `boolean` | `false` | 10px, в уведомлении |
| `className` | `string` | | |

```tsx
<StatusSign status="collect" /> Месяц 6, сбор
```

### `StatusLabel`

Знак и слово: «Пора поговорить», «Присмотреться», «Спокойно».

| Проп | Тип | По умолчанию | |
|---|---|---|---|
| `status` | `PairStatus` | | |
| `size` | `'s' \| 'm' \| 'l'` | `'m'` | `s` 15px в уведомлении, `m` 16px/600 в колонке «Сейчас», `l` 20px/600 в шапке карточки |

```tsx
<StatusLabel status={pair.status} size="l" />
```

### `PairChip` и `pairChipClass`

Плашка пары, ссылка на `/pairs/:id`. Залита для `risk`, обведена для `watch`, серая для `ok`. 44px, на проекторе 40px. `aria-label` со статусом словами. Остальные пропы уходят в `<Link>`.

| Проп | Тип | По умолчанию | |
|---|---|---|---|
| `pairId` | `string` | | |
| `status` | `PairStatus` | | |
| `size` | `'s' \| 'm'` | `'m'` | `s` 28px, в уведомлении |

```tsx
<PairChip pairId="P-05" status="risk" />
```

Для переезда плашек в итогах соберите плашку на своём элементе. `layout` вешайте на обёртку, `Link` кладите внутрь:

```tsx
<motion.span layout transition={layoutSpring}>
  <Link to={`/pairs/${id}`} className={pairChipClass(status)}>{id}</Link>
</motion.span>
```

`motion.create(Link)` с react-router 7 не годится: `Link` на каждой перерисовке собирает новый ref, motion считает элемент новым и заново проигрывает появление из `initial`.

## Важность

### `SeverityBars`, `SeverityLabel`

Три столбика как уровень сети; `SeverityLabel` добавляет слово «высокая», «средняя», «низкая».

| Проп | Тип |
|---|---|
| `severity` | `'high' \| 'medium' \| 'low'` |
| `className` | `string` |

```tsx
<SeverityLabel severity={signal.severity} />
<li><SeverityBars severity="medium" /> 3-й месяц: стажёру хуже, чем видит наставник</li>
```

## Происхождение вывода

### `SourceTag`

Метка 24px: «формула» для оценок, для `text_vs_score` «ИИ по тексту» при `analyzer: "openai"` в `/api/health` и «разбор текста» при `rules`. Анализатор компонент узнаёт сам через `useAnalyzer()`.

| Проп | Тип |
|---|---|
| `type` | `SignalType` |

```tsx
<SourceTag type={signal.type} />
```

### `Provenance`, `provenanceText`

Строка происхождения под доказательствами, 14px, со значком проверки. Текст по типу сигнала и по анализатору: «Фрагмент выделила модель…» или «Фрагмент нашёл словарь…», потом «Оценки и разрыв посчитаны формулой.» и так далее.

| Проп | Тип |
|---|---|
| `signal` | `Pick<Signal, 'type' \| 'quotes'>` |

```tsx
<Provenance signal={signal} />
provenanceText(signal, 'rules') // строка без значка
```

## Роли

### `RoleMark`

Круг стажёра, квадрат наставника. Цвет от текста (`currentColor`).

| Проп | Тип | По умолчанию | |
|---|---|---|---|
| `role` | `Role` | | |
| `size` | `8 \| 12` | `8` | 8 в таблице и подписях, 12 в легенде графика |

### `RoleLabel`

«● Стажёр S-03», «■ Наставник M-03». Без `id` просто «● Стажёр».

```tsx
<RoleLabel role="intern" id={pair.intern_id} />
```

### `PairPeople`

«● S-03 ■ M-03» рядом с ID пары, 14px `--text-2`. Для скринридера роли подписаны словами.

```tsx
<PairPeople internId={p.intern_id} mentorId={p.mentor_id} />
```

## Доказательства

### `Dumbbell`

Гантель в клетке «пара × месяц»: дорожка шкалы, перемычка между оценками, круг стажёра 11px, квадрат наставника 10px. SVG 100% ширины и 14px высоты. Цвет берёт `currentColor`, обводка маркеров `--dumbbell-bg`: клетка ставит его равным своему фону. Нет одной оценки, нет и её маркера и перемычки.

| Проп | Тип | По умолчанию | |
|---|---|---|---|
| `intern` | `number \| null` | | |
| `mentor` | `number \| null` | | |
| `scale` | `{ min, max }` | `{1, 5}` | берите `overview.scale` |
| `onInk` | `boolean` | `false` | клетка залита: дорожка `--status-risk-track` |

Цвет дорожки можно задать снаружи переменной `--dumbbell-track-color`: так делает таблица на обзоре, где залитая клетка лежит копией поверх обычной.

```tsx
// .cell-risk { background: var(--status-risk-bg); color: var(--status-risk-fg); --dumbbell-bg: var(--status-risk-bg); }
<div className={s['cell-risk']}>
  …
  <Dumbbell intern={c.intern_index} mentor={c.mentor_index} scale={o.scale} onInk={c.status === 'risk'} />
</div>
```

### `GapChain`

Цепочка «разрыв по месяцам 0,4 › 1,0 › 1,8», ячейки 32px, последнее значение залито чернилами. `null` пропускаются.

| Проп | Тип | По умолчанию | |
|---|---|---|---|
| `values` | `(number \| null)[]` | | от старого к свежему |
| `label` | `string \| null` | `'разрыв по месяцам'` | `null` убирает подпись |
| `abs` | `boolean` | `true` | по модулю; для оценок `false` |

```tsx
<GapChain values={pair.cells.map((c) => c.gap)} />
<GapChain values={[4.4, 3.8, 3.0]} label="оценка стажёра" abs={false} />
```

### `Quote` и `MarkedText`

Цитата: черта 2px слева, текст 20px в ёлочках, подчёркнутые места (`mark`) и подпись со знаком роли. Пустой текст даёт «Комментарий пустой».

| Проп | Тип | По умолчанию | |
|---|---|---|---|
| `text` | `string` | | комментарий целиком |
| `marks` | `{ start, end }[]` | `[]` | позиции по исходному тексту, как `Quote.start/end` и `CommentItem.highlights` из API |
| `role` | `Role` | | знак в подписи |
| `caption` | `ReactNode` | | «Наставник M-05, 5-й месяц» |
| `verified` | `boolean` | `false` | дописать «Сверено с анкетой дословно.» (очередь на обзоре) |
| `sentence` | `boolean` | `false` | показать только предложение с первой подсветкой (очередь на обзоре) |
| `secondary` | `boolean` | `false` | черта `--text-2`: реплика второй стороны |

```tsx
<Quote text={c.text} marks={c.highlights} role="mentor" caption="Наставник M-05, 5-й месяц" verified sentence />
```

`MarkedText` подчёркивает места в тексте без рамки цитаты, для ленты комментариев:

```tsx
<p><MarkedText text={c.text} marks={c.highlights} /></p>
```

## Сигнал и отметка HR

### `SignalBlock`

Сигнал целиком для карточки пары и экрана «С кем поговорить»: слева важность, источник, месяц; справа заголовок, объяснение, доказательства по типу (цепочка и две реплики для `gap_*`, цепочка оценок для `decline`, цитата для `text_vs_score`, ничего для `silence`), строка происхождения, «Что сделать.», флажок повтора и отметка HR. После отметки доказательства сворачиваются. Тексты сигнала не переписывает и не обрезает.

| Проп | Тип | |
|---|---|---|
| `signal` | `Signal` | главный в группе повторов |
| `pair` | `PairDetail` | нужна для реплик обеих сторон и цепочки разрыва. Без неё видна только сама цитата |
| `repeats` | `Signal[]` | повторы того же условия, `clusterRepeats(...).repeats` |

```tsx
const pair = usePair(id)
{clusterRepeats(pair.data.signals.filter(isActive)).map(({ head, repeats }) => (
  <SignalBlock key={head.key} signal={head} repeats={repeats} pair={pair.data} />
))}
```

На экране сигналов пары под рукой нет: возьмите `usePair(pairId)` на группу или передайте без `pair`.

### `ReviewControl`

Кнопки «Подтвердилось» и «Ложная тревога» одного веса, подсказка рядом. После отметки плашка с датой, для «Подтвердилось» поле «Заметка для себя» (сохраняется по потере фокуса) и тихая кнопка «Снять отметку». Отметка видна сразу, при ошибке откатывается и пишет «Отметка не сохранилась: сервер не ответил. Нажмите ещё раз.» или `detail` от бэкенда. Внутри `SignalBlock` уже есть, отдельно нужен редко.

| Проп | Тип | |
|---|---|---|
| `signal` | `Signal` | |
| `alsoKeys` | `string[]` | ключи повторов: отметка и её снятие уйдут и на них |

## Управление

### `Button`, `LinkButton`, `buttonClass`

Обычная (40px, рамка), брендовая (одно главное действие на экране) и тихая (цвет ссылки, «Снять отметку»). Значки `lucide-react` внутри получают 16px сами.

| Проп | Тип | По умолчанию | |
|---|---|---|---|
| `variant` | `'default' \| 'brand' \| 'quiet'` | `'default'` | |
| `size` | `'m' \| 's'` | `'m'` | `s` 36px |
| `busy` | `boolean` | | только `Button`: `aria-busy`, повторное нажатие игнорируется, текст не меняется |

`Button` принимает всё, что `<button>`, `type` по умолчанию `button`. `LinkButton` принимает `to` (переход внутри приложения) или `href` (внешняя ссылка; для `/form` в новой вкладке поставьте `target="_blank"`, `rel` добавится сам).

`buttonClass(variant, size)` отдаёт те же классы для своего элемента, например для `<label>` вокруг `<input type="file">`.

```tsx
<Button variant="brand" onClick={upload}><Upload aria-hidden="true" />Загрузить Excel</Button>
<LinkButton href="/form" target="_blank">Открыть форму</LinkButton>
<LinkButton to="/">К обзору</LinkButton>
```

### `Segmented`

Сегменты с `aria-pressed` в группе с подписью. Счётчик после подписи табличными цифрами.

| Проп | Тип | По умолчанию | |
|---|---|---|---|
| `label` | `string` | | подпись группы для скринридера |
| `options` | `{ value, label, count? }[]` | | |
| `value`, `onChange` | `T`, `(v: T) => void` | | |
| `size` | `'m' \| 'l'` | `'m'` | `m` 34px для фильтров, `l` 48px на всю ширину для формы |

```tsx
<Segmented label="Отметка" value={status} onChange={setStatus}
  options={[{ value: 'open', label: 'Открытые', count: 12 }, { value: 'all', label: 'Все', count: 22 }]} />
<Segmented label="Кто заполняет" size="l" value={role} onChange={setRole}
  options={[{ value: 'intern', label: 'Я стажёр' }, { value: 'mentor', label: 'Я наставник' }]} />
```

### `ThemeSwitch`

Капсула «Светлая» и «Тёмная». Уже стоит в шапке. В форме нужна одна кнопка темы 40px: соберите её на `useTheme().toggle`.

## Заголовки и состояния

### `PageHeader`

Заголовок экрана 32px/600 и пояснение 18px `--text-2`. `children` встают под пояснением.

```tsx
<PageHeader title="С кем поговорить"
  lead="Сигналы сгруппированы по парам. Сначала пары с сигналами высокой важности. Сигнал предлагает разговор, решение за вами." />
```

### `SectionHead`

Заголовок раздела 20px/600, рядом пояснение 14px, справа `aside` (легенда, ссылка). `id` ставится на `h2` для `aria-labelledby`.

```tsx
<SectionHead id="board" title="Пары по месяцам" note="Средняя оценка по шкале 1–5" aside={<Legend />} />
```

### `EmptyState`

Пустой экран говорит, что сделать: заголовок 24px, текст 16px, кнопки. Тексты для каждого места в `system.md`, «Пустые состояния».

| Проп | Тип |
|---|---|
| `title` | `string`, необязателен |
| `text` | `ReactNode` |
| `actions` | `ReactNode`, кнопки |

```tsx
<EmptyState title="Пары P-09 нет" text="Проверьте ID или вернитесь к обзору." actions={<LinkButton to="/">К обзору</LinkButton>} />
```

### `ErrorBanner`, `LoadError`, `loadErrorText`

Плашка с рамкой, значок, `role="alert"`, кнопка «Повторить». Без красного и без извинений.

`LoadError` берёт результат `useQuery` целиком и сам выбирает текст: «Сервер не отвечает. Данные на экране от 14:02…», если данные уже были, «Не удалось загрузить данные», если не было, и `detail` бэкенда для 4xx.

```tsx
const overview = useOverview()
if (overview.isError && !overview.data) return <div className="wrap"><LoadError query={overview} /></div>
// данные есть, но обновить не вышло: плашка над экраном
{overview.isError && overview.data && <LoadError query={overview} />}
<ErrorBanner title={err.message} />  // 422 при отметке или анкете
```

### `Loading`, `Skeleton`, `useDelayed`

Первые 300 мс пусто, потом серые блоки `--sunken` по форме экрана и «Загружаем данные…». Контейнер с `aria-busy`.

| Проп | Тип | По умолчанию | |
|---|---|---|---|
| `variant` | `'overview' \| 'pair' \| 'list'` | `'list'` | готовые формы: фраза, плашки и таблица; ID и график; заголовок и строки |
| `children` | `ReactNode` | | свои блоки из `Skeleton` вместо готовых |
| `delay` | `number` | `300` | |

```tsx
if (overview.isPending) return <div className="wrap"><Loading variant="overview" /></div>
<Loading><Skeleton width={180} height={56} /><Skeleton height={300} /></Loading>
```

`Skeleton` принимает `width`, `height`, `radius`, `style`. `useDelayed(ms)` возвращает `true` через `ms` после монтирования.

---

## Хуки и функции рядом

Не компоненты, но без них экраны не собрать.

**Данные, `src/api/queries.ts`.** `useOverview()`, `usePair(id)`, `useSignals({ status, active, severity })` (важность фильтруется на клиенте), `useSurvey()`, `usePeople()`, `useHealth()`, `useAnalyzer()` (`'model'` или `'rules'`), `useReview()` (оптимистичная отметка с откатом), `useIngest()`. События SSE сами инвалидируют нужные запросы.

**Живые события, `useLive()` из `src/live/useLive.ts`.** `status` связи, `last` (последняя анкета), `notifications`, `isFreshCell(pairId, month)` и `isFreshResponse(pairId, role, month)` для метки «новое» и кольца бренда, `markPairSeen(pairId)`. Метка держится, пока HR не откроет пару: оболочка снимает её сама.

**Правила, `src/lib/rules.ts`** (раздел «Правила, которые фронт считает сам» в `system.md`). `isActive`, `isOpen`, `compareSignals`, `mainSignal(signals)` (строка-причина под ID пары), `sortPairsByPriority(pairIds, signals)` (порядок плашек, очереди и экрана сигналов), `clusterRepeats(signals)`, `collectMonth(people, months)`, `gapDirection(cell)` («стажёру хуже», «наставник недоволен», «нет анкеты стажёра», по сигналу разрыва в клетке), `gapLowSide(cell)`, `isGapNotable(cell)`, `highGapPoints(scale, th)` (порог 1,6 балла), `calendarMonthName(month, recent)` («ноябрь»), `sentenceAround`. Пороги приходят из `/api/survey`: хук `useThresholds()`, пока анкета грузится, `DEFAULT_THRESHOLDS`.

**Подписи и числа, `src/lib/format.ts`.** `formatNumber` («4,6», «−0,5», «—»), `formatDelta` («+1,8»), `formatCount(n, WORDS.pair)` («4 пары»), `plural`, `monthOrdinal` («5-й месяц»), `formatRelative` («только что», «12 ноября»), `formatClock` («14:02»), `formatDayTime` («26 ноября в 14:05»), `sourceLabel` («через форму»), словари `PAIR_STATUS_LABEL`, `SEVERITY_LABEL`, `ROLE_TITLE`, `ROLE_LABEL`, `TOPIC_LABEL`.

**Движение, `src/lib/motion.ts`** (раздел «Анимации»). `ease`, `dur`, `layoutSpring`; `arrival` с таймингом после новой анкеты (клетка 0,3 с, заливка 1,1 с, «Сейчас», фраза и плашки 1,5 с, числа 1,7 с, черта 2,4 с); `stagger.cell(month)`, `stagger.chip(i)`, `stagger.chartPoint(i)` для первой загрузки; готовые `variants` (`fade`, `toast`, `swap`, `headline`, `chip`, `collapse`, `tip`) для `initial="hidden" animate="shown" exit="gone"`; `roll` для перекатки чисел итогов. `MotionConfig reducedMotion="user"` стоит в `main.tsx`, в CSS все длительности при reduce 1 мс. Где итог нужен сразу без проявления, берите `useReduced()` и `transition(reduce, t)`.

**Тема, `src/lib/theme.ts`.** `useTheme()` даёт `pref`, `resolved` (`'light' | 'dark'`), `setPref`, `toggle`. Цвета графиков задавайте через `var(--…)`, тогда тема меняется без перерисовки.
