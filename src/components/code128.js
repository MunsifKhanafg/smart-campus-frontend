// Code 128 (set B) encoder: turns a book copy code such as "LB-000012-01" into the widths of the bars and spaces of a barcode.
// Pure functions, no libraries. Set B covers every letter, digit and "-" that the library uses. Any USB barcode scanner reads it,
// and so does the camera scanner of the library desk (see ScanButton.jsx).

// Bar / space widths of the 106 symbols (value 0..105) and of the stop symbol (106), as in the Code 128 standard.
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const STOP = 106;

// Every character must be printable ASCII (space to "~"). Anything else is dropped, so a label never fails to draw.
export const cleanForCode128 = (text) => String(text ?? '').replace(/[^\x20-\x7e]/g, '');

// The symbol values of the barcode: start, the characters, the check symbol and the stop.
export const code128Values = (text) => {
  const chars = cleanForCode128(text);
  const values = [...chars].map((ch) => ch.charCodeAt(0) - 32);
  const sum = values.reduce((total, v, i) => total + v * (i + 1), START_B);
  return [START_B, ...values, sum % 103, STOP];
};

// [bar, space, bar, space, ...] widths in modules, starting with a bar.
export const code128Widths = (text) => {
  const out = [];
  for (const v of code128Values(text)) for (const d of PATTERNS[v]) out.push(Number(d));
  return out;
};

// Rectangles of the dark bars ({ x, w }) and the total width in modules (without the quiet zone).
export const code128Bars = (text) => {
  const widths = code128Widths(text);
  const bars = [];
  let x = 0;
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push({ x, w });
    x += w;
  });
  return { bars, width: x };
};

export const CODE128_PATTERNS = PATTERNS; // exported for the self-check
