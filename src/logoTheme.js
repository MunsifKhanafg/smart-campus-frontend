import { useEffect, useState } from 'react';

// ==========================================================================================
// Logo colours -> app colours.
// When the university logo changes, we read its pixels in the browser (canvas), find the main colours and write a small
// <style> block that overrides the theme variables from index.css / theme.css (--primary, --bg, --sidebar-from ...).
// Nothing is sent to a server. Switch it off with the palette button in the top bar.
// ==========================================================================================

export const DEFAULT_LOGO = '/brand/logo.png';
const CACHE_KEY = 'smartcampus-logo-theme';
const COLORS_KEY = 'smartcampus-logo-colors'; // 'on' | 'off'
const WATERMARK_KEY = 'smartcampus-watermark'; // 'on' | 'off'
const STYLE_ID = 'logo-theme-style';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = Math.round;

// ---------- preferences (kept in the browser) ----------
const read = (key) => { try { return localStorage.getItem(key) !== 'off'; } catch { return true; } };
const write = (key, on) => {
  try { localStorage.setItem(key, on ? 'on' : 'off'); } catch { /* private mode: not remembered */ }
  window.dispatchEvent(new Event('logoprefs'));
};
export const getPrefs = () => ({ colors: read(COLORS_KEY), watermark: read(WATERMARK_KEY) });
export const setColorsPref = (on) => write(COLORS_KEY, on);
export const setWatermarkPref = (on) => write(WATERMARK_KEY, on);

export function useLogoPrefs() {
  const [prefs, setPrefs] = useState(getPrefs);
  useEffect(() => {
    const sync = () => setPrefs(getPrefs());
    window.addEventListener('logoprefs', sync);
    return () => window.removeEventListener('logoprefs', sync);
  }, []);
  return prefs;
}

// ---------- colour maths ----------
export const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
};

const hsl = (h, s, l, a) => `hsl(${round(((h % 360) + 360) % 360)} ${round(clamp(s, 0, 100))}% ${round(clamp(l, 0, 100))}%${a === undefined ? '' : ` / ${a}`})`;

// The logo is downloaded as a file first and drawn from a local blob. That way the canvas is never "tainted" by a
// cross-origin image, which would block reading its pixels (this broke the colour detection for uploaded logos).
const loadImage = async (src) => {
  let url = src;
  let local = false;
  try {
    const res = await fetch(src, { mode: 'cors' });
    if (res.ok) { url = URL.createObjectURL(await res.blob()); local = true; }
  } catch { /* fall back to a direct, cross-origin load below */ }
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!local) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

// Small k-means on the colour of the logo's visible pixels. Returns the main colours with their share of the logo.
const clusterColors = (pixels, k = 4) => {
  const sorted = [...pixels].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)].slice());
  let groups = [];
  for (let iter = 0; iter < 8; iter += 1) {
    groups = centers.map(() => []);
    for (const p of pixels) {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((c, i) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      });
      groups[best].push(p);
    }
    centers = centers.map((c, i) => {
      const g = groups[i];
      if (!g.length) return c;
      return [0, 1, 2].map((ch) => g.reduce((s, p) => s + p[ch], 0) / g.length);
    });
  }
  return centers
    .map((c, i) => {
      const [h, s, l] = rgbToHsl(...c);
      return { h, s, l, share: groups[i].length / pixels.length };
    })
    .filter((c) => c.share >= 0.05);
};

