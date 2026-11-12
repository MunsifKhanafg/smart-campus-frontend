import { useRef, useState } from 'react';
import api, { errorMessage } from '../api/axios.js';
import Avatar, { forgetPhoto } from './Avatar.jsx';

// Choose or take a photo, shrink it, and save it as the person's picture.
// The picture is cropped to a centred square and reduced to 320 x 320 pixels (about 20 to 40 KB), so uploads are fast, the database stays
// small, and a phone photo of several megabytes works without any editing.
const SIDE = 320;

export const shrink = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = SIDE;
      canvas.height = SIDE;
      canvas.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, SIDE, SIDE);
      // Quality goes down only if the picture is still bigger than the server accepts (300 KB).
      const attempt = (q) => canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('This picture could not be read'));
        if (blob.size > 280 * 1024 && q > 0.4) return attempt(q - 0.15);
        resolve(blob);
      }, 'image/jpeg', q);
      attempt(0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file is not a picture')); };
    img.src = url;
  });

// user: { _id, name, hasPhoto, photoUpdatedAt }.  onChanged(patch) receives { hasPhoto, photoUpdatedAt } so the page can update itself.
// base: where the picture is saved. People use '/profile' (default); Class IV staff use '/support-staff'.
export default function PhotoUpload({ user, size = 96, onChanged, onMessage, base = '/profile' }) {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const photoBase = base === '/profile' ? '/photos' : `${base}/photo`;

  const tell = (type, text) => onMessage?.(type, text);

  const send = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await shrink(file);
      const form = new FormData();
      form.append('photo', blob, 'photo.jpg');
      const { data } = await api.put(`${base}/${user._id}/photo`, form);
      forgetPhoto(user._id);
      onChanged?.(data.data);
      tell('success', 'Photo saved');
    } catch (err) { tell('error', err.response ? errorMessage(err) : err.message); } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const { data } = await api.delete(`${base}/${user._id}/photo`);
      forgetPhoto(user._id);
      onChanged?.(data.data);
      tell('success', 'Photo removed');
    } catch (err) { tell('error', errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="photo-upload">
      <Avatar user={user} size={size} photoBase={photoBase} />
      <div className="photo-actions">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => send(e.target.files?.[0])} />
        {/* capture="user" opens the front camera on a phone; on a computer it is a normal file chooser */}
        <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => send(e.target.files?.[0])} />
        <button type="button" className="btn btn-small btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Saving…' : user.hasPhoto ? 'Change photo' : 'Upload photo'}</button>
        <button type="button" className="btn btn-small" disabled={busy} onClick={() => cameraRef.current?.click()}>📷 Take photo</button>
        {user.hasPhoto && <button type="button" className="btn btn-small btn-danger" disabled={busy} onClick={remove}>Remove</button>}
        <span className="muted small">JPG, PNG or WebP. The picture is cropped to a square and shrunk automatically.</span>
      </div>
    </div>
  );
}
