import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';

/** Single-line text input with label, description and error states. */
export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Helper text under the field. */
  description?: string;
  /** Error message — replaces description and turns the border negative. */
  error?: string;
  disabled?: boolean;
  size?: 's' | 'm' | 'l';
  iconLeft?: IconName;
  iconRight?: IconName;
  type?: string;
}

export declare function TextField(props: TextFieldProps): JSX.Element;
export default TextField;
