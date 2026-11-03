import { useState, useCallback } from 'react';
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

export function Alert({ msg }) {
  return msg?.text ? <div className={`alert alert-${msg.type}`}>{msg.text}</div> : null;
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
