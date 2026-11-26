import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
import { FilterOption } from './FilterChip';
export interface FilterDefinition {
  id: string;
  label: string;
  icon?: IconName;
  options?: FilterOption[];
}
export interface FilterBarProps {
  filters: FilterDefinition[];
  /** Карта id фильтра → выбранное значение. */
  values?: Record<string, string | number>;
  /** Начальные значения для неконтролируемого режима. */
  defaultValues?: Record<string, string | number>;
  onChange?: (values: Record<string, string | number>) => void;
  onReset?: () => void;
  resetLabel?: string;
  /** Счётчик применённых фильтров слева. */
  showCount?: boolean;
  style?: React.CSSProperties;
}
export declare function FilterBar(props: FilterBarProps): JSX.Element;
export default FilterBar;
