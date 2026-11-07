import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { assetUrl } from '../api/axios.js';
import Logo from './Logo.jsx';

// THE way to show the university logo anywhere in the app (menu, sign-in, landing page, admission pages).
// Uploaded logo if there is one, otherwise the default emblem. Always on a white plate, so it is readable on any background.
export default function LogoPlate({ size = 48 }) {
  const logoUrl = useSelector((s) => s.settings.logoUrl);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [logoUrl]);

  if (!logoUrl || broken) return <Logo size={size} />;
  return (
    <span className="logo-plate" style={{ height: size }}>
      <img src={assetUrl(logoUrl)} alt="Logo" draggable={false} onError={() => setBroken(true)} />
    </span>
  );
}
