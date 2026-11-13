import { useEffect, useRef, useState } from 'react';

// "Scan with the camera" for the library desk (phone cameras and laptop webcams).
//  1. Chrome / Edge / Android: the browser's own BarcodeDetector (fast, nothing to download).
//  2. Safari / Firefox / others: the html5-qrcode reader, loaded once from a CDN the first time someone opens the scanner.
// Both read Code 128 barcodes (the book labels), QR codes and student ID cards. A USB scanner needs no button (it types the code and presses
// Enter). When the camera cannot be used the window says why, and the code can always be typed by hand.
const FORMATS = ['code_128', 'qr_code', 'code_39', 'ean_13', 'ean_8'];
const LIB_URL = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';

let libPromise = null;
const loadFallback = () => {
  if (window.Html5Qrcode) return Promise.resolve(window.Html5Qrcode);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = LIB_URL;
      s.async = true;
      s.onload = () => (window.Html5Qrcode ? resolve(window.Html5Qrcode) : reject(new Error('missing')));
      s.onerror = () => { libPromise = null; reject(new Error('load')); };
      document.head.appendChild(s);
    });
  }
  return libPromise;
};

const cameraProblem = (e) => {
  if (e?.name === 'NotAllowedError' || /permission|denied|allowed/i.test(String(e?.message || e))) return 'The camera was not allowed. Allow the camera for this site in the browser, then try again, or type the code.';
  if (e?.name === 'NotFoundError') return 'No camera was found on this device. Type the code instead.';
  if (e?.message === 'load') return 'The scanner could not be loaded (no internet?). Type the code instead.';
  return 'The camera could not be opened. Type the code instead.';
};

export default function ScanButton({ onCode, title = 'Scan with the camera', text = '📷 Scan', className = 'btn lib-scan-btn', heading = 'Scan a barcode or QR code' }) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState('');
  const [starting, setStarting] = useState(true);
  const [manual, setManual] = useState('');
  const video = useRef(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    if (!open) return undefined;
    let stream = null;
    let timer = null;
    let stopped = false;
    let fallback = null;
    setProblem('');
    setStarting(true);
    setManual('');

    const finish = (code) => {
      if (stopped) return;
      stop(); // eslint-disable-line no-use-before-define
      setOpen(false);
      onCodeRef.current(code);
    };
    function stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (fallback) { const f = fallback; fallback = null; f.stop().then(() => f.clear()).catch(() => {}); }
    }

    (async () => {
      if (!window.isSecureContext && location.hostname !== 'localhost') { setStarting(false); return setProblem('The camera needs a secure page (https://). Type the code instead.'); }
      if (!navigator.mediaDevices?.getUserMedia) { setStarting(false); return setProblem('The camera is not available in this browser. Type the code instead.'); }
      try {
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: FORMATS });
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
          if (stopped) return stop();
          const el = video.current;
          if (!el) return stop();
          el.srcObject = stream;
          await el.play().catch(() => {});
          setStarting(false);
          timer = setInterval(async () => {
            if (!el.videoWidth) return;
            try {
              const found = await detector.detect(el);
              if (found.length && found[0].rawValue) finish(found[0].rawValue);
            } catch { /* a frame could not be read: try the next one */ }
          }, 300);
        } else {
          const Html5Qrcode = await loadFallback();
          if (stopped) return;
          fallback = new Html5Qrcode('lib-scan-region');
          await fallback.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 160 } }, (decoded) => finish(decoded), () => {});
          setStarting(false);
        }
      } catch (e) {
        setStarting(false);
        setProblem(cameraProblem(e));
      }
    })();

    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); stop(); };
  }, [open]);

  const submitManual = (e) => {
    e.preventDefault();
    const v = manual.trim();
    if (!v) return;
    setOpen(false);
    onCodeRef.current(v);
  };

  return (
    <>
      <button type="button" className={className} title={title} aria-label={title} onClick={() => setOpen(true)}>{text}</button>
      {open && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={heading}>
            <h3>{heading}</h3>
            {problem ? <div className="alert alert-error">{problem}</div> : (
              <>
                {'BarcodeDetector' in window
                  ? <video ref={video} playsInline muted style={{ width: '100%', maxHeight: '55vh', background: '#000', borderRadius: 8 }} />
                  : <div id="lib-scan-region" style={{ width: '100%', minHeight: 220, background: '#000', borderRadius: 8, overflow: 'hidden' }} />}
                {starting && <p className="muted small"><span className="lib-spinner" /> Opening the camera...</p>}
                {!starting && <p className="muted small">Hold the label or ID card in front of the camera. It is read automatically.</p>}
              </>
            )}
            <form className="lib-scan" onSubmit={submitManual} style={{ marginTop: '.75rem' }}>
              <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Or type the code here" aria-label="Type the code" />
              <button className="btn btn-primary" disabled={!manual.trim()}>Use this code</button>
            </form>
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setOpen(false)}>Close</button></div>
          </div>
        </div>
      )}
    </>
  );
}
