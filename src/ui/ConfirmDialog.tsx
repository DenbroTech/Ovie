import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';

/** Touch-friendly confirmation for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); onCancel(); }} aria-labelledby="confirm-title">
      {open && (
        <>
          <div className="dialog__body">
            <h2 id="confirm-title">{title}</h2>
            {body && <p>{body}</p>}
          </div>
          <div className="dialog__actions">
            <Button variant="secondary" size="lg" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="lg"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
