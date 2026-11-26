import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';

/**
 * MGTS primary action button (Granat 2, МГТС blue).
 * @startingPoint section="Core" subtitle="Primary / secondary / ghost button" viewport="700x140"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. @default "primary" */
  variant?: 'primary' | 'secondary' | 'ghost' | 'negative';
  /** Control height. @default "m" */
  size?: 'xs' | 's' | 'm' | 'l';
  /** Leading icon name (from the MGTS icon set). */
  iconLeft?: IconName;
  /** Trailing icon name. */
  iconRight?: IconName;
  disabled?: boolean;
  /** Stretch to container width. */
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export declare function Button(props: ButtonProps): JSX.Element;
export default Button;
