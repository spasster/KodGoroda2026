import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
/** Left-sidebar navigation row — icon, label, optional count badge. */
export interface SidebarNavProps {
  icon?: IconName;
  label: string;
  active?: boolean;
  /** Trailing count badge. */
  badge?: number | string;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function SidebarNav(props: SidebarNavProps): JSX.Element;
export default SidebarNav;
