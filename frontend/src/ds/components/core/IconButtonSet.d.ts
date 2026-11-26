import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
export interface IconButtonSetItem {
  id: string | number;
  icon: IconName;
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
}
export interface IconButtonSetProps {
  items: IconButtonSetItem[];
  size?: number;
  value?: string | number | null;
  onChange?: (value: string | number | null) => void;
  dividers?: boolean;
  style?: React.CSSProperties;
}
export declare function IconButtonSet(props: IconButtonSetProps): JSX.Element;
export default IconButtonSet;
