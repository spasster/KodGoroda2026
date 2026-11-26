import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
export interface TableSelectionAction {
  label: string;
  icon?: IconName;
  onClick?: () => void;
}
export interface TableSelectionBarProps {
  count?: number;
  /** Подпись после счётчика, например «документа выбрано». */
  label?: string;
  actions?: TableSelectionAction[];
  onCancel?: () => void;
  style?: React.CSSProperties;
}
export declare function TableSelectionBar(props: TableSelectionBarProps): JSX.Element;
export default TableSelectionBar;
