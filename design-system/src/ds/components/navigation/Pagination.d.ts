import * as React from 'react';
/** Dot pagination indicator; active dot widens and turns МГТС blue. */
export interface PaginationProps {
  count: number;
  active?: number;
  onChange?: (index: number) => void;
  style?: React.CSSProperties;
}
export declare function Pagination(props: PaginationProps): JSX.Element;
export default Pagination;
