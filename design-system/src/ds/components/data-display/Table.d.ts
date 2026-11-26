import * as React from 'react';
export type TableCellType =
  | 'text' | 'icon-text' | 'link' | 'number'
  | 'status' | 'progress' | 'avatar' | 'custom';
export interface TableColumn<Row = any> {
  key: string;
  title: string;
  type?: TableCellType;
  sortable?: boolean;
  width?: number | string;
  maxWidth?: number;
  /** Ключ строки с подписью под значением. По умолчанию `<key>Caption`. */
  captionKey?: string;
  /** Ключ строки с именем иконки. По умолчанию `<key>Icon`. */
  iconKey?: string;
  /** Ключ строки с тоном статуса. По умолчанию `<key>Tone`. */
  toneKey?: string;
  hrefKey?: string;
  /** Для type="custom". */
  render?: (row: Row) => React.ReactNode;
}
export interface TableProps<Row = any> {
  columns: Array<TableColumn<Row>>;
  rows: Row[];
  selectable?: boolean;
  /** default — строка 60px, compact — 44px. */
  density?: 'default' | 'compact';
  /** Клик по кнопке «…» в строке. */
  rowActions?: (row: Row, event: React.MouseEvent) => void;
  /** Правый клик по строке — для контекстного меню. */
  onRowContextMenu?: (event: React.MouseEvent, row: Row) => void;
  onRowClick?: (row: Row) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  stickyHeader?: boolean;
  style?: React.CSSProperties;
}
export declare function Table<Row = any>(props: TableProps<Row>): JSX.Element;
export default Table;
