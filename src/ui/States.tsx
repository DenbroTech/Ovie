import type { ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { friendlyError } from '../lib/errors';
import { Button } from './Button';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite">
      <div className="spinner" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

export function FullScreenSpinner({ label }: { label?: string }) {
  return (
    <div className="center-screen">
      <Spinner label={label} />
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <p className="empty__title">{title}</p>
      {children && <div>{children}</div>}
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="notice notice--error" role="alert">
      <AlertTriangle size={20} aria-hidden="true" />
      <div className="stack stack--sm">
        <span>{friendlyError(error)}</span>
        {onRetry && (
          <div>
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function InfoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="notice notice--info">
      <Info size={20} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
