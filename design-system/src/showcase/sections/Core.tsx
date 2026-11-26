import React from "react";
import { Demo, Group, Label } from "../kit";
import { Button } from "../../ds/components/core/Button";
import { ButtonPrice } from "../../ds/components/core/ButtonPrice";
import { ButtonWithIndicator } from "../../ds/components/core/ButtonWithIndicator";
import { BottomButton } from "../../ds/components/core/BottomButton";
import { Chip } from "../../ds/components/core/Chip";
import { IconButton } from "../../ds/components/core/IconButton";
import { IconButtonSet } from "../../ds/components/core/IconButtonSet";
import { Link } from "../../ds/components/core/Link";
import { SegmentedControl } from "../../ds/components/core/SegmentedControl";
import { Spinner } from "../../ds/components/core/Spinner";

export function Core() {
  const [seg, setSeg] = React.useState("week");
  const [chip, setChip] = React.useState(true);
  const [tool, setTool] = React.useState<string | number | null>("list");

  return (
    <Group id="core" title="Кнопки и действия" note="Группа core — основные управляющие элементы.">
      <Demo name="Button" path="components/core/Button" note="variant × size × иконки" column>
        <div className="sc-row">
          <Button>Основная</Button>
          <Button variant="secondary">Вторичная</Button>
          <Button variant="ghost">Призрачная</Button>
          <Button variant="negative">Опасная</Button>
          <Button disabled>Недоступна</Button>
        </div>
        <div className="sc-row">
          <Button size="xs">xs</Button>
          <Button size="s">s</Button>
          <Button size="m">m</Button>
          <Button size="l">l</Button>
        </div>
        <div className="sc-row">
          <Button iconLeft="PlusSize24StyleOutline">С иконкой слева</Button>
          <Button variant="secondary" iconRight="ArrowRightSize24StyleOutline">
            С иконкой справа
          </Button>
        </div>
      </Demo>

      <Demo name="ButtonWithIndicator" path="components/core/ButtonWithIndicator" note="новое в v2 · счётчик или точка">
        <ButtonWithIndicator count={12}>Уведомления</ButtonWithIndicator>
        <ButtonWithIndicator type="secondary" count={3} icon="MailSize24StyleOutline">
          Письма
        </ButtonWithIndicator>
        <ButtonWithIndicator type="ghost" dot>
          Есть новое
        </ButtonWithIndicator>
        <ButtonWithIndicator type="negative" count={2}>
          Ошибки
        </ButtonWithIndicator>
        <ButtonWithIndicator size={28} count={9}>
          28
        </ButtonWithIndicator>
      </Demo>

      <Demo name="ButtonPrice" path="components/core/ButtonPrice">
        <ButtonPrice label="Подключить" price="750 ₽" period="/мес" />
        <ButtonPrice label="Продлить" price="1 200 ₽" variant="secondary" size="l" />
      </Demo>

      <Demo name="IconButton" path="components/core/IconButton">
        <IconButton icon="SearchSize24StyleOutline" ariaLabel="Поиск" />
        <IconButton icon="EditSize24StyleOutline" variant="secondary" ariaLabel="Изменить" />
        <IconButton icon="DeleteSize24StyleOutline" variant="ghost" ariaLabel="Удалить" />
        <IconButton icon="SettingsSize24StyleOutline" size="s" ariaLabel="Настройки" />
        <IconButton icon="MoreSize24StyleOutline" variant="ghost" disabled ariaLabel="Ещё" />
      </Demo>

      <Demo name="IconButtonSet" path="components/core/IconButtonSet" note="новое в v2 · общий контур, выбор одного">
        <IconButtonSet
          value={tool}
          onChange={setTool}
          items={[
            { id: "list", icon: "ChecklistSize24StyleOutline", title: "Список" },
            { id: "table", icon: "TableSize24StyleOutline", title: "Таблица" },
            { id: "filter", icon: "FilterSize24StyleOutline", title: "Фильтр" },
          ]}
        />
        <IconButtonSet
          size={36}
          dividers={false}
          items={[
            { id: "zoom-in", icon: "ZoomInSize24StyleOutline", title: "Приблизить" },
            { id: "zoom-out", icon: "ZoomOutSize24StyleFill", title: "Отдалить" },
          ]}
        />
      </Demo>

      <Demo name="Chip" path="components/core/Chip">
        <Chip selected={chip} onClick={() => setChip((v) => !v)}>
          Переключается
        </Chip>
        <Chip icon="UserSize24StyleOutline">С иконкой</Chip>
        <Chip onRemove={() => undefined}>С удалением</Chip>
        <Chip size="s">Маленький</Chip>
        <Chip disabled>Недоступен</Chip>
      </Demo>

      <Demo name="SegmentedControl" path="components/core/SegmentedControl">
        <SegmentedControl
          value={seg}
          onChange={setSeg}
          segments={[
            { value: "day", label: "День" },
            { value: "week", label: "Неделя" },
            { value: "month", label: "Месяц" },
          ]}
        />
        <SegmentedControl size="s" segments={["Все", "Мои", "Архив"]} value="Все" />
      </Demo>

      <Demo name="Link" path="components/core/Link">
        <Link href="#core">Обычная ссылка</Link>
        <Link href="#core" variant="secondary">
          Вторичная
        </Link>
        <Link href="#core" underline>
          С подчёркиванием
        </Link>
        <Link href="#core" iconRight="ArrowRightSize24StyleOutline">
          Со стрелкой
        </Link>
      </Demo>

      <Demo name="Spinner" path="components/core/Spinner">
        <Spinner size="s" />
        <Spinner size="m" />
        <Spinner size="l" />
        <Spinner size="xl" />
        <Spinner tone="secondary" />
      </Demo>

      <Demo name="BottomButton" path="components/core/BottomButton" note="новое в v2 · панель действий формы" column>
        <Label>align=right · с подсказкой</Label>
        <BottomButton hint="Все поля заполнены">
          <Button variant="ghost">Отмена</Button>
          <Button>Сохранить</Button>
        </BottomButton>
        <Label>align=between · без тени</Label>
        <BottomButton align="left" elevated={false}>
          <Button variant="secondary">Назад</Button>
          <Button>Далее</Button>
        </BottomButton>
      </Demo>
    </Group>
  );
}
