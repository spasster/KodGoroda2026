import * as React from 'react';
/** Hairline separator; horizontal (optional label) or vertical. */
export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  /** Centered label text (horizontal only). */
  label?: string;
  /** Margin around the line, px. */
  spacing?: number;
  style?: React.CSSProperties;
}
export declare function Divider(props: DividerProps): JSX.Element;
export default Divider;
