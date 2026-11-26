import * as React from 'react';
/** Дата в формате YYYY-MM-DD. */
export type DateISO = string;
export interface DateRange {
  from?: DateISO;
  to?: DateISO;
}
export interface DatePickerProps {
  mode?: 'single' | 'range';
  label?: string;
  placeholder?: string;
  /** DateISO для single, DateRange для range. */
  value?: DateISO | DateRange | null;
  onChange?: (value: DateISO | DateRange) => void;
  /** Границы выбора, YYYY-MM-DD. */
  min?: DateISO;
  max?: DateISO;
  /** Быстрые пресеты периода; по умолчанию включены в режиме range. */
  presets?: boolean;
  disabled?: boolean;
  width?: number | string;
  style?: React.CSSProperties;
}
export declare function DatePicker(props: DatePickerProps): JSX.Element;
export default DatePicker;
