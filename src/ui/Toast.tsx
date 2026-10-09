import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  message: string;
  tone: 'default' | 'error';
  action?: { label: string; run: () => void };
}

interface ToastApi {
  show: (message: string, opts?: { tone?: 'default' | 'error'; action?: ToastItem['action'] }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const show = useCallback<ToastApi['show']>(
    (message, opts) => {
      const id = next.current++;
      setItems((xs) => [...xs.slice(-2), { id, message, tone: opts?.tone ?? 'default', action: opts?.action }]);
      setTimeout(() => dismiss(id), opts?.action ? 6000 : 3500);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast${t.tone === 'error' ? ' toast--error' : ''}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="btn btn--ghost"
                style={{ color: 'inherit', minHeight: 40 }}
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
