import * as React from 'react';
export interface ControlListItem {
  id: string | number;
  title: string;
  description?: string;
  /** Правое значение в строке (например «по умолчанию»). */
  meta?: string;
  indeterminate?: boolean;
  disabled?: boolean;
}
export interface ControlListProps {
  items: ControlListItem[];
  control?: 'checkbox' | 'radio' | 'switch';
  size?: 's' | 'm' | 'l';
  /** Сторона, с которой стоит контрол. */
  position?: 'left' | 'right';
  value?: Array<string | number> | string | number | null;
  onChange?: (value: Array<string | number> | string | number | null) => void;
  divider?: boolean;
  style?: React.CSSProperties;
}
export declare function ControlList(props: ControlListProps): JSX.Element;
export default ControlList;
