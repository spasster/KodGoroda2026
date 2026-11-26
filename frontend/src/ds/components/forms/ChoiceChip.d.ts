import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
export interface ChoiceChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: IconName;
  count?: number;
  size?: 's' | 'm';
  children?: React.ReactNode;
}
export interface ChoiceChipOption {
  id: string | number;
  label: string;
  icon?: IconName;
  count?: number;
  disabled?: boolean;
}
export interface ChoiceChipGroupProps {
  options: ChoiceChipOption[];
  /** uni — как радиогруппа, multi — как набор чекбоксов. */
  mode?: 'uni' | 'multi';
  value?: Array<string | number> | string | number | null;
  onChange?: (value: Array<string | number> | string | number | null) => void;
  size?: 's' | 'm';
  style?: React.CSSProperties;
}
export declare function ChoiceChip(props: ChoiceChipProps): JSX.Element;
export declare function ChoiceChipGroup(props: ChoiceChipGroupProps): JSX.Element;
export default ChoiceChip;
