import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
/** Full-width inline message banner with soft tonal background. */
export interface BannerProps {
  tone?: 'info' | 'positive' | 'warning' | 'negative' | 'neutral';
  title?: string;
  description?: string;
  icon?: IconName;
  /** Action node (e.g. a Button or Link). */
  action?: React.ReactNode;
  onClose?: () => void;
  style?: React.CSSProperties;
}
export declare function Banner(props: BannerProps): JSX.Element;
export default Banner;
