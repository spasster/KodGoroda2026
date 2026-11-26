import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
/** Inline text link in МГТС blue. */
export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: 'primary' | 'secondary' | 'inverted';
  underline?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  children?: React.ReactNode;
}
export declare function Link(props: LinkProps): JSX.Element;
export default Link;
