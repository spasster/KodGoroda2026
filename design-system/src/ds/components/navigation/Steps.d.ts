import * as React from 'react';
export interface Step { label: string; description?: string; }
/** Horizontal wizard step indicator (completed / current / upcoming). */
export interface StepsProps {
  steps: Array<Step | string>;
  /** Index of the current (in-progress) step. */
  current?: number;
  style?: React.CSSProperties;
}
export declare function Steps(props: StepsProps): JSX.Element;
export default Steps;
