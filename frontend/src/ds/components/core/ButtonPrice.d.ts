import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
/** CTA button with a price label (Granat Button-Price) — tariffs/checkout. */
export interface ButtonPriceProps {
  label: string;
  price: string;
  /** Period suffix, e.g. «/мес». */
  period?: string;
  variant?: 'primary' | 'secondary';
  size?: 'm' | 'l';
  iconLeft?: IconName;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function ButtonPrice(props: ButtonPriceProps): JSX.Element;
export default ButtonPrice;
