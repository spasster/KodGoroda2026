import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
export interface TreeNode {
  id: string | number;
  label: string;
  /** Вторая строка под названием. */
  caption?: string;
  icon?: IconName;
  /** Число справа — например количество вложенных документов. */
  count?: number;
  disabled?: boolean;
  children?: TreeNode[];
}
export interface TreeProps {
  nodes: TreeNode[];
  /** s — строка 48, m — 64. */
  size?: 's' | 'm';
  /** Раскрытые узлы при первом рендере (неконтролируемый режим). */
  defaultExpanded?: Array<string | number>;
  /** Контролируемая карта id → раскрыт. */
  expanded?: Record<string, boolean>;
  onToggle?: (id: string | number, open: boolean) => void;
  selectedId?: string | number | null;
  onSelect?: (id: string | number, node: TreeNode) => void;
  style?: React.CSSProperties;
}
export declare function Tree(props: TreeProps): JSX.Element;
export default Tree;
