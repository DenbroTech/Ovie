import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/** A full-screen "app" page with a big back button to Home. */
export function Screen({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <header className="screen-header">
        <button
          type="button"
          className="btn btn-ghost btn-icon screen-back"
          onClick={() => navigate('/', { state: { dir: 'back' } })}
          aria-label="Back to home"
        >
          <ChevronLeft size={30} strokeWidth={2.5} />
        </button>
        <h1>{title}</h1>
        <div className="screen-actions">{actions}</div>
      </header>
      <main className="screen-body">{children}</main>
    </div>
  );
}
