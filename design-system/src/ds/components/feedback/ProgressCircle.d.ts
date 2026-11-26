import * as React from 'react';
export interface ProgressCircleProps {
  /** 0–100. */
  value?: number;
  size?: 's' | 'm' | 'l';
  /** Произвольный диаметр в px; перекрывает size. */
  diameter?: number;
  state?: 'loading' | 'pause' | 'success' | 'error';
  label?: string;
  description?: string;
  showValue?: boolean;
  style?: React.CSSProperties;
}
export declare function ProgressCircle(props: ProgressCircleProps): JSX.Element;
export default ProgressCircle;
