import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useFlash, Alert, fmtDate, money } from '../components/ui.jsx';

const CELL = {
  paid: ['✓', 'Paid'],
  unpaid: ['✗', 'Not paid'],
  no_notice: ['!', 'No fee notice'],
  no_record: ['–', 'No record'],
  current: ['●', 'Current'],
};

// Promotion fee ledger: every student of a department against every semester they went through.
// It shows who is studying in a higher semester without having paid the promotion fee of the earlier ones.
export default function PromotionFees() {
  const role = useSelector((s) => s.auth.user.role);
  const navigate = useNavigate();
  const canAnnounce = ['finance_officer', 'hod'].includes(role);
  const [msg, , fail] = useFlash();
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState('');
  const [semNo, setSemNo] = useState('');
  const [onlyDues, setOnlyDues] = useState(true);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (role === 'hod') return;
    api.get('/semesters').then((r) => {
      const m = new Map();
      r.data.data.forEach((s) => s.department?._id && m.set(s.department._id, s.department));
      const list = [...m.values()].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      setDepartments(list);
      setDepartment((d) => d || list[0]?._id || '');
    }).catch(fail);
  }, [role, fail]);

  const load = useCallback(() => {
    if (role !== 'hod' && !department) return;
    setLoading(true);
    const params = { unpaidOnly: onlyDues ? 'true' : 'false' };
    if (role !== 'hod') params.department = department;
    if (semNo) params.semesterNumber = semNo;
    if (search.trim()) params.search = search.trim();
    api.get('/fees/promotion-ledger', { params }).then((r) => setData(r.data.data)).catch(fail).finally(() => setLoading(false));
  }, [role, department, semNo, onlyDues, search, fail]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const cols = useMemo(() => Array.from({ length: data?.columns || 0 }, (_, i) => i + 1), [data]);

  const exportCsv = () => {
    if (!data) return;
    const head = ['Roll', 'Student', 'Current semester', ...cols.map((n) => `Sem ${n}`), 'Unpaid semesters', 'Amount due'];
    const lines = data.rows.map((r) => [
      r.rollNumber, r.name, r.currentSemester,
      ...cols.map((n) => (r.cells[n] ? (CELL[r.cells[n].state] || ['', ''])[1] : '')),
      r.overdue, r.overdueAmount,
    ]);
    const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'promotion-fee-ledger.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const createNotices = () => navigate('/fee-notices', { state: { promotionSemesters: data.missingNotices.map((m) => m.semesterId), department } });

  return (
    <>
      <div className="row-between">
        <div>
          <h1>Promotion Fees</h1>
          <p className="muted">The promotion fee history of every student, semester by semester.</p>
        </div>
        {data && <button className="btn" onClick={exportCsv}>Download CSV</button>}
      </div>
      <Alert msg={msg} />

      <div className="card filters">
        {role !== 'hod' && (
          <div>
            <label>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.code} · {d.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label>Studying now in</label>
          <select value={semNo} onChange={(e) => setSemNo(e.target.value)}>
            <option value="">All semesters</option>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Semester {n}</option>)}
          </select>
        </div>
        <div><label>Search</label><input placeholder="Name or roll number" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <label className="check"><input type="checkbox" checked={onlyDues} onChange={(e) => setOnlyDues(e.target.checked)} /> Only students who have not paid</label>
      </div>

      {loading && !data && <p className="muted">Loading...</p>}

      {data && (
        <>
          <div className="pf-tiles">
            <div className="pf-tile"><b>{data.summary.students}</b><span>Students</span></div>
            <div className="pf-tile ok"><b>{data.summary.clear}</b><span>All promotion fees paid</span></div>
            <div className="pf-tile bad"><b>{data.summary.withDues}</b><span>Have not paid</span></div>
            <div className="pf-tile warn"><b>{money(data.summary.outstandingAmount)}</b><span>Unpaid on existing notices</span></div>
          </div>

          {data.missingNotices.length > 0 && (
            <div className="alert alert-info pf-missing">
              <div>
                <b>No promotion fee notice was ever created for:</b>{' '}
                {data.missingNotices.map((m) => `Semester ${m.number} (${m.students} student${m.students === 1 ? '' : 's'})`).join(', ')}.
                <div className="small">These students count as "not paid". Create a promotion fee notice and they can pay it from Fees &amp; Payments, even though they are in a higher semester now.</div>
              </div>
              {canAnnounce && <button className="btn btn-primary" onClick={createNotices}>Create promotion fee notice</button>}
            </div>
          )}

          <div className="card">
            <h3>Each semester at a glance</h3>
            <div className="pf-sems">
              {data.bySemester.map((b) => (
                <div key={b.number} className="pf-sem">
                  <b>Semester {b.number}</b>
                  <span className="ok">{b.paid} paid</span>
                  <span className="bad">{b.unpaid} not paid</span>
                  {b.noNotice > 0 && <span className="warn">{b.noNotice} no notice</span>}
                  {b.noRecord > 0 && <span className="gray">{b.noRecord} no record</span>}
                </div>
              ))}
              {!data.bySemester.length && <span className="muted">No data.</span>}
            </div>
            <p className="muted small">Counted for students who have already moved past that semester.</p>
          </div>

          <div className="card table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Roll</th><th>Student</th><th>Now in</th>
                  {cols.map((n) => <th key={n} className="c">Sem {n}</th>)}
                  <th className="c">Not paid</th><th>Due</th><th />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.student}>
                    <td>{r.rollNumber}</td>
                    <td><b>{r.name}</b></td>
                    <td className="small">{r.currentSemester}</td>
                    {cols.map((n) => {
                      const c = r.cells[n];
                      if (!c) return <td key={n} className="c"><span className="pf-cell none" /></td>;
                      const [sym, text] = CELL[c.state];
                      return <td key={n} className="c"><span className={`pf-cell ${c.state}`} title={`Semester ${n}: ${text}`}>{sym}</span></td>;
                    })}
                    <td className="c">{r.overdue > 0 ? <span className="pf-count">{r.overdue}</span> : <span className="pf-clear">Clear</span>}</td>
                    <td>{r.overdueAmount > 0 ? money(r.overdueAmount) : '—'}</td>
                    <td><button className="btn btn-small" onClick={() => setDetail(r)}>History</button></td>
                  </tr>
                ))}
                {!data.rows.length && <tr><td colSpan={cols.length + 6} className="muted">{onlyDues ? 'Every student in this selection has paid. Untick the box above to see everyone.' : 'No students found.'}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="pf-legend">
            {Object.entries(CELL).map(([k, [sym, text]]) => <span key={k}><i className={`pf-cell ${k}`}>{sym}</i>{text}</span>)}
          </div>
        </>
      )}

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="pf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <div><h3 style={{ margin: 0 }}>{detail.name}</h3><div className="muted small">{detail.rollNumber} · now in {detail.currentSemester}</div></div>
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
            </div>
            <div className="pf-history">
              {Object.keys(detail.cells).map((k) => {
                const c = detail.cells[k];
                const [sym, text] = CELL[c.state];
                return (
                  <div key={k} className={`pf-hrow ${c.state}`}>
                    <div className="pf-hhead"><span className={`pf-cell ${c.state}`}>{sym}</span><b>Semester {k}</b><em>{text}</em>{c.semesterName && <small>{c.semesterName}</small>}</div>
                    {c.lines?.map((l) => (
                      <div key={l.notice} className="pf-hline">
                        <span>{l.title} · {money(l.amount)} · due {fmtDate(l.dueDate)}</span>
                        <span>{l.paid ? `Paid ${fmtDate(l.paidAt)}${l.receiptNumber ? ` · receipt ${l.receiptNumber}` : ''}` : 'Not paid'}</span>
                      </div>
                    ))}
                    {c.state === 'no_notice' && <div className="pf-hline muted">No promotion fee notice exists for this semester, so nothing could be paid.</div>}
                    {c.state === 'no_record' && <div className="pf-hline muted">The system has no enrolment of this student in Semester {k}.</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
