import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useFlash, Alert, fmtDateTime } from '../components/ui.jsx';

export default function Notifications() {
  const navigate = useNavigate();
  const [msg, ok, fail] = useFlash();
  const [data, setData] = useState({ items: [], unreadCount: 0 });

  const load = useCallback(async () => {
    try { setData((await api.get('/notifications')).data.data); } catch (e) { fail(e); }
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  const open = async (n) => {
    if (!n.isRead) await api.patch(`/notifications/${n._id}/read`).catch(() => {});
    if (n.link) navigate(n.link); else load();
  };
  const readAll = async () => { await api.post('/notifications/read-all').catch(fail); load(); };

  const remove = async (e, n) => {
    e.stopPropagation(); // do not open the notification
    try { await api.delete(`/notifications/${n._id}`); load(); } catch (err) { fail(err); }
  };
  const clear = async (readOnly) => {
    const text = readOnly ? 'Remove all notifications you have already read?' : 'Remove ALL notifications, including the unread ones?';
    if (!window.confirm(text)) return;
    try {
      const { data: res } = await api.delete('/notifications', { params: readOnly ? { readOnly: true } : {} });
      ok(res.message);
      load();
    } catch (err) { fail(err); }
  };

  const readCount = data.items.length - data.items.filter((n) => !n.isRead).length;

  return (
    <>
      <div className="row-between">
        <h1>Notifications {data.unreadCount > 0 && <span className="badge pending">{data.unreadCount} new</span>}</h1>
        <div className="actions">
          <button className="btn btn-ghost" onClick={readAll} disabled={!data.unreadCount}>Mark all as read</button>
          <button className="btn btn-ghost" onClick={() => clear(true)} disabled={!readCount}>Clear read</button>
          <button className="btn btn-danger" onClick={() => clear(false)} disabled={!data.items.length}>Clear all</button>
        </div>
      </div>
      <Alert msg={msg} />
      {data.items.map((n) => (
        <div key={n._id} className="sub-card" style={{ cursor: 'pointer', opacity: n.isRead ? 0.65 : 1 }} onClick={() => open(n)}>
          <div className="row-between">
            <h4>{n.title}</h4>
            <button type="button" className="btn btn-small btn-ghost" aria-label="Remove this notification" title="Remove" onClick={(e) => remove(e, n)}>✕</button>
          </div>
          {n.message && <div>{n.message}</div>}
          <div className="muted small">{fmtDateTime(n.createdAt)}</div>
        </div>
      ))}
      {!data.items.length && <div className="card muted">You have no notifications.</div>}
    </>
  );
}
