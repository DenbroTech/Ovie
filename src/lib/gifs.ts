/** GIF search for notes. Works with a free GIPHY or KLIPY key saved in Settings (household settings),
 *  and the database only accepts GIF links from their media servers. */

export type GifProvider = 'giphy' | 'klipy';
export interface GifKey { provider: GifProvider; key: string }
export interface Gif { id: string; preview: string; url: string; title: string }

export const GIF_URL_RE = /^https:\/\/(media[0-9]?\.giphy\.com|i\.giphy\.com|static\.klipy\.com)\/[A-Za-z0-9._~/%=?&-]+$/;

/** The key saved in the household's settings, if any. */
export function gifKeyFrom(settings: Record<string, unknown> | undefined | null): GifKey | null {
  const key = typeof settings?.gif_key === 'string' ? settings.gif_key.trim() : '';
  if (!key) return null;
  return { provider: settings?.gif_provider === 'klipy' ? 'klipy' : 'giphy', key };
}

/** A pasted GIPHY page/link → the GIF file itself (giphy.com/gifs/name-ID → media.giphy.com/media/ID/giphy.gif). */
export function gifFromLink(text: string): string | null {
  const t = text.trim();
  if (GIF_URL_RE.test(t) && t.length <= 400) return t;
  const m = t.match(/^https:\/\/(?:www\.)?giphy\.com\/(?:gifs|stickers)\/(?:[\w-]*-)?([A-Za-z0-9]{6,})\/?(?:\?.*)?$/);
  return m ? `https://media.giphy.com/media/${m[1]}/giphy.gif` : null;
}

interface GiphyItem { id: string; title?: string; images: Record<string, { url?: string } | undefined> }
interface KlipyItem { id: number | string; title?: string; file?: Record<string, { gif?: { url?: string } } | undefined> }

/** Search (or trending when the search is empty). */
export async function searchGifs(k: GifKey, q: string, signal?: AbortSignal): Promise<Gif[]> {
  const query = q.trim();
  if (k.provider === 'giphy') {
    const path = query ? 'search' : 'trending';
    const url = `https://api.giphy.com/v1/gifs/${path}?api_key=${encodeURIComponent(k.key)}&limit=24&rating=pg-13${query ? `&q=${encodeURIComponent(query)}` : ''}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'The GIF key in Settings is not working.' : "Couldn't load GIFs.");
    const json = (await res.json()) as { data?: GiphyItem[] };
    return (json.data ?? []).map((g) => ({
      id: g.id, title: g.title ?? '',
      preview: g.images.fixed_width_small?.url ?? g.images.fixed_width?.url ?? '',
      url: g.images.downsized_medium?.url ?? g.images.fixed_width?.url ?? '',
    })).filter((g) => g.preview && GIF_URL_RE.test(g.url) && g.url.length <= 400);
  }
  const path = query ? `search?q=${encodeURIComponent(query)}&` : 'trending?';
  const res = await fetch(`https://api.klipy.com/api/v1/${encodeURIComponent(k.key)}/gifs/${path}per_page=24&content_filter=medium`, { signal });
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'The GIF key in Settings is not working.' : "Couldn't load GIFs.");
  const json = (await res.json()) as { data?: { data?: KlipyItem[] } };
  return (json.data?.data ?? []).map((g) => ({
    id: String(g.id), title: g.title ?? '',
    preview: g.file?.sm?.gif?.url ?? g.file?.md?.gif?.url ?? '',
    url: g.file?.md?.gif?.url ?? g.file?.sm?.gif?.url ?? '',
  })).filter((g) => g.preview && GIF_URL_RE.test(g.url) && g.url.length <= 400);
}
