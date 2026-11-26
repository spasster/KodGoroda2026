import * as React from 'react';
export interface PaginationDotsProps {
  count?: number;
  active?: number;
  onChange?: (index: number) => void;
  size?: number;
  style?: React.CSSProperties;
}
export declare function PaginationDots(props: PaginationDotsProps): JSX.Element;
export default PaginationDots;
