import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, downloadSafe, fmtDateTime } from '../components/ui.jsx';
import { ProformaSheet, printProforma } from '../components/ProformaSheet.jsx';

// Marks proformas that teachers sent to the office.
//   Principal : every proforma sent to the principal
//   HOD       : the proformas of the own department (the HOD is the Examination Department)
//   Teacher   : the proformas the teacher sent (read only)
// What was sent is a snapshot: later corrections by the teacher create a NEW version and never change an older one.
export default function Proformas() {
  const { user } = useSelector((s) => s.auth);
  const canReceive = ['university_head', 'hod'].includes(user.role);
  const [params, setParams] = useSearchParams();
  const [msg, ok, fail] = useFlash();
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null); // { _id, version, sheet, ... }
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setList((await api.get('/proforma/submissions')).data.data); } catch (e) { fail(e); } finally { setLoading(false); }
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  const view = useCallback(async (id) => {
    try {
      setOpen((await api.get(`/proforma/submissions/${id}`)).data.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { fail(e); }
  }, [fail]);
  // A notification link (/proformas?open=ID) opens that proforma straight away.
  useEffect(() => { const id = params.get('open'); if (id) view(id); }, [params, view]);

  const close = () => { setOpen(null); if (params.get('open')) setParams({}, { replace: true }); };

  const receive = async (id) => {
    try { await api.post(`/proforma/submissions/${id}/receive`); ok('Marked as received. The teacher was told.'); load(); if (open?._id === id) view(id); } catch (e) { fail(e); }
  };
  const print = (sheet) => { if (!printProforma(sheet)) fail('The print window was blocked. Allow pop-ups for this site and try again.'); };

  const myRole = user.role === 'university_head' ? 'principal' : user.role === 'hod' ? 'examination' : null;
  const shownList = list.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [s.course?.code, s.course?.title, s.teacher?.name, s.department?.name, s.semester?.name].some((x) => String(x || '').toLowerCase().includes(q));
  });

  return (
    <>
      <h1>Marks Proformas</h1>
      <p className="muted">
        {user.role === 'teacher' ? 'The marks proformas you sent to the office.' : 'Subject-wise marks sheets (40 internal + 60 final term) sent by the teachers. Each version is kept exactly as it was sent.'}
      </p>
      <Alert msg={msg} />

      {open && (
        <div className="card">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>Version {open.version} · sent {fmtDateTime(open.createdAt)}</h3>
            <button className="btn btn-ghost" onClick={close}>Close</button>
          </div>
          {open.note && <p><b>Teacher's note:</b> {open.note}</p>}
          <ProformaSheet sheet={{ ...open.sheet, version: open.version }} />
          <div className="actions mt">
            <button className="btn" onClick={() => downloadSafe(`/proforma/submissions/${open._id}/export/pdf`, 'proforma.pdf', fail)}>Download PDF</button>
            <button className="btn" onClick={() => downloadSafe(`/proforma/submissions/${open._id}/export/xlsx`, 'proforma.xlsx', fail)}>Download Excel</button>
            <button className="btn" onClick={() => print({ ...open.sheet, version: open.version })}>Print</button>
            {canReceive && open.recipients.includes(myRole) && !open.receivedBy.some((r) => r.as === myRole) && (
              <button className="btn btn-primary" onClick={() => receive(open._id)}>Mark as received</button>
            )}
          </div>
        </div>
      )}

      <div className="card filters">
        <input placeholder="Search subject, teacher, department or semester..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Subject</th><th>Department</th><th>Semester</th><th>Teacher</th><th>Version</th><th>Sent</th><th>Marks</th><th>Received</th><th /></tr></thead>
          <tbody>
            {shownList.map((s) => (
              <tr key={s._id}>
                <td>{s.course?.code}<div className="muted small">{s.course?.title}</div></td>
                <td>{s.department?.code}</td>
                <td>{s.semester?.name}</td>
                <td>{s.teacher?.name}</td>
                <td>{s.version}</td>
                <td>{fmtDateTime(s.createdAt)}<div className="muted small">to {s.recipients.map((r) => (r === 'principal' ? 'Principal' : 'Examination')).join(' + ')}</div></td>
                <td className="small">
                  {s.summary?.students} students<br />passed {s.summary?.passed} · failed {s.summary?.failed}
                  {s.summary?.average !== null && s.summary?.average !== undefined && <><br />average {s.summary.average}</>}
                </td>
                <td>
                  {s.receivedBy?.length
                    ? s.receivedBy.map((r) => <div key={r.as}><Badge value="approved" text={`${r.as === 'principal' ? 'Principal' : 'Examination'}`} /></div>)
                    : <Badge value="pending" text="not yet" />}
                </td>
                <td className="actions">
                  <button className="btn btn-small" onClick={() => view(s._id)}>View</button>
                  {canReceive && s.recipients.includes(myRole) && !s.receivedBy?.some((r) => r.as === myRole) && <button className="btn btn-small btn-primary" onClick={() => receive(s._id)}>Received</button>}
                </td>
              </tr>
            ))}
            {!loading && !shownList.length && <tr><td colSpan={9} className="muted">No proforma has been sent yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
