import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { gifFromLink, searchGifs, type Gif, type GifKey } from '../../lib/gifs';

/** Search GIFs (with the key from Settings) or paste a GIPHY link. */
export function GifPicker({ gifKey, onPick }: { gifKey: GifKey | null; onPick: (url: string) => void }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState('');
  const linked = gifFromLink(link);

  useEffect(() => { const t = window.setTimeout(() => setDebounced(q), 350); return () => window.clearTimeout(t); }, [q]);
  useEffect(() => {
    if (!gifKey) return;
    const ctl = new AbortController();
    setLoading(true);
    searchGifs(gifKey, debounced, ctl.signal)
      .then((g) => { setGifs(g); setError(null); })
      .catch((e: Error) => { if (e.name !== 'AbortError') setError(navigator.onLine ? e.message : 'GIFs need the internet.'); })
      .finally(() => setLoading(false));
    return () => ctl.abort();
  }, [gifKey, debounced]);

  return (
    <div className="gif-picker">
      {gifKey ? (
        <>
          <div className="gif-search">
            <Search size={18} aria-hidden="true" />
            <input type="search" aria-label="Search GIFs" placeholder="Search GIFs" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {error ? <p className="notice notice-error">{error}</p> : (
            <div className="gif-grid" aria-busy={loading}>
              {gifs.map((g) => (
                <button key={g.id} type="button" className="gif-btn" aria-label={g.title || 'GIF'} onClick={() => onPick(g.url)}>
                  <img src={g.preview} alt="" loading="lazy" />
                </button>
              ))}
              {!loading && gifs.length === 0 && <p className="muted small">No GIFs found.</p>}
            </div>
          )}
          <p className="muted small gif-credit">{gifKey.provider === 'klipy' ? 'Powered by KLIPY' : 'Powered by GIPHY'}</p>
        </>
      ) : (
        <p className="muted small">To search GIFs here, add a free GIF key in Settings → GIFs. Until then you can paste a GIPHY link, or pick a GIF from your gallery with Photo.</p>
      )}
      <div className="field">
        <label htmlFor="gif-link">Or paste a GIPHY link</label>
        <div className="field-inline">
          <input id="gif-link" inputMode="url" placeholder="https://giphy.com/gifs/…" value={link} onChange={(e) => setLink(e.target.value)} />
          <button type="button" className="btn btn-secondary" disabled={!linked} onClick={() => linked && onPick(linked)}>Use</button>
        </div>
      </div>
    </div>
  );
}
