import { getPrefs, setColorsPref, setWatermarkPref, useLogoPrefs } from '../logoTheme.js';

// Two small switches in the top bar: use the logo's colours, and show the spinning logo watermark.
export default function LogoToggles() {
  const { colors, watermark } = useLogoPrefs();
  return (
    <>
      <button
        type="button"
        className={`logo-toggle ${colors ? 'on' : ''}`}
        title={colors ? 'App colours follow the logo (click to use the default colours)' : 'Use the logo colours for the app'}
        aria-pressed={colors}
        onClick={() => setColorsPref(!getPrefs().colors)}
      >
        🎨
      </button>
      <button
        type="button"
        className={`logo-toggle ${watermark ? 'on' : ''}`}
        title={watermark ? 'Hide the spinning logo watermark' : 'Show the spinning logo watermark'}
        aria-pressed={watermark}
        onClick={() => setWatermarkPref(!getPrefs().watermark)}
      >
        🌐
      </button>
    </>
  );
}
