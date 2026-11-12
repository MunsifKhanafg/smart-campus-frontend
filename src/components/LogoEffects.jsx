import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { DEFAULT_LOGO, syncLogoTheme, useLogoPrefs } from '../logoTheme.js';
import { useLogoSrc, cacheLogo, clearLogoCache } from '../logoCache.js';

// Things that follow the university logo, wherever the person is in the app (also on the sign-in page):
//   1) the app colours are taken from the logo (logoTheme.js)
//   2) a faint logo slowly spins in the middle of the screen like a watermark (never blocks clicks)
//   3) the latest logo is saved in the browser while the server answers, so it can be shown when the server is down (logoCache.js)
export default function LogoEffects() {
  const { logoUrl, loaded, offline } = useSelector((s) => s.settings);
  const { src: logoSrc, onError, hasLogo } = useLogoSrc();
  const src = hasLogo && logoSrc ? logoSrc : DEFAULT_LOGO;
  const { colors, watermark } = useLogoPrefs();
  const [broken, setBroken] = useState(false);

  // Only trust the settings when they really came from the server (not from the browser's remembered copy).
  useEffect(() => {
    if (!loaded || offline) return;
    if (logoUrl) cacheLogo(logoUrl);
    else clearLogoCache();
  }, [logoUrl, loaded, offline]);

  useEffect(() => {
    setBroken(false);
    syncLogoTheme(src, colors);
  }, [src, colors]);

  if (!watermark || broken) return null;
  return (
    <div className="wm" aria-hidden="true">
      <img src={src} alt="" draggable={false} onError={() => { onError(); setBroken(true); }} />
    </div>
  );
}
