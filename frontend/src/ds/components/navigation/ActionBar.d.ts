import * as React from 'react';
/** Sticky bottom action bar for forms/wizards (Granat Bottom-Button). */
export interface ActionBarProps {
  children?: React.ReactNode;
  align?: 'left' | 'right' | 'between' | 'center';
  /** Stick to the bottom of the scroll container. */
  sticky?: boolean;
  style?: React.CSSProperties;
}
export declare function ActionBar(props: ActionBarProps): JSX.Element;
export default ActionBar;
