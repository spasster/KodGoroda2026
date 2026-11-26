import * as React from 'react';
/** Small numeric counter badge; caps at max with a "+". */
export interface CounterProps {
  value: number;
  max?: number;
  tone?: 'brand' | 'negative' | 'neutral';
  style?: React.CSSProperties;
}
export declare function Counter(props: CounterProps): JSX.Element;
export default Counter;
