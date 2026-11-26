import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
/** Selectable pill chip; selected state fills МГТС blue. */
export interface ChipProps {
  children?: React.ReactNode;
  icon?: IconName;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Render a remove (×) control. */
  onRemove?: () => void;
  size?: 's' | 'm';
  style?: React.CSSProperties;
}
export declare function Chip(props: ChipProps): JSX.Element;
export default Chip;
