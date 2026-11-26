import React, { useState, useRef } from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * МГТС Attach — прикрепление файлов.
 * Dropzone — зона перетаскивания, AttachFile — строка файла
 * в состояниях default / loading / error.
 */
const ATTACH_STATE = {
  default: { fg: 'var(--color-text-primary)', icon: 'var(--color-icons-secondary)' },
  loading: { fg: 'var(--color-text-primary)', icon: 'var(--color-icons-brand)' },
  error: { fg: 'var(--color-accent-negative)', icon: 'var(--color-accent-negative)' },
  done: { fg: 'var(--color-text-primary)', icon: 'var(--color-icons-brand)' },
};

function Dropzone({ label, hint = 'Перетащите файл или выберите на компьютере', accept, disabled, onFiles, style, ...rest }) {
  const [over, setOver] = useState(false);
  const input = useRef(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }} {...rest}>
      {label && (
        <span style={{ fontFamily: 'var(--font-compact)', fontSize: 14, lineHeight: '20px', color: 'var(--color-text-secondary)' }}>{label}</span>
      )}
      <div role="button" tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && input.current && input.current.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setOver(false);
          if (!disabled && onFiles) onFiles(Array.from(e.dataTransfer.files));
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
          minHeight: 72, boxSizing: 'border-box', borderRadius: 'var(--radius-m)',
          background: over ? 'var(--color-brand-subtle)' : 'var(--color-background-secondary)',
          border: `1px ${over ? 'solid' : 'dashed'} ${over ? 'var(--color-brand)' : 'var(--color-control-stroke)'}`,
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
          transition: 'background 120ms var(--ease-standard), border-color 120ms var(--ease-standard)',
        }}>
        <Icon name="AttachmentSize24StyleOutline" size={24} style={{ color: 'var(--color-icons-brand)' }} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-compact)', fontSize: 17, lineHeight: '24px', color: 'var(--color-text-brand)' }}>Прикрепить файл</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '20px', color: 'var(--color-text-secondary)' }}>{hint}</span>
        </span>
        <input ref={input} type="file" accept={accept} multiple hidden
          onChange={(e) => onFiles && onFiles(Array.from(e.target.files))} />
      </div>
    </div>
  );
}

function AttachFile({
  name = 'Документ', ext, size: fileSize, state = 'default', progress = 0,
  error, disabled, onRemove, onDownload, style, ...rest
}) {
  const st = ATTACH_STATE[state] || ATTACH_STATE.default;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 8px 14px 12px',
      minHeight: 72, boxSizing: 'border-box', borderRadius: 'var(--radius-m)',
      background: 'var(--color-background-secondary)',
      border: `1px solid ${state === 'error' ? 'var(--color-accent-negative)' : 'transparent'}`,
      opacity: disabled ? 0.4 : 1, ...style,
    }} {...rest}>
      <span style={{
        width: 44, height: 44, borderRadius: 'var(--radius-s)', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-background-primary)', color: st.icon,
      }}>
        <Icon name="DocumentSize24StyleOutline" size={24} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: 'var(--font-compact)', fontSize: 17, lineHeight: '24px', color: st.fg,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</span>
        {state === 'loading' ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, height: 20 }}>
            <span style={{ flexGrow: 1, height: 4, borderRadius: 80, background: 'var(--color-control-track)', overflow: 'hidden' }}>
              <span style={{ display: 'block', width: `${progress}%`, height: '100%', background: 'var(--color-brand)', transition: 'width 240ms var(--ease-standard)' }} />
            </span>
            <span style={{ fontFamily: 'var(--font-text)', fontSize: 13, color: 'var(--color-text-secondary)' }}>{progress}%</span>
          </span>
        ) : (
          <span style={{
            fontFamily: 'var(--font-text)', fontSize: 14, lineHeight: '20px',
            color: state === 'error' ? 'var(--color-accent-negative)' : 'var(--color-text-secondary)',
            display: 'flex', gap: 4,
          }}>
            {state === 'error' ? (error || 'Превышен размер файла') : [ext, fileSize].filter(Boolean).join(' • ')}
          </span>
        )}
      </span>
      {onDownload && state !== 'error' && (
        <button type="button" onClick={onDownload} aria-label="Скачать" style={{
          width: 32, height: 32, borderRadius: 'var(--radius-s)', border: 'none', background: 'transparent',
          color: 'var(--color-icons-secondary)', cursor: 'pointer', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name="DownloadSize24StyleOutline" size={24} />
        </button>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Удалить" style={{
          width: 32, height: 32, borderRadius: 'var(--radius-s)', border: 'none', background: 'transparent',
          color: 'var(--color-icons-secondary)', cursor: 'pointer', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name="CrossSize24StyleOutline" size={24} />
        </button>
      )}
    </div>
  );
}

export { Dropzone, AttachFile };
export const Attach = { Dropzone, File: AttachFile };
export default Dropzone;
