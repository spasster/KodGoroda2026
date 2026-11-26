import * as React from 'react';
/** One-time-code / PIN entry across N boxes with auto-advance. */
export interface CodeInputProps {
  length?: number;
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function CodeInput(props: CodeInputProps): JSX.Element;
export default CodeInput;
