import * as React from 'react';
/** Round avatar — image or initials fallback, optional status dot. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string;
  /** Full name — used for initials and alt text. */
  name?: string;
  size?: 's' | 'm' | 'l';
  status?: 'online' | 'busy' | 'away';
}
export declare function Avatar(props: AvatarProps): JSX.Element;
export default Avatar;
