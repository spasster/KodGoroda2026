import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Empty State — пустое или ошибочное состояние списка, таблицы, раздела.
 *
 * Пять сценариев, у каждого свой смысл и своё действие:
 *   empty      — сущностей ещё нет вообще → действие «создать»
 *   not-found  — фильтр или поиск ничего не дал → действие «сбросить»
 *   no-access  — данные есть, но не для этого пользователя → «запросить доступ»
 *   error      — запрос упал → «повторить»
 *   offline    — нет связи → «повторить», когда появится
 *
 * Тон нейтральный: что произошло и что сделать дальше, без извинений.
 */
export const EMPTY_STATE_PRESETS = {
  empty: {
    icon: 'DocumentSize44StyleOutline',
    title: 'Пока ничего нет',
    description: 'Создайте первую запись — она появится в этом списке',
    tone: 'neutral',
  },
  'not-found': {
    icon: 'SearchSize44StyleOutline',
    title: 'Ничего не найдено',
    description: 'Измените параметры фильтра или очистите поиск',
    tone: 'neutral',
  },
  'no-access': {
    icon: 'LockSize44StyleOutline',
    title: 'Нет доступа к разделу',
    description: 'Запросите доступ у администратора — обычно это занимает один рабочий день',
    tone: 'neutral',
  },
  error: {
    icon: 'WarningSize44StyleOutline',
    title: 'Не удалось загрузить данные',
    description: 'Повторите попытку. Если ошибка повторяется, сообщите в поддержку',
    tone: 'negative',
  },
  offline: {
    icon: 'WifiOffSize24StyleOutline',
    title: 'Нет соединения',
    description: 'Проверьте подключение к сети — данные обновятся автоматически',
    tone: 'warning',
  },
};

const TONE_FG = {
  neutral: { bg: 'var(--color-background-secondary)', fg: 'var(--color-icons-tertiary)' },
  negative: { bg: 'var(--color-accent-negative-bg)', fg: 'var(--color-accent-negative)' },
  warning: { bg: 'var(--color-accent-warning-bg)', fg: 'var(--color-text-warning-strong)' },
};

export function EmptyState({
  variant = 'empty',
  title,
  description,
  icon,
  action,
  compact = false,
  style,
  ...rest
}) {
  const preset = EMPTY_STATE_PRESETS[variant] || EMPTY_STATE_PRESETS.empty;
  const t = TONE_FG[preset.tone] || TONE_FG.neutral;
  const box = compact ? 48 : 64;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: compact ? 8 : 12, padding: compact ? '32px 24px' : '64px 24px', textAlign: 'center', ...style,
    }} {...rest}>
      <span style={{
        width: box, height: box, borderRadius: 80, display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', background: t.bg, color: t.fg,
      }}>
        <Icon name={icon || preset.icon} size={compact ? 24 : 32} />
      </span>
      <span style={{
        fontFamily: 'var(--font-compact)', fontWeight: 'var(--fw-medium)',
        fontSize: compact ? 17 : 20, color: 'var(--color-text-primary)',
      }}>{title || preset.title}</span>
      {(description || preset.description) !== null && (
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px',
          color: 'var(--color-text-secondary)', maxWidth: 360, textWrap: 'pretty',
        }}>{description !== undefined ? description : preset.description}</span>
      )}
      {action && <span style={{ marginTop: 4 }}>{action}</span>}
    </div>
  );
}

export default EmptyState;
