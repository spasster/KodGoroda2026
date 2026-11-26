import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
/** Compact chip; optionally selectable and removable. */
export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  icon?: IconName;
  /** Render a remove (×) control; called on click. */
  onRemove?: () => void;
  selected?: boolean;
  children?: React.ReactNode;
}
export declare function Tag(props: TagProps): JSX.Element;
export default Tag;
