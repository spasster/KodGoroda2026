import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
export interface ContextMenuItem {
  id?: string | number;
  label?: string;
  icon?: IconName;
  /** Подпись горячей клавиши справа, например «⌘C». */
  shortcut?: string;
  tone?: 'default' | 'negative';
  disabled?: boolean;
  /** Разделитель вместо пункта. */
  divider?: boolean;
  onClick?: () => void;
}
export interface ContextMenuProps {
  open: boolean;
  /** Координаты курсора (clientX / clientY). */
  x?: number;
  y?: number;
  items: ContextMenuItem[];
  onSelect?: (id: string | number) => void;
  onClose?: () => void;
  width?: number;
  style?: React.CSSProperties;
}
export interface UseContextMenu<T = any> {
  open: boolean;
  x: number;
  y: number;
  /** Данные строки или объекта, по которому кликнули. */
  payload: T | null;
  close: () => void;
  /** Обработчик onContextMenu. */
  openAt: (event: React.MouseEvent, payload?: T) => void;
  /** Обработчик клика по кнопке «…» — меню встаёт под кнопкой. */
  openUnder: (event: React.MouseEvent, payload?: T) => void;
}
export declare function ContextMenu(props: ContextMenuProps): JSX.Element | null;
export declare function useContextMenu<T = any>(): UseContextMenu<T>;
export default ContextMenu;
