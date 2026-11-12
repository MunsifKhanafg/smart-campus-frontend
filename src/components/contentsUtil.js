// Splits the course contents text into SMALL items, so each can become its own numbered topic.
//
// Curriculum PDFs give the contents of a subject as a few long paragraphs of comma separated items:
//   "Data Transmission Concept, Introduction to Data Communication, Communication Model, Modems, ..."
//   "1. Transmission Impairments, Attenuation, Noise, Channel Capacity, Twisted Pair, ..."
// Splitting only on lines would give 2 items for a whole semester. So:
//   1. split on new lines, ";" and sentence ends (as before),
//   2. then split every line that lists several things on its commas (commas inside brackets are kept: "Codes (ASCII, EBCDIC)").
// A short line with one comma ("Loops, arrays") stays one item. Leading numbers and bullets are removed ("1." "2)" "-"),
// but a title such as "3D Graphics" keeps its "3".

// "1. x"  "10.2 x"  "3) x"  "- x"  "• x"
const LEADING = /^\s*(?:[-*\u2022]+\s*|\d+(?:\.\d+)*[.)]\s*|\d+(?:\.\d+)+\s+)/;

const clean = (s) => s.replace(LEADING, '').replace(/\s+/g, ' ').trim().replace(/[.;,:]+$/, '').trim();

// Commas that are not inside (), [] or {}.
const splitTopLevelCommas = (s) => {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
};

export const splitContents = (text, max = 300, width = 200) => {
  const lines = String(text || '').split(/\r?\n|;|(?<=\.)\s+(?=[A-Z])/).map(clean).filter((s) => s.length > 2);
  const items = lines.flatMap((line) => {
    const parts = splitTopLevelCommas(line).map(clean).filter((p) => p.length > 2);
    // three or more comma separated things = a list of small topics; two long halves = also two topics
    return parts.length >= 3 || (parts.length === 2 && line.length > 120) ? parts : [line];
  });
  return items.slice(0, max).map((s) => s.slice(0, width));
};
