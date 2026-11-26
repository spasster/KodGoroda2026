import * as React from 'react';
/** Search field with leading magnifier and a clear (×) control. */
export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  value?: string;
  onClear?: () => void;
  placeholder?: string;
  size?: 's' | 'm' | 'l';
  /** Filled grey background (default) vs outlined. */
  filled?: boolean;
}
export declare function SearchInput(props: SearchInputProps): JSX.Element;
export default SearchInput;
