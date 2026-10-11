import type { ReactNode } from 'react';
import { OvieSheep, type SheepMood } from './OvieSheep';

export function Empty({ title, children, mood = 'happy' }: { title: string; children?: ReactNode; mood?: SheepMood }) {
  return (
    <div className="empty">
      <OvieSheep size={88} mood={mood} />
      <p className="empty-title">{title}</p>
      {children && <p className="muted small">{children}</p>}
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="empty">
      <OvieSheep size={88} mood="sad" />
      <div className="notice notice-error" role="alert">{message}</div>
      <button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button>
    </div>
  );
}

export function Spinner() {
  return <div className="empty" role="status"><div className="spinner" /><span className="visually-hidden">Loading</span></div>;
}
