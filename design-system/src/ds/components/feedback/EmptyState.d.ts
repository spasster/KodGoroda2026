import * as React from 'react';
import { IconName } from '../../assets/icons/Icon';
export type EmptyStateVariant = 'empty' | 'not-found' | 'no-access' | 'error' | 'offline';
export interface EmptyStateProps {
  /**
   * empty — сущностей ещё нет, not-found — фильтр или поиск пуст,
   * no-access — нет прав, error — запрос упал, offline — нет связи.
   */
  variant?: EmptyStateVariant;
  /** Перекрывает заголовок пресета. */
  title?: string;
  /** Перекрывает описание; null — скрыть описание. */
  description?: string | null;
  /** Перекрывает иконку пресета. */
  icon?: IconName;
  /** Кнопка действия: создать / сбросить / повторить / запросить доступ. */
  action?: React.ReactNode;
  /** Уменьшенная версия — для карточек и узких колонок. */
  compact?: boolean;
  style?: React.CSSProperties;
}
export declare const EMPTY_STATE_PRESETS: Record<EmptyStateVariant, {
  icon: IconName;
  title: string;
  description: string;
  tone: 'neutral' | 'negative' | 'warning';
}>;
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
export default EmptyState;
