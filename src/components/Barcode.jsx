import { code128Bars } from './code128.js';

// A Code 128 barcode as an SVG. It stretches to the width of its box (see .lib-label svg in pages/library.css). Always black on white with a quiet
// zone, also in dark mode, because scanners need the contrast.
export default function Barcode({ value, height = 46 }) {
  const { bars, width } = code128Bars(value);
  const quiet = 10; // empty modules left and right of the bars
  return (
    <svg viewBox={`0 0 ${width + quiet * 2} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Barcode ${value}`} shapeRendering="crispEdges">
      <rect x="0" y="0" width={width + quiet * 2} height={height} fill="#fff" />
      {bars.map((b) => <rect key={b.x} x={b.x + quiet} y="0" width={b.w} height={height} fill="#000" />)}
    </svg>
  );
}
