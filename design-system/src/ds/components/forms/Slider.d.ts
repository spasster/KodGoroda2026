import * as React from 'react';
/** Single-value range slider with МГТС-blue fill and thumb. */
export interface SliderProps {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Show the current value above the track. */
  showValue?: boolean;
  style?: React.CSSProperties;
}
export declare function Slider(props: SliderProps): JSX.Element;
export default Slider;
