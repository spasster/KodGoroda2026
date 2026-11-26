import * as React from 'react';
export interface DropzoneProps {
  label?: string;
  hint?: string;
  accept?: string;
  disabled?: boolean;
  onFiles?: (files: File[]) => void;
  style?: React.CSSProperties;
}
export interface AttachFileProps {
  name: string;
  /** Тип файла, например «PDF». */
  ext?: string;
  /** Размер файла строкой, например «2,4 МБ». */
  size?: string;
  state?: 'default' | 'loading' | 'error' | 'done';
  /** Процент загрузки для state="loading". */
  progress?: number;
  error?: string;
  disabled?: boolean;
  onRemove?: () => void;
  onDownload?: () => void;
  style?: React.CSSProperties;
}
export declare function Dropzone(props: DropzoneProps): JSX.Element;
export declare function AttachFile(props: AttachFileProps): JSX.Element;
export declare const Attach: { Dropzone: typeof Dropzone; File: typeof AttachFile };
export default Dropzone;
