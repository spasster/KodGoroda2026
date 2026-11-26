import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
export interface FilterOption {
  id: string | number;
  label: string;
  count?: number;
}
export interface FilterChipProps {
  /** Подпись, пока значение не выбрано. */
  label: string;
  value?: string | number | null;
  /** Если задано — по клику раскрывается список выбора. */
  options?: FilterOption[];
  icon?: IconName;
  onChange?: (value: string | number) => void;
  /** Показывает крестик сброса у активного чипа. */
  onRemove?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function FilterChip(props: FilterChipProps): JSX.Element;
export default FilterChip;
