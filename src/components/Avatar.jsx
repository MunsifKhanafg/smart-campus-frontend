import { useEffect, useState } from 'react';
import api from '../api/axios.js';
import { colorFor, initials } from './palette.js';

// The round picture of a person. Shows their photo when they have one, otherwise their coloured initials.
//
// An <img src="/api/photos/..."> cannot send the login token, and photos are private (a student's photo is not public), so the picture
// is downloaded with the token and shown from memory. Each photo is downloaded once per version and shared by every place that shows it
// (menu, lists, profile ...). When a new photo is uploaded, photoUpdatedAt changes and every place refreshes by itself.
//
//   <Avatar user={{ _id, name, hasPhoto, photoUpdatedAt }} size={44} />
//   <Avatar user={staff} photoBase="/support-staff/photo" />   (Class IV staff photos live under their own path)

const cache = new Map(); // "base:id:version" -> Promise<objectURL | null>

const load = (base, id, version) => {
  const key = `${base}:${id}:${version || ''}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      api.get(`${base}/${id}`, { responseType: 'blob' })
        .then((r) => URL.createObjectURL(r.data))
        .catch(() => null)
    );
  }
  return cache.get(key);
};

// Forget a person's cached picture right after a new upload, so every Avatar asks again.
export const forgetPhoto = (id) => { for (const k of [...cache.keys()]) if (k.split(':')[1] === String(id)) cache.delete(k); };

export default function Avatar({ user, size = 40, className = '', square = false, photoBase = '/photos' }) {
  const id = user?._id;
  const version = user?.photoUpdatedAt ? new Date(user.photoUpdatedAt).getTime() : '';
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let live = true;
    setSrc(null);
    if (id && user?.hasPhoto) load(photoBase, id, version).then((url) => { if (live) setSrc(url); });
    return () => { live = false; };
  }, [id, version, user?.hasPhoto, photoBase]);

  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.38), borderRadius: square ? 14 : '50%' };
  if (src) return <img className={`avatar-img ${className}`} src={src} alt={user?.name || ''} style={{ ...style, objectFit: 'cover' }} />;
  return <span className={`avatar-fallback ${className}`} style={{ ...style, ...colorFor(user?.name || '') }} aria-label={user?.name}>{initials(user?.name)}</span>;
}
