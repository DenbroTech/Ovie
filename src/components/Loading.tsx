import { OvieSheep } from './OvieSheep';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="center-page" role="status">
      <OvieSheep size={88} mood="thinking" />
      <div className="spinner" />
      <p className="muted">{label}</p>
    </div>
  );
}
