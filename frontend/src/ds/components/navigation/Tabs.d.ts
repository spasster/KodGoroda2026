import * as React from 'react';
export interface TabItem { value: string; label: string; }
/** Horizontal tabs with a МГТС-blue underline indicator. */
export interface TabsProps {
  tabs: Array<TabItem | string>;
  value?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}
export declare function Tabs(props: TabsProps): JSX.Element;
export default Tabs;
