import { useEffect, useRef, useState } from 'react';

// "Scan with the camera" for the library desk. It reads barcodes and QR codes (book labels, student ID cards) on a phone camera or a laptop webcam.
//   1. The browser's own BarcodeDetector is used when it exists (Chrome / Edge, phones and computers): fast and needs nothing else.
//   2. Otherwise (Firefox, Safari, some Windows browsers) the ZXing reader is loaded once from a CDN and does the same job.
//   3. When the camera cannot be used at all, the same window has a box to type the code (or use a USB scanner, which types it by itself).
// Every way ends in onCode(text), so the screens that use this button do not care how the code arrived.
const FORMATS = ['code_128', 'qr_code', 'code_39', 'ean_13', 'ean_8'];
const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';

let zxingLoading = null;
const loadZxing = () => {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxingLoading) {
    zxingLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = ZXING_URL;
      s.async = true;
      s.onload = () => (window.ZXing ? resolve(window.ZXing) : reject(new Error('The scanner library did not start')));
      s.onerror = () => { zxingLoading = null; reject(new Error('The scanner library could not be loaded')); };
      document.head.appendChild(s);
    });
  }
  return zxingLoading;
};

export default function ScanButton({ onCode, title = 'Scan with the camera', text = '📷 Scan', heading = 'Scan a barcode or QR code', hint = 'Hold the label in front of the camera. It is read automatically.' }) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState('');
  const [starting, setStarting] = useState(false);
  const [typed, setTyped] = useState('');
  const video = useRef(null);
  const handler = useRef(onCode);
  handler.current = onCode; // the camera keeps running even when the page behind re-renders

  useEffect(() => {
    if (!open) return undefined;
    let stream = null;
    let timer = null;
    let reader = null;
    let stopped = false;
    let finished = false;
    setProblem('');
    setTyped('');
    setStarting(true);

    const stop = () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (reader) { try { reader.reset(); } catch { /* already stopped */ } }
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    const found = (code) => {
      if (finished || !code) return;
      finished = true;
      stop();
      setOpen(false);
      handler.current(String(code));
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStarting(false);
        return setProblem('The camera is not available here. The page must be opened with https:// (or on localhost). You can type the code below instead.');
      }
      const constraints = { video: { facingMode: { ideal: 'environment' } }, audio: false }; // the back camera of a phone, or the webcam of a laptop
      try {
        const el = video.current;
        if (!el) return;
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: FORMATS });
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stopped) return stop();
          el.srcObject = stream;
          await el.play().catch(() => {});
          setStarting(false);
          timer = setInterval(async () => {
            if (!el.videoWidth) return;
            try {
              const codes = await detector.detect(el);
              if (codes.length && codes[0].rawValue) found(codes[0].rawValue);
            } catch { /* a frame could not be read: try the next one */ }
          }, 250);
        } else {
          const ZXing = await loadZxing();
          if (stopped) return;
          reader = new ZXing.BrowserMultiFormatReader();
          setStarting(false);
          await reader.decodeFromConstraints(constraints, el, (result) => { if (result) found(result.getText()); });
        }
      } catch (e) {
        setStarting(false);
        if (stopped) return;
        if (e?.name === 'NotAllowedError') setProblem('The camera was not allowed. Allow the camera for this site in the browser and try again, or type the code below.');
        else if (e?.name === 'NotFoundError') setProblem('No camera was found on this device. Type the code below, or use a USB barcode scanner.');
        else setProblem(`${e?.message || 'The camera could not be opened.'} You can type the code below instead.`);
      }
    })();

    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); stop(); };
  }, [open]);

  const useTyped = (e) => {
    e.preventDefault();
    const code = typed.trim();
    if (!code) return;
    setOpen(false);
    handler.current(code);
  };

  return (
    <>
      <button type="button" className="btn lib-scan-btn" title={title} aria-label={title} onClick={() => setOpen(true)}>{text}</button>
      {open && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal lib-scan-modal" role="dialog" aria-modal="true" aria-label={heading}>
            <h3>{heading}</h3>
            {problem ? <div className="alert alert-error">{problem}</div> : (
              <div className="lib-camera">
                <video ref={video} playsInline muted />
                <div className="lib-camera-frame" aria-hidden="true" />
                {starting && <div className="lib-camera-wait">Opening the camera…</div>}
              </div>
            )}
            {!problem && <p className="muted small">{hint}</p>}
            {/* The video element must exist before the camera starts, so it is also rendered (hidden) when there is a problem. */}
            {problem && <video ref={video} playsInline muted style={{ display: 'none' }} />}
            <form onSubmit={useTyped} className="lib-scan" style={{ marginTop: '.5rem' }}>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type the code / ID here" aria-label="Type the code" autoFocus={!!problem} />
              <button type="submit" className="btn btn-primary" disabled={!typed.trim()}>Use this code</button>
            </form>
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setOpen(false)}>Close</button></div>
          </div>
        </div>
      )}
    </>
  );
}
