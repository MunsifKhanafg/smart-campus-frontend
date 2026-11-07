import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api, { errorMessage } from '../api/axios.js';

const money = (n) => `PKR ${Math.round(n || 0).toLocaleString()}`;
const TYPES = [
  ['promotion', 'Promotion fees', 'c-promo', '#14b8a6'],
  ['examination', 'Exam fees', 'c-exam', '#6366f1'],
  ['other', 'Other fees', 'c-other', '#f59e0b'],
];

// Finance overview for the University Head (and Finance Officer): how much has been collected for promotion,
// exam and other fees, split by department and by month, and what is still outstanding.
export default function FinanceOverview() {
  const { user } = useSelector((s) => s.auth);
  const isFinance = user.role === 'finance_officer';
  const [depts, setDepts] = useState([]);
  const [department, setDepartment] = useState('');
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/departments').then((r) => setDepts(r.data.data)).catch(() => {}); }, []);

  useEffect(() => {
    setData(null);
    const params = department ? { department } : {};
    Promise.all([api.get('/fees/summary', { params }), api.get('/fees/report', { params })])
      .then(([s, r]) => { setData(s.data.data); setReport(r.data.data); setError(''); })
      .catch((e) => setError(errorMessage(e)));
  }, [department]);

  const maxDept = useMemo(() => Math.max(1, ...(data?.departments || []).map((d) => d.total)), [data]);
  const maxMonth = useMemo(() => Math.max(1, ...(data?.months || []).map((m) => m.examination + m.promotion + m.other)), [data]);

  return (
    <>
      <div className="row-between">
        <div>
          <h1>Finance overview</h1>
          <p className="muted" style={{ margin: 0 }}>Fees collected by type, department and month, and what is still unpaid.</p>
        </div>
        {isFinance && <Link className="btn btn-ghost" to="/finance">Open Finance Desk</Link>}
      </div>

      <div className="card filters" style={{ marginTop: '1rem' }}>
        <div>
          <label>Department</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!data && !error && <p className="muted">Loading finance data...</p>}

      {data && (
        <>
          <div className="big-boxes">
            <div className="big-box violet"><h3>Total collected</h3><span className="num">{money(data.total)}</span><small>All verified payments</small><span className="ico">💰</span></div>
            <div className="big-box teal"><h3>Promotion fees</h3><span className="num">{money(data.byType.promotion.collected)}</span><small>{data.byType.promotion.count} payments · {money(data.byType.promotion.outstanding)} unpaid</small><span className="ico">🎓</span></div>
            <div className="big-box"><h3>Exam fees</h3><span className="num">{money(data.byType.examination.collected)}</span><small>{data.byType.examination.count} payments · {money(data.byType.examination.outstanding)} unpaid</small><span className="ico">📝</span></div>
            <div className="big-box amber"><h3>Other fees</h3><span className="num">{money(data.byType.other.collected)}</span><small>{data.byType.other.count} payments · {money(data.byType.other.outstanding)} unpaid</small><span className="ico">🧾</span></div>
            <div className="big-box rose"><h3>Outstanding</h3><span className="num">{money(data.outstandingTotal)}</span><small>Still to be collected</small><span className="ico">⏳</span></div>
          </div>

          <div className="tiles">
            <div className="tile"><div className="ico">💳</div><div><b>{money(report?.collected.online.amount)}</b><span>Paid online ({report?.collected.online.count || 0})</span></div></div>
            <div className="tile teal"><div className="ico">🏦</div><div><b>{money(report?.collected.office.amount)}</b><span>Paid at office ({report?.collected.office.count || 0})</span></div></div>
            <div className="tile amber"><div className="ico">⚠️</div><div><b>{money(report?.lateFeesCollected)}</b><span>Late fees collected</span></div></div>
            <div className="tile rose"><div className="ico">↩️</div><div><b>{money(report?.refunded.amount)}</b><span>Refunded ({report?.refunded.count || 0})</span></div></div>
          </div>

          <div className="legend">
            {TYPES.map(([, label, cls]) => <span key={label}><i className={cls} />{label}</span>)}
          </div>

          <div className="chart-row">
            <div className="card">
              <h3>Collected by department</h3>
              {!data.departments.length && <p className="muted">No payments yet.</p>}
              {data.departments.map((d) => (
                <div key={d.name} className="hbar">
                  <span title={d.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <div className="track" style={{ width: `${(d.total / maxDept) * 100}%`, minWidth: 6 }}>
                    {TYPES.map(([key, , cls]) => <i key={key} className={cls} style={{ width: `${d.total ? (d[key] / d.total) * 100 : 0}%` }} />)}
                  </div>
                  <b>{money(d.total)}</b>
                </div>
              ))}
            </div>

            <div className="card">
              <h3>Collected by month</h3>
              {!data.months.length && <p className="muted">No payments yet.</p>}
              <div className="vbars">
                {data.months.map((m) => {
                  const total = m.examination + m.promotion + m.other;
                  return (
                    <div key={m.month} className="vbar" title={`${m.month}: ${money(total)}`}>
                      <small>{money(total).replace('PKR ', '')}</small>
                      <div className="stack" style={{ height: `${(total / maxMonth) * 82}%`, minHeight: 4 }}>
                        {TYPES.map(([key, , cls]) => <i key={key} className={cls} style={{ height: `${total ? (m[key] / total) * 100 : 0}%` }} />)}
                      </div>
                      <span>{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Collected vs outstanding</h3>
            {TYPES.map(([key, label, , color]) => {
              const t = data.byType[key];
              const sum = t.collected + t.outstanding;
              return (
                <div key={key} className="hbar" style={{ gridTemplateColumns: '130px 1fr 190px' }}>
                  <span>{label}</span>
                  <div className="track"><i style={{ width: `${sum ? (t.collected / sum) * 100 : 0}%`, background: color }} /></div>
                  <span>{money(t.collected)} of {money(sum)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
