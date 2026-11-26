import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
/** Input token chip for multi-value fields (recipients, tags). */
export interface FormChipProps {
  children?: React.ReactNode;
  icon?: IconName;
  onRemove?: () => void;
  /** Mark the value as invalid (negative border). */
  invalid?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function FormChip(props: FormChipProps): JSX.Element;
export default FormChip;
