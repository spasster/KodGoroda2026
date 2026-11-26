import * as React from 'react';
/**
 * МГТС wordmark lockup.
 * @startingPoint section="Brand" subtitle="МГТС logo lockup" viewport="320x80"
 */
export interface LogoProps {
  variant?: 'full' | 'mark' | 'text';
  tone?: 'brand' | 'mono' | 'inverted';
  /** Mark height in px; text scales from this. */
  size?: number;
  style?: React.CSSProperties;
}
export declare function Logo(props: LogoProps): JSX.Element;
export default Logo;
