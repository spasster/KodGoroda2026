import * as React from 'react';
export interface TableToolbarProps {
  title?: string;
  count?: number;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  /** Фильтры, кнопки и прочие действия справа. */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function TableToolbar(props: TableToolbarProps): JSX.Element;
export default TableToolbar;
