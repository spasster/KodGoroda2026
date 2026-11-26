import * as React from 'react';
export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  height?: number | string;
  /** Узкий бегунок 8px вместо 12px. */
  thin?: boolean;
  children?: React.ReactNode;
}
export declare function ScrollArea(props: ScrollAreaProps): JSX.Element;
export default ScrollArea;
