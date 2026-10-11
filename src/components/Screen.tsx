import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { OvieSheep, type SheepMood } from './OvieSheep';

/** A full-screen "app" page with a big back button to Home. */
/** `sheep` is this app's Ovie, shown by the title (it reacts to things happening, e.g. celebrating a ticked-off job). */
export function Screen({ title, sheep, children, actions, back = '/' }: { title: string; sheep?: SheepMood; children: ReactNode; actions?: ReactNode; back?: string }) {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <header className="screen-header">
        <button
          type="button"
          className="btn btn-ghost btn-icon screen-back"
          onClick={() => navigate(back, { state: { dir: 'back' } })}
          aria-label={back === '/' ? 'Back to home' : 'Back'}
        >
          <ChevronLeft size={30} strokeWidth={2.5} />
        </button>
        <h1 className="screen-title">{sheep && <OvieSheep size={56} mood={sheep} title="" reacts className="screen-sheep" />}{title}</h1>
        <div className="screen-actions">{actions}</div>
      </header>
      <main className="screen-body">{children}</main>
    </div>
  );
}
