import * as React from 'react';
export interface WizardStep {
  id?: string | number;
  title: string;
  /** Пояснение под заголовком шага. */
  description?: string;
}
export interface WizardProps {
  steps: WizardStep[];
  /** Контролируемый индекс шага. */
  step?: number;
  defaultStep?: number;
  onStepChange?: (step: number) => void;
  onFinish?: () => void;
  /** Показывает «Отмена» на первом шаге. */
  onCancel?: () => void;
  finishLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  cancelLabel?: string;
  /** Подсказка слева в нижней панели, например «Черновик сохранён». */
  hint?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Wizard(props: WizardProps): JSX.Element;
export default Wizard;
