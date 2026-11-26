import * as React from 'react';
/** Centered modal dialog over a dimmed overlay. */
export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  /** Footer node — usually action buttons. */
  footer?: React.ReactNode;
  width?: number | string;
  style?: React.CSSProperties;
}
export declare function Modal(props: ModalProps): JSX.Element | null;
export default Modal;
