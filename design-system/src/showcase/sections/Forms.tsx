import React from "react";
import { Demo, Group, Label } from "../kit";
import { Attach } from "../../ds/components/forms/Attach";
import { Autocomplete } from "../../ds/components/forms/Autocomplete";
import { Checkbox } from "../../ds/components/forms/Checkbox";
import { ChoiceChip, ChoiceChipGroup } from "../../ds/components/forms/ChoiceChip";
import { CodeInput } from "../../ds/components/forms/CodeInput";
import { ControlList } from "../../ds/components/forms/ControlList";
import { DatePicker } from "../../ds/components/forms/DatePicker";
import { Droplist } from "../../ds/components/forms/Droplist";
import { FileUpload } from "../../ds/components/forms/FileUpload";
import { FormChip } from "../../ds/components/forms/FormChip";
import { InlineEdit } from "../../ds/components/forms/InlineEdit";
import { Radio } from "../../ds/components/forms/Radio";
import { RangeSlider } from "../../ds/components/forms/RangeSlider";
import { SearchInput } from "../../ds/components/forms/SearchInput";
import { Select } from "../../ds/components/forms/Select";
import { Slider } from "../../ds/components/forms/Slider";
import { Stepper } from "../../ds/components/forms/Stepper";
import { Switch } from "../../ds/components/forms/Switch";
import { Textarea } from "../../ds/components/forms/Textarea";
import { TextField } from "../../ds/components/forms/TextField";

const CITIES = ["Москва", "Санкт-Петербург", "Новосибирск", "Екатеринбург", "Казань"];

