import * as React from 'react';
export type StatusTone = 'neutral' | 'positive' | 'warning' | 'negative' | 'brand';
export interface StatusPillProps {
  tone?: StatusTone;
  children?: React.ReactNode;
}
export declare function StatusPill(props: StatusPillProps): JSX.Element;
export default StatusPill;
