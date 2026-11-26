import * as React from 'react';
export interface Crumb { label: string; onClick?: () => void; }
/** Breadcrumb path; the last crumb is the current (non-clickable) page. */
export interface BreadcrumbsProps {
  items: Crumb[];
  style?: React.CSSProperties;
}
export declare function Breadcrumbs(props: BreadcrumbsProps): JSX.Element;
export default Breadcrumbs;
