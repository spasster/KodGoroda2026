import * as React from 'react';
/** Accordion row — title toggles a content panel; chevron rotates. */
export interface CollapsibleProps {
  title: React.ReactNode;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  /** Controlled open state (omit for uncontrolled). */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  style?: React.CSSProperties;
}
export declare function Collapsible(props: CollapsibleProps): JSX.Element;
export default Collapsible;
