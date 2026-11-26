import * as React from 'react';
/** Bottom cookie-consent bar with accept / settings actions. */
export interface CookieBannerProps {
  title?: string;
  message?: string;
  acceptLabel?: string;
  settingsLabel?: string;
  onAccept?: () => void;
  onSettings?: () => void;
  onClose?: () => void;
  style?: React.CSSProperties;
}
export declare function CookieBanner(props: CookieBannerProps): JSX.Element;
export default CookieBanner;
