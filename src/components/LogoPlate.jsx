import { useLogoSrc } from '../logoCache.js';
import Logo from './Logo.jsx';

// THE way to show the university logo anywhere in the app (menu, sign-in, landing page, admission pages).
// Uploaded logo if there is one, otherwise the default emblem. Always on a white plate, so it is readable on any background.
// The latest logo is also saved in the browser (logoCache.js), so it still shows when the server is down on the first load.
export default function LogoPlate({ size = 48 }) {
  const { src, onError, hasLogo } = useLogoSrc();
  if (!hasLogo || !src) return <Logo size={size} />;
  return (
    <span className="logo-plate" style={{ height: size }}>
      <img src={src} alt="Logo" draggable={false} onError={onError} />
    </span>
  );
}
