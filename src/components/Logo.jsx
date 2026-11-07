import { useState } from 'react';

// The default emblem, shown when no logo has been uploaded in Settings (menu, sign-in, landing page).
// Save your logo image as client/public/brand/logo.png (transparent or white background both work).
// It always sits on a white plate (see .logo-plate in logo.css), so it stays visible on dark and coloured panels.
// The plate takes the logo's own proportions: a wide logo with a name gets a wide plate, a square mark a square one.
// If the file is missing, a built-in emblem is drawn instead, so the page never shows a broken image.
const SOURCES = ['/brand/logo.png', '/brand/logo-mark.png'];

export default function Logo({ size = 48 }) {
  const [index, setIndex] = useState(0);
  if (index >= SOURCES.length) return <FallbackEmblem size={size} />;
  return (
    <span className="logo-plate" style={{ height: size }}>
      <img src={SOURCES[index]} alt="Logo" draggable={false} onError={() => setIndex(index + 1)} />
    </span>
  );
}

export function FallbackEmblem({ size }) {
  return (
    <span className="logo-plate" style={{ height: size, width: size }}>
      <svg width="100%" height="100%" viewBox="0 0 64 64" role="img" aria-label="Logo">
        <defs>
          <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1471d8" />
            <stop offset="1" stopColor="#0b2a5b" />
          </linearGradient>
        </defs>
        <path d="M32 3 56 12v18c0 15-10 26-24 31C18 56 8 45 8 30V12z" fill="url(#lg1)" />
        <path d="M32 14 14 23l18 9 18-9z" fill="#fff" />
        <path d="M21 30v8c0 3 5 6 11 6s11-3 11-6v-8l-11 5.5z" fill="#fff" opacity=".85" />
        <rect x="47" y="24" width="2.4" height="13" rx="1.2" fill="#8ec5ff" />
        <circle cx="48.2" cy="39" r="2.4" fill="#8ec5ff" />
      </svg>
    </span>
  );
}
