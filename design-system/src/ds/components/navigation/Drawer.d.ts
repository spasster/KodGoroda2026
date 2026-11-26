import * as React from 'react';
export interface DrawerProps {
  open?: boolean;
  title?: string;
  width?: number | string;
  onClose?: () => void;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Drawer(props: DrawerProps): JSX.Element;
export default Drawer;
