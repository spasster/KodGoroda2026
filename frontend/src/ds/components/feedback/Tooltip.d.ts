import * as React from 'react';
/** Hover tooltip — dark surface, used to explain icon controls. */
export interface TooltipProps {
  content: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Tooltip(props: TooltipProps): JSX.Element;
export default Tooltip;
