import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useFlash, Alert, fmtDateTime } from '../components/ui.jsx';

export default function Notifications() {
  const navigate = useNavigate();
  const [msg, , fail] = useFlash();
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

  return (
    <>
      <div className="row-between">
        <h1>Notifications {data.unreadCount > 0 && <span className="badge pending">{data.unreadCount} new</span>}</h1>
        <button className="btn btn-ghost" onClick={readAll} disabled={!data.unreadCount}>Mark all as read</button>
      </div>
      <Alert msg={msg} />
      {data.items.map((n) => (
        <div key={n._id} className="sub-card" style={{ cursor: 'pointer', opacity: n.isRead ? 0.65 : 1 }} onClick={() => open(n)}>
          <h4>{n.title}</h4>
          {n.message && <div>{n.message}</div>}
          <div className="muted small">{fmtDateTime(n.createdAt)}</div>
        </div>
      ))}
      {!data.items.length && <div className="card muted">You have no notifications.</div>}
    </>
  );
}
