import * as React from 'react';
/** Status badge with light fill; tones map to Granat accent colors. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'positive' | 'warning' | 'negative' | 'brand';
  children?: React.ReactNode;
}
export declare function Badge(props: BadgeProps): JSX.Element;
export default Badge;
