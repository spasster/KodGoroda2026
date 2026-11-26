import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
export interface AppHeaderAction {
  id: string | number;
  icon: IconName;
  title?: string;
  /** Счётчик в углу кнопки. */
  count?: number;
  /** Точка-нотификация; игнорируется, если задан count. */
  dot?: boolean;
  onClick?: () => void;
}
export interface AppHeaderUser {
  name: string;
  /** Инициалы; по умолчанию считаются из name. */
  initials?: string;
  online?: boolean;
}
export interface AppHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Название продукта рядом с логотипом. */
  product?: string;
  /** Путь к логотипу; без него рисуется знак из brand/Logo. */
  logoSrc?: string;
  search?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  actions?: AppHeaderAction[];
  user?: AppHeaderUser;
  /** Высота 56 вместо 64. */
  compact?: boolean;
  /** Дополнительные элементы слева от действий. */
  children?: React.ReactNode;
}
export declare function AppHeader(props: AppHeaderProps): JSX.Element;
export default AppHeader;
