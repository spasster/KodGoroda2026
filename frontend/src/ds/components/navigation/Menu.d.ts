import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
export interface MenuItem {
  label?: string;
  icon?: IconName;
  onClick?: () => void;
  tone?: 'default' | 'negative';
  disabled?: boolean;
  /** Render a separator line instead of an item. */
  divider?: boolean;
  shortcut?: string;
}
/** Floating option list / context menu (Droplist). */
export interface MenuProps {
  items: MenuItem[];
  style?: React.CSSProperties;
}
export declare function Menu(props: MenuProps): JSX.Element;
export default Menu;
