// One shared set of colours, so a semester, a subject or a teacher looks the same on every screen.
// Each entry is a [from, to] pair used for a gradient. Components receive it as CSS variables (--c1, --c2).
export const PALETTE = [
  ['#6366f1', '#8b5cf6'], // indigo
  ['#0ea5e9', '#2563eb'], // blue
  ['#10b981', '#059669'], // green
  ['#f59e0b', '#ea580c'], // orange
  ['#ec4899', '#be185d'], // pink
  ['#14b8a6', '#0d9488'], // teal
  ['#ef4444', '#dc2626'], // red
  ['#8b5cf6', '#6d28d9'], // violet
];

// By position in a list: neighbours always get different colours.
export const colorAt = (i = 0) => {
  const [c1, c2] = PALETTE[Math.abs(i) % PALETTE.length];
  return { '--c1': c1, '--c2': c2 };
};

// By a stable key (for example a teacher's name): the same person keeps the same colour everywhere.
export const hashIndex = (key = '') => {
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
};
export const colorFor = (key) => colorAt(hashIndex(key));

export const initials = (name = '') =>
  String(name).split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

// Attendance colour: red below the limit, amber when close to it, green otherwise.
export const attendanceColor = (percent, min) => {
  if (percent === null || percent === undefined) return '#9ca3af';
  if (percent < min) return '#ef4444';
  if (percent < min + 10) return '#f59e0b';
  return '#10b981';
};
