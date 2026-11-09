import { useState, useCallback, useEffect } from 'react';
import api, { errorMessage } from '../api/axios.js';

export const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');
export const money = (n, cur = '') => `${cur} ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`.trim();
export const label = (s) => String(s || '').replace(/_/g, ' ');

// Message banner: const [msg, ok, fail, clear] = useFlash();
export function useFlash() {
  const [msg, setMsg] = useState({ type: '', text: '' });
  const ok = useCallback((text) => setMsg({ type: 'success', text }), []);
  const fail = useCallback((err) => setMsg({ type: 'error', text: typeof err === 'string' ? err : errorMessage(err) }), []);
  const clear = useCallback(() => setMsg({ type: '', text: '' }), []);
  return [msg, ok, fail, clear];
}

// The message window used by every page: <Alert msg={msg} />.
//   success: a green window that closes by itself after a few seconds (or with OK / Enter / Esc / a click outside)
//   error:   a red window that stays until it is closed, so the reason is never missed
// It opens again for every NEW message, also when the text is the same as before.
export function Alert({ msg }) {
  const [closed, setClosed] = useState(null);
  const open = !!msg?.text && closed !== msg;
  const close = useCallback(() => setClosed(msg), [msg]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = msg.type === 'success' ? setTimeout(close, 3500) : null;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (timer) clearTimeout(timer);
    };
  }, [open, msg, close]);

  if (!open) return null;
  const error = msg.type === 'error';
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={`modal ${error ? 'modal-error' : 'modal-success'}`} role={error ? 'alertdialog' : 'dialog'} aria-modal="true">
        <div className={`modal-icon ${error ? 'error' : 'success'}`}>{error ? '\u26d4' : '\u2705'}</div>
        <h3>{error ? 'Something went wrong' : 'Done'}</h3>
        <p className="modal-message">{msg.text}</p>
        <div className="modal-actions">
          <button type="button" autoFocus className={`btn ${error ? 'btn-danger' : 'btn-primary'}`} onClick={close}>OK</button>
        </div>
        {!error && <div className="modal-timer" />}
      </div>
    </div>
  );
}

export function Badge({ value, text }) {
  return <span className={`badge ${String(value).replace(/\s/g, '_')}`}>{label(text ?? value)}</span>;
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(([key, text]) => (
        <button key={key} type="button" className={active === key ? 'active' : ''} onClick={() => onChange(key)}>{text}</button>
      ))}
    </div>
  );
}

// Files live behind protected routes, so a plain <a href> would not send the login token.
// This fetches the file with the token and saves it.
export async function downloadFile(path, fallbackName = 'file') {
  const res = await api.get(path, { responseType: 'blob' });
  const cd = res.headers['content-disposition'] || '';
  const match = /filename="?([^";]+)"?/.exec(cd);
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = match ? decodeURIComponent(match[1]) : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// An error body arrives as a Blob here, so read it before showing the message.
export async function downloadSafe(path, fallbackName, fail) {
  try {
    await downloadFile(path, fallbackName);
  } catch (err) {
    const blob = err.response?.data;
    if (blob instanceof Blob) {
      try {
        const j = JSON.parse(await blob.text());
        return fail(j.message || 'Download failed');
      } catch { /* fall through */ }
    }
    fail(err);
  }
}

export function FileLink({ path, name, onError }) {
  return <button type="button" className="link-btn" onClick={() => downloadSafe(path, name, onError)}>{name}</button>;
}

export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const toInputDateTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
