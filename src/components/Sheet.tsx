import { useEffect, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** A pop-up form: slides up from the bottom on phones, centred on bigger screens. */
export function Sheet({
  title, children, onClose, onSubmit, submitLabel = 'Save', busy = false, canSubmit = true, footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  busy?: boolean;
  canSubmit?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy && canSubmit) onSubmit?.();
  };

  return (
    <div className="overlay sheet-overlay" onClick={() => !busy && onClose()}>
      <form className="sheet" role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={onClose} disabled={busy}>
            <X size={24} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        <div className="sheet-foot">
          {footer}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          {onSubmit && (
            <button type="submit" className="btn btn-primary" disabled={busy || !canSubmit}>
              {busy ? 'Saving…' : submitLabel}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
