import { useEffect, useRef, useState } from 'react';

// "Scan with the camera" for the library desk. It uses the BarcodeDetector of the browser (Chrome and Edge on phones and computers), which reads
// Code 128 barcodes (the book labels) and QR codes. A USB barcode scanner needs no button: it types the code and presses Enter, so the input boxes
// next to this button already work with it. When the browser cannot scan, the window says so and the code can be typed.
const FORMATS = ['code_128', 'qr_code', 'code_39', 'ean_13', 'ean_8'];

export default function ScanButton({ onCode, title = 'Scan with the camera' }) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState('');
  const video = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let stream = null;
    let timer = null;
    let stopped = false;
    setProblem('');

    const stop = () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };

    (async () => {
      if (!('BarcodeDetector' in window)) return setProblem('This browser cannot read barcodes with the camera. Use a USB barcode scanner, or type the code.');
      if (!navigator.mediaDevices?.getUserMedia) return setProblem('The camera is not available here. The page must be opened with https:// (or on localhost) and the camera must be allowed.');
      try {
        const detector = new window.BarcodeDetector({ formats: FORMATS });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) return stop();
        const el = video.current;
        if (!el) return stop();
        el.srcObject = stream;
        await el.play().catch(() => {});
        timer = setInterval(async () => {
          if (!el.videoWidth) return;
          try {
            const found = await detector.detect(el);
            if (found.length && found[0].rawValue) {
              const code = found[0].rawValue;
              stop();
              setOpen(false);
              onCode(code);
            }
          } catch { /* a frame could not be read: try the next one */ }
        }, 300);
      } catch (e) {
        setProblem(e?.name === 'NotAllowedError' ? 'The camera was not allowed. Allow the camera for this site in the browser, then try again.' : 'The camera could not be opened.');
      }
    })();

    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); stop(); };
  }, [open, onCode]);

  return (
    <>
      <button type="button" className="btn lib-scan-btn" title={title} aria-label={title} onClick={() => setOpen(true)}>📷 Scan</button>
      {open && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Scan a barcode">
            <h3>Scan a barcode or QR code</h3>
            {problem ? <p className="modal-message">{problem}</p> : (
              <>
                <video ref={video} playsInline muted style={{ width: '100%', maxHeight: '55vh', background: '#000', borderRadius: 8 }} />
                <p className="muted small">Hold the label in front of the camera. It is read automatically.</p>
              </>
            )}
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setOpen(false)}>Close</button></div>
          </div>
        </div>
      )}
    </>
  );
}
