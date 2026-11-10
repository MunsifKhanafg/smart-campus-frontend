import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { assetUrl } from '../api/axios.js';
import Logo from './Logo.jsx';

// THE way to show the university logo anywhere in the app (menu, sign-in, landing page, admission pages).
// Uploaded logo if there is one, otherwise the default emblem. Always on a white plate, so it is readable on any background.
export default function LogoPlate({ size = 48 }) {
  const logoUrl = useSelector((s) => s.settings.logoUrl);
  const [broken, setBroken] = useState(false);
  const [tries, setTries] = useState(0);
  useEffect(() => { setBroken(false); setTries(0); }, [logoUrl]);

  if (!logoUrl || broken) return <Logo size={size} />;
  // One quiet retry: right after a refresh the server may still be waking up (Vercel), which must not hide the logo for the whole visit.
  const src = `${assetUrl(logoUrl)}${tries ? `${logoUrl.includes('?') ? '&' : '?'}retry=${tries}` : ''}`;
  return (
    <span className="logo-plate" style={{ height: size }}>
      <img src={src} alt="Logo" draggable={false} onError={() => (tries < 1 ? setTimeout(() => setTries(1), 1500) : setBroken(true))} />
    </span>
  );
}
