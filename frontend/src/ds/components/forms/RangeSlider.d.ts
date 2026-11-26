import * as React from 'react';
/** Dual-thumb range slider; value is [low, high]. */
export interface RangeSliderProps {
  value?: [number, number];
  onChange?: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showValues?: boolean;
  /** Format the displayed values (e.g. add «₽»). */
  format?: (v: number) => React.ReactNode;
  style?: React.CSSProperties;
}
export declare function RangeSlider(props: RangeSliderProps): JSX.Element;
export default RangeSlider;
