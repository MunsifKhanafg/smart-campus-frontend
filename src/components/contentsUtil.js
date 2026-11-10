// Splits the course contents text into separate items: one per line, per ";" or per sentence.
// If that gives one long line of comma separated items, it splits on the commas instead.
export const splitContents = (text, max = 60, width = 200) => {
  const clean = (s) => s.replace(/^[\s\-•*\u2022\d.)]+/, '').replace(/\s+/g, ' ').trim().replace(/[.;,]$/, '');
  let items = String(text || '').split(/\r?\n|;|(?<=\.)\s+(?=[A-Z])/).map(clean).filter((s) => s.length > 2);
  if (items.length === 1 && items[0].includes(',')) items = items[0].split(',').map(clean).filter((s) => s.length > 2);
  return items.slice(0, max).map((s) => s.slice(0, width));
};