// Reads the logo and returns { dark, vivid } colours, or null if it has no usable colour (all white / transparent).
export const extractPalette = async (src) => {
  const img = await loadImage(src);
  const scale = 96 / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.max(1, round(img.naturalWidth * scale));
  const h = Math.max(1, round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue; // transparent background
    const [, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (l > 0.93) continue; // white background
    if (s < 0.12 && l > 0.55) continue; // light grey / anti-aliasing
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (pixels.length < 40) return null;

  const clusters = clusterColors(pixels);
  if (!clusters.length) return null;
  const vivid = clusters.reduce((a, b) => (b.s > a.s ? b : a));
  const dark = clusters.reduce((a, b) => (b.l < a.l ? b : a));
  const other = clusters.find((c) => c !== vivid && c.s > 0.25 && Math.abs(c.h - vivid.h) > 35 && 360 - Math.abs(c.h - vivid.h) > 35);
  return { vivid, dark, other };
};

// Turns the palette into CSS for light and night mode.
export const buildCss = ({ vivid, dark, other }) => {
  const H = vivid.h;
  const S = clamp(vivid.s * 100, 45, 85);
  const D = dark.s > 0.15 ? dark.h : H; // hue of the darkest colour (navy in the ILMSphere logo) drives sidebar and ink
  const accentH = other ? other.h : H + 165; // a second logo colour if there is one, otherwise the opposite side of the wheel
  const accentS = other ? clamp(other.s * 100, 55, 85) : 65;

  const light = `
  --primary: ${hsl(H, S, 40)}; --primary-dark: ${hsl(H, S, 30)}; --primary-light: ${hsl(H, S, 52)}; --primary-soft: ${hsl(H, S * 0.7, 94)}; --on-primary: #ffffff;
  --accent: ${hsl(accentH, accentS, 48)}; --accent-soft: ${hsl(accentH, 70, 93)};
  --bg: ${hsl(H, 38, 96)}; --surface: #ffffff; --card: #ffffff; --surface-2: ${hsl(H, 42, 98)}; --input-bg: #ffffff; --topbar-bg: ${hsl(H, 40, 99, 0.88)};
  --text: ${hsl(D, 55, 13)}; --muted: ${hsl(D, 16, 40)}; --border: ${hsl(H, 28, 89)}; --label: ${hsl(D, 35, 24)};
  --sidebar-from: ${hsl(D, 70, 9)}; --sidebar-to: ${hsl(D, 62, 20)}; --sidebar-text: ${hsl(D, 38, 80)}; --sidebar-active: ${hsl(H, 90, 70)};
  --auth-glow-1: ${hsl(H, 85, 55, 0.35)}; --auth-glow-2: ${hsl(accentH, 75, 55, 0.28)};
  --ring: ${hsl(H, S, 55, 0.28)}; --btn-shadow: ${hsl(H, S, 30, 0.3)};
  --btn-bg: ${hsl(H, 30, 92)}; --btn-hover: ${hsl(H, 30, 85)};`;

  const night = `
  --primary: ${hsl(H, S, 66)}; --primary-dark: ${hsl(H, S, 55)}; --primary-light: ${hsl(H, S, 76)}; --primary-soft: ${hsl(H, S, 66, 0.16)}; --on-primary: #06101f;
  --accent: ${hsl(accentH, accentS, 62)}; --accent-soft: ${hsl(accentH, 70, 62, 0.14)};
  --bg: ${hsl(D, 45, 7)}; --surface: ${hsl(D, 38, 11)}; --card: ${hsl(D, 38, 11)}; --surface-2: ${hsl(D, 34, 15)}; --input-bg: ${hsl(D, 42, 9)}; --topbar-bg: ${hsl(D, 45, 7, 0.86)};
  --text: ${hsl(D, 40, 94)}; --muted: ${hsl(D, 18, 66)}; --border: ${hsl(D, 30, 21)}; --label: ${hsl(D, 30, 80)};
  --sidebar-from: ${hsl(D, 55, 5)}; --sidebar-to: ${hsl(D, 50, 12)}; --sidebar-text: ${hsl(D, 30, 76)}; --sidebar-active: ${hsl(H, 90, 72)};
  --auth-glow-1: ${hsl(H, 85, 55, 0.22)}; --auth-glow-2: ${hsl(accentH, 75, 55, 0.18)};
  --ring: ${hsl(H, S, 66, 0.32)}; --btn-shadow: rgba(0, 0, 0, .4);
  --btn-bg: ${hsl(D, 34, 19)}; --btn-hover: ${hsl(D, 34, 26)};`;

  return `html[data-theme='light'] {${light}\n}\nhtml[data-theme='dark'] {${night}\n}\nhtml[data-theme='dark'] body { background: radial-gradient(900px 420px at 100% -10%, var(--auth-glow-1), transparent 60%), radial-gradient(700px 380px at -10% 110%, var(--auth-glow-2), transparent 60%), var(--bg); background-attachment: fixed; }\n`;
};

// ---------- applying ----------
const setStyle = (css) => {
  let el = document.getElementById(STYLE_ID);
  if (!css) return el?.remove();
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
  }
  el.textContent = css;
  document.head.appendChild(el); // appending moves it to the end, so it always wins over the theme files
  return undefined;
};

const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; } };
const writeCache = (value) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch { /* ignore */ } };

// Runs before React draws, so the saved colours appear instantly (no flash of the default colours).
export const initLogoTheme = () => {
  if (!getPrefs().colors) return;
  const cached = readCache();
  if (cached?.css) setStyle(cached.css);
};

// Called whenever the logo (or the on/off switch) changes.
export const syncLogoTheme = async (src, enabled) => {
  if (!enabled) return setStyle(null);
  // Show the saved colours at once, then re-read the logo: the file may have been replaced under the same name.
  const cached = readCache();
  if (cached?.src === src && cached.css) setStyle(cached.css);
  try {
    const palette = await extractPalette(src);
    if (!palette) { setStyle(null); return writeCache(null); }
    const css = buildCss(palette);
    writeCache({ src, css });
    if (!cached || cached.css !== css || cached.src !== src) setStyle(css);
  } catch {
    setStyle(null); // logo file missing or unreadable: keep the default colours
  }
  return undefined;
};
