import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Screen } from '../../components/Screen';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Empty, LoadError, Spinner } from '../../components/States';
import { useToast } from '../../components/Toast';
import { useHousehold } from '../../app/HouseholdProvider';
import { useConnection } from '../../app/ConnectionProvider';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { shrinkImage } from '../../lib/images';
import { BUCKET, usePhotos, type Photo } from '../../lib/photos';

export function PhotosScreen() {
  const { household, me } = useHousehold();
  const { online } = useConnection();
  const toast = useToast();
  const hid = household?.id;
  const photos = usePhotos(hid);
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [confirm, setConfirm] = useState<Photo | null>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0 || !hid) return;
    const list = Array.from(files).slice(0, 20);
    setUploading({ done: 0, total: list.length });
    let ok = 0;
    for (const [i, file] of list.entries()) {
      try {
        const { blob, width, height } = await shrinkImage(file);
        const path = `${hid}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw up.error;
        const row = await supabase.from('photos').insert({ household_id: hid, path, width, height, uploaded_by: me?.id ?? null });
        if (row.error) { await supabase.storage.from(BUCKET).remove([path]); throw row.error; }
        ok++;
      } catch (err) {
        toast(`${file.name}: ${friendlyError(err)}`, 'error');
      }
      setUploading({ done: i + 1, total: list.length });
    }
    setUploading(null);
    if (input.current) input.current.value = '';
    if (ok) toast(ok === 1 ? 'Photo added' : `${ok} photos added`);
    void photos.reload();
  }

  async function remove(p: Photo) {
    const { error } = await supabase.from('photos').delete().eq('id', p.id);
    if (error) { toast(friendlyError(error), 'error'); return; }
    await supabase.storage.from(BUCKET).remove([p.path]);
    toast('Photo deleted');
    setViewing(null);
    void photos.reload();
  }

  const list = photos.data ?? [];
  return (
    <Screen title="Photos" actions={
      <>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} aria-label="Choose photos" />
        <button type="button" className="btn btn-primary" disabled={!online || !!uploading} onClick={() => input.current?.click()}>
          <ImagePlus size={22} /> {uploading ? `Adding ${uploading.done}/${uploading.total}…` : 'Add photos'}
        </button>
      </>
    }>
      <div className="module module-wide">
        <p className="muted small" style={{ marginBottom: 'var(--s-3)' }}>
          These show on the wall screen's screensaver. Photos are made smaller before upload and stay private to your home.
        </p>
        {photos.error ? <LoadError message={photos.error} onRetry={() => void photos.reload()} />
          : photos.loading ? <Spinner />
          : list.length === 0 ? <Empty title="No photos yet">Tap “Add photos” to pick some from this device.</Empty> : (
            <ul className="photo-grid">
              {list.map((p) => (
                <li key={p.id}>
                  <button type="button" className="photo-tile" onClick={() => setViewing(p)} aria-label="Open photo">
                    {photos.urls[p.path] ? <img src={photos.urls[p.path]} alt="" loading="lazy" /> : <span className="spinner" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>

      {viewing && (
        <div className="overlay photo-viewer" onClick={() => setViewing(null)} role="dialog" aria-modal="true" aria-label="Photo">
          {photos.urls[viewing.path] && <img src={photos.urls[viewing.path]} alt="" onClick={(e) => e.stopPropagation()} />}
          <div className="photo-viewer-bar" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>
            <button type="button" className="btn btn-danger" disabled={!online} onClick={() => setConfirm(viewing)}><Trash2 size={18} /> Delete</button>
          </div>
        </div>
      )}
      {confirm && (
        <ConfirmDialog danger title="Delete this photo?" body="It's removed from Ovie and the screensaver." confirmLabel="Delete"
          onCancel={() => setConfirm(null)} onConfirm={async () => { await remove(confirm); setConfirm(null); }} />
      )}
    </Screen>
  );
}
