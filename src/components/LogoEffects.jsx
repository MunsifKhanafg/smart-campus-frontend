import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { assetUrl } from '../api/axios.js';
import { DEFAULT_LOGO, syncLogoTheme, useLogoPrefs } from '../logoTheme.js';

// Two things that follow the university logo, wherever the person is in the app (also on the sign-in page):
//   1) the app colours are taken from the logo (logoTheme.js)
//   2) a faint logo slowly spins in the middle of the screen like a watermark (never blocks clicks)
export default function LogoEffects() {
  const logoUrl = useSelector((s) => s.settings.logoUrl);
  const src = logoUrl ? assetUrl(logoUrl) : DEFAULT_LOGO;
  const { colors, watermark } = useLogoPrefs();
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
    syncLogoTheme(src, colors);
  }, [src, colors]);

  if (!watermark || broken) return null;
  return (
    <div className="wm" aria-hidden="true">
      <img src={src} alt="" draggable={false} onError={() => setBroken(true)} />
    </div>
  );
}
