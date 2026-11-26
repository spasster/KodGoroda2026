import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
export interface DroplistItem {
  id: string | number;
  label: string;
  description?: string;
  icon?: IconName;
  meta?: string;
  disabled?: boolean;
}
export interface DroplistProps {
  label?: string;
  placeholder?: string;
  items: DroplistItem[];
  value?: string | number | null;
  onChange?: (value: string | number) => void;
  size?: 's' | 'm' | 'l';
  disabled?: boolean;
  width?: number | string;
  style?: React.CSSProperties;
}
export declare function Droplist(props: DroplistProps): JSX.Element;
export default Droplist;
