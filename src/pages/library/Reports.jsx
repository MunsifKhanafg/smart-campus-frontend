import { useEffect, useState } from 'react';
import api from '../../api/axios.js';
import { downloadSafe } from '../../components/ui.jsx';
import { clean } from './common.jsx';

const REPORTS = [
  ['inventory', 'Library inventory', 'Every title with its copies: available, issued, reserved, lost, damaged and price.', ['category']],
  ['issued', 'Currently issued books', 'Books that are out now, with due dates and fines that are building up.', ['department', 'dates']],
  ['overdue', 'Overdue books', 'Books past their return date, days late, fine so far, and whether a complaint was filed.', ['department', 'dates']],
  ['history', 'Issue and return history', 'Every loan in a period (default: the last 30 days).', ['department', 'dates']],
  ['fines', 'Fines and charges', 'Late fines, lost and damage charges, payments, waivers and what is still to pay.', ['department', 'dates']],
  ['lost-damaged', 'Lost and damaged books', 'Copies that are lost or damaged and the value of the lost ones.', []],
  ['students', 'Students holding books', 'Students who have a book now, with overdue books and fines to collect.', []],
];

// Reports from the live database: look at them on the screen, or download them as PDF or Excel.
export default function Reports({ fail, init = {} }) {
  const [type, setType] = useState(init.report || 'overdue');
  const [f, setF] = useState({ from: '', to: '', department: '', category: '' });
  const [depts, setDepts] = useState([]);
  const [cats, setCats] = useState([]);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const current = REPORTS.find((r) => r[0] === type);
  const uses = current[3];

  useEffect(() => {
    api.get('/departments').then((r) => setDepts(r.data.data)).catch(() => {});
    api.get('/library/categories').then((r) => setCats(r.data.data)).catch(() => {});
  }, []);

  const query = (format) => {
    const q = clean({ format, from: uses.includes('dates') ? f.from : '', to: uses.includes('dates') ? f.to : '', department: uses.includes('department') ? f.department : '', category: uses.includes('category') ? f.category : '' });
    return new URLSearchParams(q).toString();
  };

  const show = async () => {
    setBusy(true);
    setData(null);
    try { setData((await api.get(`/library/reports/${type}?${query('json')}`)).data.data); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  useEffect(() => { setData(null); }, [type]);

  return (
    <>
      <div className="lib-grid">
        {REPORTS.map(([id, title, text]) => (
          <button key={id} type="button" className={`card lib-book-card ${id === type ? 'lib-result' : ''}`} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setType(id)}>
            <b>{title}</b><span className="muted small">{text}</span>
          </button>
        ))}
      </div>

      <div className="card filters lib-noprint">
        {uses.includes('dates') && <><div><label>From</label><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div><div><label>To</label><input type="date" min={f.from || undefined} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div></>}
        {uses.includes('department') && <div><label>Department</label><select value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}><option value="">All departments</option>{depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>}
        {uses.includes('category') && <div><label>Category</label><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">All categories</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>}
        <div className="actions" style={{ alignSelf: 'flex-end' }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={show}>{busy ? 'Loading...' : 'Show report'}</button>
          <button type="button" className="btn" onClick={() => downloadSafe(`/library/reports/${type}?${query('pdf')}`, `library-${type}.pdf`, fail)}>⬇ PDF</button>
          <button type="button" className="btn" onClick={() => downloadSafe(`/library/reports/${type}?${query('xlsx')}`, `library-${type}.xlsx`, fail)}>⬇ Excel</button>
          {data && <button type="button" className="btn btn-ghost" onClick={() => window.print()}>Print</button>}
        </div>
      </div>

      {data && (
        <div className="card table-wrap">
          <h3>{data.title} <span className="muted small">· {data.today}</span></h3>
          <p>{data.summary.map(([k, v]) => <span key={k} style={{ marginRight: '1.25rem' }}>{k} <b>{String(v)}</b></span>)}</p>
          <table>
            <thead><tr>{data.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {data.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v ?? '')}</td>)}</tr>)}
              {!data.rows.length && <tr><td colSpan={data.columns.length} className="muted">Nothing to report.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
