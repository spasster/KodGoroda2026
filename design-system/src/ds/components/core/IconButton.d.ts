import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';

/** Square icon-only button for toolbars and compact actions. */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon name from the MGTS icon set. */
  icon: IconName;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'xs' | 's' | 'm' | 'l';
  disabled?: boolean;
  /** Accessible label (icon-only buttons need one). */
  ariaLabel?: string;
}

export declare function IconButton(props: IconButtonProps): JSX.Element;
export default IconButton;
