import * as React from 'react';
export interface BottomButtonProps {
  /** Кнопки действия. */
  children?: React.ReactNode;
  elevated?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Подсказка слева — состояние формы. */
  hint?: string;
  style?: React.CSSProperties;
}
export declare function BottomButton(props: BottomButtonProps): JSX.Element;
export default BottomButton;