export function Forms() {
  const [text, setText] = React.useState("");
  const [area, setArea] = React.useState("");
  const [auto, setAuto] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [select, setSelect] = React.useState("");
  const [check, setCheck] = React.useState(true);
  const [radio, setRadio] = React.useState("a");
  const [toggle, setToggle] = React.useState(true);
  const [count, setCount] = React.useState(3);
  const [slider, setSlider] = React.useState(40);
  const [range, setRange] = React.useState<[number, number]>([300, 900]);
  const [date, setDate] = React.useState("");
  const [period, setPeriod] = React.useState<{ from?: string; to?: string }>({});
  const [code, setCode] = React.useState("");
  const [inline, setInline] = React.useState("Название проекта");
  const [drop, setDrop] = React.useState<string | number | null>(null);
  const [chips, setChips] = React.useState<Array<string | number> | string | number | null>(["mail"]);
  const [list, setList] = React.useState<Array<string | number> | string | number | null>(["push"]);

  return (
    <Group id="forms" title="Формы" note="Группа forms — ввод и выбор значений.">
      <Demo name="TextField" path="components/forms/TextField">
        <div className="sc-w280">
          <TextField label="Название" placeholder="Введите название" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="sc-w280">
          <TextField label="С подсказкой" description="Не больше 60 символов" placeholder="Например, «Договор»" />
        </div>
        <div className="sc-w280">
          <TextField label="С ошибкой" error="Поле обязательно" value="" readOnly />
        </div>
        <div className="sc-w280">
          <TextField label="С иконкой" iconLeft="SearchSize24StyleOutline" placeholder="Поиск" />
        </div>
        <div className="sc-w280">
          <TextField label="Недоступно" disabled value="Только чтение" />
        </div>
      </Demo>

      <Demo name="Textarea" path="components/forms/Textarea">
        <div className="sc-w360">
          <Textarea
            label="Описание"
            placeholder="Что нужно сделать"
            rows={4}
            maxLength={240}
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </div>
        <div className="sc-w360">
          <Textarea label="С ошибкой" error="Слишком коротко" rows={3} value="ок" readOnly />
        </div>
      </Demo>

      <Demo name="Select" path="components/forms/Select">
        <div className="sc-w280">
          <Select label="Город" placeholder="Выберите" options={CITIES} value={select} onChange={setSelect} />
        </div>
        <div className="sc-w280">
          <Select label="С ошибкой" options={CITIES} error="Не выбрано" />
        </div>
        <div className="sc-w280">
          <Select label="Недоступен" options={CITIES} disabled />
        </div>
      </Demo>

      <Demo name="Droplist" path="components/forms/Droplist" note="новое в v2 · строки с описанием и иконкой">
        <div className="sc-w360">
          <Droplist
            label="Тип документа"
            placeholder="Не выбран"
            value={drop}
            onChange={setDrop}
            items={[
              { id: "act", label: "Акт", description: "Приёмка работ", icon: "SignatureSize24StyleOutline" },
              { id: "invoice", label: "Счёт", description: "На оплату", icon: "ChequeSize24StyleOutline", meta: "PDF" },
              { id: "contract", label: "Договор", description: "Основной", icon: "DocumentSize24StyleOutline" },
              { id: "archive", label: "Архивный", disabled: true },
            ]}
          />
        </div>
      </Demo>

      <Demo name="Autocomplete" path="components/forms/Autocomplete">
        <div className="sc-w280">
          <Autocomplete label="Город" placeholder="Начните вводить" options={CITIES} value={auto} onChange={setAuto} />
        </div>
      </Demo>

      <Demo name="SearchInput" path="components/forms/SearchInput">
        <div className="sc-w280">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch("")} placeholder="Поиск" />
        </div>
        <div className="sc-w280">
          <SearchInput filled={false} size="s" placeholder="Контурный, размер s" readOnly />
        </div>
      </Demo>

      <Demo name="Checkbox · Radio · Switch" path="components/forms/">
        <div className="sc-stack">
          <Label>Checkbox</Label>
          <Checkbox checked={check} onChange={setCheck} label="Согласен" />
          <Checkbox label="Недоступен" disabled />
        </div>
        <div className="sc-stack">
          <Label>Radio</Label>
          <Radio name="demo" value="a" checked={radio === "a"} onChange={() => setRadio("a")} label="Первый" />
          <Radio name="demo" value="b" checked={radio === "b"} onChange={() => setRadio("b")} label="Второй" />
        </div>
        <div className="sc-stack">
          <Label>Switch</Label>
          <Switch checked={toggle} onChange={setToggle} label="Уведомления" />
          <Switch label="Недоступен" disabled />
        </div>
      </Demo>

      <Demo name="ControlList" path="components/forms/ControlList" note="новое в v2 · список с контролами" column>
        <div className="sc-row" style={{ alignItems: "flex-start" }}>
          <div className="sc-grow">
            <Label>control=checkbox · position=right</Label>
            <ControlList
              position="right"
              value={list}
              onChange={setList}
              items={[
                { id: "push", title: "Push-уведомления", description: "На мобильное устройство" },
                { id: "mail", title: "Почта", description: "Ежедневный дайджест", meta: "по умолчанию" },
                { id: "sms", title: "SMS", description: "Только критичные", disabled: true },
              ]}
            />
          </div>
          <div className="sc-grow">
            <Label>control=switch · divider=false</Label>
            <ControlList
              control="switch"
              divider={false}
              items={[
                { id: "a", title: "Автосохранение" },
                { id: "b", title: "Тёмная тема" },
              ]}
            />
          </div>
        </div>
      </Demo>

      <Demo name="ChoiceChip · ChoiceChipGroup" path="components/forms/ChoiceChip" note="новое в v2" column>
        <div className="sc-row">
          <ChoiceChip>Обычный</ChoiceChip>
          <ChoiceChip selected>Выбранный</ChoiceChip>
          <ChoiceChip icon="FlagSize24StyleOutline" count={4}>
            Со счётчиком
          </ChoiceChip>
          <ChoiceChip size="s">Маленький</ChoiceChip>
          <ChoiceChip disabled>Недоступный</ChoiceChip>
        </div>
        <Label>mode=multi</Label>
        <ChoiceChipGroup
          mode="multi"
          value={chips}
          onChange={setChips}
          options={[
            { id: "mail", label: "Почта", icon: "MailSize24StyleOutline" },
            { id: "chat", label: "Чат", icon: "ChatSize24StyleOutline", count: 2 },
            { id: "call", label: "Звонок", icon: "CallSize24StyleOutline" },
            { id: "none", label: "Не беспокоить", disabled: true },
          ]}
        />
      </Demo>

      <Demo name="FormChip" path="components/forms/FormChip">
        <FormChip onRemove={() => undefined}>anna@example.ru</FormChip>
        <FormChip icon="UserSize24StyleOutline" onRemove={() => undefined}>
          Соня П.
        </FormChip>
        <FormChip invalid onRemove={() => undefined}>
          неверный адрес
        </FormChip>
        <FormChip disabled>Заблокирован</FormChip>
      </Demo>

      <Demo name="Stepper · InlineEdit · CodeInput" path="components/forms/">
        <div className="sc-stack">
          <Label>Stepper</Label>
          <Stepper value={count} onChange={setCount} min={0} max={20} />
        </div>
        <div className="sc-stack">
          <Label>InlineEdit</Label>
          <InlineEdit value={inline} onChange={setInline} />
        </div>
        <div className="sc-stack">
          <Label>CodeInput</Label>
          <CodeInput length={4} value={code} onChange={setCode} />
        </div>
      </Demo>

      <Demo name="Slider · RangeSlider" path="components/forms/" column>
        <div className="sc-w360">
          <Label>Slider</Label>
          <Slider value={slider} onChange={setSlider} showValue />
        </div>
        <div className="sc-w360">
          <Label>RangeSlider</Label>
          <RangeSlider value={range} onChange={setRange} min={0} max={1500} step={50} showValues format={(v) => `${v} ₽`} />
        </div>
      </Demo>

      <Demo name="Attach" path="components/forms/Attach" note="новое в v2 · Dropzone + AttachFile" column>
        <Attach.Dropzone label="Документы" />
        <Attach.File name="Договор №14-2026.pdf" ext="PDF" size="2,4 МБ" onDownload={() => undefined} onRemove={() => undefined} />
        <Attach.File name="Смета.xlsx" state="loading" progress={62} />
        <Attach.File name="Скан паспорта.png" state="error" error="Превышен размер файла" onRemove={() => undefined} />
      </Demo>

      <Demo name="FileUpload" path="components/forms/FileUpload" column>
        <FileUpload
          label="Приложите файлы"
          files={[
            { name: "Отчёт.docx", size: "1,1 МБ" },
            { name: "Фото.jpg", progress: 45 },
            { name: "Архив.zip", error: "Формат не поддерживается" },
          ]}
          onRemove={() => undefined}
        />
      </Demo>

      <Demo name="DatePicker" path="components/forms/DatePicker" note="новое · одна дата и период" column popover>
        <div className="sc-row">
          <div className="sc-stack">
            <Label>Одна дата</Label>
            <DatePicker label="Дата подписания" value={date} onChange={(v) => setDate(v as string)} />
          </div>
          <div className="sc-stack">
            <Label>Период с пресетами</Label>
            <DatePicker mode="range" label="Период" value={period} onChange={(v) => setPeriod(v as typeof period)} />
          </div>
        </div>
        <div className="sc-swatch-value">
          Дата: {date || "—"} · Период: {period.from || "—"} — {period.to || "—"}
        </div>
      </Demo>
    </Group>
  );
}
