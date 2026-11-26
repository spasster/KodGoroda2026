import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
export interface ButtonWithIndicatorProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  type?: 'primary' | 'secondary' | 'ghost' | 'negative';
  size?: 28 | 36 | 44 | 52;
  /** Числовой счётчик справа от подписи. */
  count?: number;
  /** Точка-нотификация в углу кнопки. */
  dot?: boolean;
  icon?: IconName;
  children?: React.ReactNode;
}
export declare function ButtonWithIndicator(props: ButtonWithIndicatorProps): JSX.Element;
export default ButtonWithIndicator;
