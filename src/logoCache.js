import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSelector } from 'react-redux';
import { assetUrl } from './api/axios.js';

// The latest university logo is kept in the browser as a small data: picture, so when the server is unreachable on the first load
// the CURRENT logo is shown (not the old one and not the default emblem).
//   - cacheLogo(logoUrl)   downloads the logo once it is known and stores it (called while the server is up)
//   - clearLogoCache()     the head removed the logo, so the saved copy is removed too
//   - useLogoSrc()         { src, onError, hasLogo } for any <img>: saved copy first (instant), network when it is a new logo,
//                          saved copy again if the network fails
const KEY = 'sc_logo_cache';
const MAX_BYTES = 1.5 * 1024 * 1024; // a logo larger than this is not kept (localStorage is small)

let mem;
const listeners = new Set();
const read = () => {
  if (mem === undefined) {
    try { mem = JSON.parse(localStorage.getItem(KEY)) || null; } catch { mem = null; }
  }
  return mem;
};
const write = (value) => {
  mem = value;
  try { value ? localStorage.setItem(KEY, JSON.stringify(value)) : localStorage.removeItem(KEY); } catch { /* private mode or full: kept in memory only */ }
  listeners.forEach((l) => l());
};
const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };

export const clearLogoCache = () => { if (read()) write(null); };

let pending = '';
export const cacheLogo = async (logoUrl) => {
  const have = read();
  if (!logoUrl || have?.url === logoUrl || pending === logoUrl) return;
  pending = logoUrl;
  try {
    const res = await fetch(assetUrl(logoUrl), { mode: 'cors' });
    if (!res.ok) return;
    const blob = await res.blob();
    if (blob.size > MAX_BYTES || !blob.type.startsWith('image/')) return;
    const data = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    write({ url: logoUrl, data, savedAt: Date.now() });
  } catch { /* server down right now: the previous saved copy stays */ } finally {
    pending = '';
  }
};

export function useLogoSrc() {
  const logoUrl = useSelector((s) => s.settings.logoUrl);
  const cached = useSyncExternalStore(subscribe, read, read);
  const [tries, setTries] = useState(0);
  const [netFailed, setNetFailed] = useState(false);
  useEffect(() => { setTries(0); setNetFailed(false); }, [logoUrl]);

  if (!logoUrl) return { src: '', onError: () => {}, hasLogo: false };
  const saved = cached?.data || '';
  // The saved copy of exactly this logo is used at once, so nothing depends on the server. A different (new) logo loads from the
  // network; if the network fails the last saved logo is shown rather than the default emblem.
  if (saved && (cached.url === logoUrl || netFailed)) return { src: saved, onError: () => {}, hasLogo: true };
  if (netFailed) return { src: '', onError: () => {}, hasLogo: false };
  const base = assetUrl(logoUrl);
  const src = tries ? `${base}${logoUrl.includes('?') ? '&' : '?'}retry=${tries}` : base;
  // One quiet retry (the server may be waking up), then give up on the network.
  const onError = () => (tries < 1 ? setTimeout(() => setTries(1), 1500) : setNetFailed(true));
  return { src, onError, hasLogo: true };
}
