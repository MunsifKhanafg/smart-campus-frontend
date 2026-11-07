import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate, toInputDate, money } from '../components/ui.jsx';

const EMPTY = {
  semester: '', examination: '', title: '', feeType: 'examination', amount: '', startDate: '', dueDate: '',
  lateFee: 0, lateDueDate: '', requirements: '', requiredDocuments: '',
};

const FIELDS = { amount: '', practicalFee: '', lateFee: '', practicalLateFee: '', maxPracticals: '3', startDate: '', dueDate: '', lateDueDate: '', requirements: '', requiredDocuments: '' };
const NEW_ANN = { title: '', feeType: 'examination', examType: 'midterm', scope: 'all', department: '', semester: '', defaults: { ...FIELDS }, rows: {}, only: null };
const TYPE_TEXT = { examination: 'Examination fee', promotion: 'Promotion fee', other: 'Other charge' };
const csv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

// Fee notices. The Finance Officer (all departments) and an HOD (own department) create and publish them.
// A "fee announcement" creates the notice of EVERY semester in one go (each with its own fee, practical fee, late fee,
// dates and requirements) and sends it to the students, teachers and HODs. A single notice is still possible.
export default function FeeNotices() {
  const role = useSelector((s) => s.auth.user.role);
  const location = useLocation();
  const navigate = useNavigate();
  const canEdit = ['finance_officer', 'hod'].includes(role);
  const [msg, ok, fail] = useFlash();
  const [notices, setNotices] = useState([]);
  const [anns, setAnns] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [exams, setExams] = useState([]);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(null); // single notice: null | EMPTY | { _id, ... }
  const [ann, setAnn] = useState(null); // announcement form
  const [open, setOpen] = useState({});
  const [paid, setPaid] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/fees/notices', { params: status ? { status } : {} }).then((r) => setNotices(r.data.data)).catch(fail);
    api.get('/fees/announcements').then((r) => setAnns(r.data.data)).catch(fail);
  }, [status, fail]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!canEdit) return;
    api.get('/semesters').then((r) => setSemesters(r.data.data.filter((s) => s.status !== 'archived'))).catch(fail);
  }, [canEdit, fail]);

  // Coming from the promotion ledger: open the announcement form for the semesters that have no promotion notice yet.
  useEffect(() => {
    const st = location.state;
    if (!st?.promotionSemesters || !canEdit) return;
    setAnn({ ...NEW_ANN, title: 'Semester promotion fee', feeType: 'promotion', scope: 'all', department: st.department || '', only: st.promotionSemesters });
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate, canEdit]);

  // Examination sessions of the chosen semester (only an HOD can list them) for the single-notice form.
  useEffect(() => {
    if (role !== 'hod' || !form?.semester) { setExams([]); return; }
    api.get('/examinations').then((r) => setExams(r.data.data.filter((x) => x.semester?._id === form.semester))).catch(() => setExams([]));
  }, [role, form?.semester]);

  // ---------- single notice ----------
  const save = async (e) => {
    e.preventDefault();
    const body = {
      title: form.title, feeType: form.feeType, amount: Number(form.amount), startDate: form.startDate, dueDate: form.dueDate,
      lateFee: Number(form.lateFee || 0), lateDueDate: form.lateDueDate || null, requirements: form.requirements || undefined,
      requiredDocuments: csv(form.requiredDocuments),
    };
    try {
      if (form._id) {
        await api.put(`/fees/notices/${form._id}`, body);
      } else {
        const sem = semesters.find((s) => s._id === form.semester);
        await api.post('/fees/notices', {
          ...body, semester: form.semester,
          department: role === 'finance_officer' ? sem?.department?._id : undefined,
          examination: form.examination || null,
        });
      }
      ok('Fee notice saved as draft. Publish it when it is ready.');
      setForm(null);
      load();
    } catch (err) { fail(err); }
  };

  const act = async (n, action) => {
    const text = { publish: 'Publish this notice? Students, teachers and the HOD will be notified.', close: 'Close this notice? Nobody can pay it afterwards.' }[action];
    if (!window.confirm(text)) return;
    try { await api.post(`/fees/notices/${n._id}/${action}`); ok(`Notice ${action === 'publish' ? 'published' : 'closed'}`); load(); } catch (err) { fail(err); }
  };

  const showPaid = async (n) => {
    try { setPaid((await api.get('/fees/status', { params: { notice: n._id } })).data.data); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } catch (err) { fail(err); }
  };

  const edit = (n) => setForm({
    _id: n._id, title: n.title, feeType: n.feeType, amount: n.amount, startDate: toInputDate(n.startDate), dueDate: toInputDate(n.dueDate),
    lateFee: n.lateFee, lateDueDate: toInputDate(n.lateDueDate), requirements: n.requirements || '', requiredDocuments: (n.requiredDocuments || []).join(', '),
    semester: n.semester?._id, examination: '',
  });

  // ---------- announcement ----------
  const departments = useMemo(() => {
    const m = new Map();
    semesters.forEach((s) => s.department?._id && m.set(s.department._id, s.department));
    return [...m.values()].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [semesters]);

  const list = useMemo(() => {
    if (!ann) return [];
    const isPromo = ann.feeType === 'promotion';
    return semesters
      .filter((s) => (isPromo || !['completed', 'archived'].includes(s.status))
        && (role === 'hod' || !ann.department || s.department?._id === ann.department)
        && (!ann.only || ann.only.includes(s._id))
        && (ann.scope === 'all' || s._id === ann.semester))
      .sort((a, b) => (a.department?.code || '').localeCompare(b.department?.code || '') || a.number - b.number);
  }, [ann, semesters, role]);

  const val = (id, k) => ann.rows[id]?.[k] ?? ann.defaults[k];
  const setRow = (id, k, v) => setAnn({ ...ann, rows: { ...ann.rows, [id]: { ...ann.rows[id], [k]: v } } });
  const setDef = (k, v) => setAnn({ ...ann, defaults: { ...ann.defaults, [k]: v } });
  const included = (id) => ann.rows[id]?.include !== false;
  const isExam = ann?.feeType === 'examination';
  const hasPrac = ['examination', 'promotion'].includes(ann?.feeType); // practicals can be added to exam AND promotion fees

  const sendAnn = async (publish) => {
    const chosen = list.filter((s) => included(s._id));
    if (!chosen.length) return fail('Choose at least one semester');
    const lines = [];
    for (const s of chosen) {
      const v = (k) => val(s._id, k);
      if (!v('startDate') || !v('dueDate')) return fail(`${s.department?.code} ${s.name}: set the start date and the payment deadline`);
      if (!(Number(v('amount')) > 0)) return fail(`${s.department?.code} ${s.name}: enter the fee amount`);
      lines.push({
        semester: s._id, amount: Number(v('amount')), practicalFee: hasPrac ? Number(v('practicalFee') || 0) : 0,
        maxPracticals: hasPrac ? Math.min(6, Math.max(0, Number(v('maxPracticals') || 3))) : 3,
        lateFee: Number(v('lateFee') || 0), practicalLateFee: hasPrac ? Number(v('practicalLateFee') || 0) : 0,
        startDate: v('startDate'), dueDate: v('dueDate'), lateDueDate: v('lateDueDate') || null,
        requirements: v('requirements') || undefined, requiredDocuments: csv(v('requiredDocuments')),
      });
    }
    if (publish && !window.confirm(`Send this fee announcement now?\n\n${lines.length} semester(s). The students of these semesters, their teachers and the HODs get a notification.`)) return;
    setBusy(true);
    try {
      const { data } = await api.post('/fees/announcements', { title: ann.title, feeType: ann.feeType, examType: isExam ? ann.examType || null : null, lines, publish });
      const w = data.data.warnings?.length ? ` Note: ${data.data.warnings.join(' ')}` : '';
      ok(`${data.message}.${w}`);
      setAnn(null);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const batchAct = async (a, action) => {
    const text = action === 'publish' ? 'Publish every draft in this announcement? Students, teachers and HODs will be notified.' : 'Close this announcement? Nobody can pay these fees afterwards.';
    if (!window.confirm(text)) return;
    try { const { data } = await api.post(`/fees/batches/${a.batch}/${action}`); ok(data.message); load(); } catch (err) { fail(err); }
  };

  const anyPractical = (a) => a.lines.some((l) => l.practical || l.main?.practicalFee > 0);

  return (
    <>
      <div className="row-between">
        <h1>Fee Notices</h1>
        {canEdit && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => { setForm(null); setAnn({ ...NEW_ANN, department: role === 'hod' ? '' : '' }); }}>+ Fee announcement</button>
            <button className="btn" onClick={() => { setAnn(null); setForm(EMPTY); }}>+ Single notice</button>
          </div>
        )}
      </div>
      <Alert msg={msg} />

      {/* ---------- fee announcement form ---------- */}
      {ann && canEdit && (
        <div className="card fee-ann">
          <div className="row-between"><h3>New fee announcement</h3><button className="btn btn-ghost" onClick={() => setAnn(null)}>Cancel</button></div>
          <div className="form-grid">
            <div><label>Announcement title</label><input required placeholder="Mid-Term Examination Fee, Fall 2026" value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} /></div>
            <div>
              <label>What is it for?</label>
              <select value={ann.feeType} onChange={(e) => setAnn({ ...ann, feeType: e.target.value, only: null })}>
                {Object.entries(TYPE_TEXT).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </div>
            {isExam && (
              <div>
                <label>Exam session</label>
                <select value={ann.examType} onChange={(e) => setAnn({ ...ann, examType: e.target.value })}>
                  <option value="midterm">Midterm</option>
                  <option value="final">Final term</option>
                  <option value="other">Other exam</option>
                  <option value="">Do not link to an exam</option>
                </select>
              </div>
            )}
            {role !== 'hod' && (
              <div>
                <label>Department</label>
                <select value={ann.department} onChange={(e) => setAnn({ ...ann, department: e.target.value, semester: '' })}>
                  <option value="">All departments</option>
                  {departments.map((d) => <option key={d._id} value={d._id}>{d.code} · {d.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="fee-scope">
            <label className={ann.scope === 'all' ? 'on' : ''}>
              <input type="radio" checked={ann.scope === 'all'} onChange={() => setAnn({ ...ann, scope: 'all' })} />
              <b>All semesters</b><span>One announcement with every semester's fee, dates and requirements</span>
            </label>
            <label className={ann.scope === 'one' ? 'on' : ''}>
              <input type="radio" checked={ann.scope === 'one'} onChange={() => setAnn({ ...ann, scope: 'one' })} />
              <b>One semester / one exam</b><span>Only the semester you pick</span>
            </label>
          </div>
          {ann.scope === 'one' && (
            <div className="form-grid">
              <div>
                <label>Semester</label>
                <select value={ann.semester} onChange={(e) => setAnn({ ...ann, semester: e.target.value })}>
                  <option value="">Select...</option>
                  {semesters.filter((s) => (ann.feeType === 'promotion' || !['completed', 'archived'].includes(s.status)) && (role === 'hod' || !ann.department || s.department?._id === ann.department))
                    .map((s) => <option key={s._id} value={s._id}>{s.department?.code} · {s.name} ({s.academicYear})</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="fee-defaults">
            <b>Same for every semester</b>
            <span className="muted small">Fill this once, then change any semester in the table below.</span>
            <div className="fee-grid">
              <div><label>{isExam ? 'Exam fee' : 'Fee'}</label><input type="number" min={0} value={ann.defaults.amount} onChange={(e) => setDef('amount', e.target.value)} /></div>
              {hasPrac && <div><label>Practical fee (for each practical)</label><input type="number" min={0} value={ann.defaults.practicalFee} onChange={(e) => setDef('practicalFee', e.target.value)} /></div>}
              {hasPrac && (
                <div>
                  <label>Most practicals a student can have</label>
                  <select value={ann.defaults.maxPracticals} onChange={(e) => setDef('maxPracticals', e.target.value)}>
                    <option value="1">1 practical</option><option value="2">2 practicals</option><option value="3">3 practicals</option>
                  </select>
                </div>
              )}
              <div><label>Late fee</label><input type="number" min={0} value={ann.defaults.lateFee} onChange={(e) => setDef('lateFee', e.target.value)} /></div>
              {hasPrac && <div><label>Practical late fee (each)</label><input type="number" min={0} value={ann.defaults.practicalLateFee} onChange={(e) => setDef('practicalLateFee', e.target.value)} /></div>}
              <div><label>Collection starts</label><input type="date" value={ann.defaults.startDate} onChange={(e) => setDef('startDate', e.target.value)} /></div>
              <div><label>Normal deadline</label><input type="date" value={ann.defaults.dueDate} onChange={(e) => setDef('dueDate', e.target.value)} /></div>
              <div><label>Late deadline</label><input type="date" value={ann.defaults.lateDueDate} onChange={(e) => setDef('lateDueDate', e.target.value)} /></div>
              <div className="wide"><label>Requirements for exam admission</label><input value={ann.defaults.requirements} onChange={(e) => setDef('requirements', e.target.value)} placeholder="75% attendance, fee paid, documents approved" /></div>
              <div className="wide"><label>Required documents (comma separated)</label><input value={ann.defaults.requiredDocuments} onChange={(e) => setDef('requiredDocuments', e.target.value)} placeholder="transcript, photo" /></div>
            </div>
            {Object.keys(ann.rows).length > 0 && <button type="button" className="btn btn-small" onClick={() => setAnn({ ...ann, rows: {} })}>Reset every semester to these values</button>}
          </div>

          <div className="table-wrap">
            <table className="fee-table">
              <thead>
                <tr>
                  <th>Send</th><th>Semester</th><th>{isExam ? 'Exam fee' : 'Fee'}</th>{hasPrac && <th>Practical</th>}<th>Late fee</th>{hasPrac && <th>Practical late</th>}
                  <th>Starts</th><th>Deadline</th><th>Late until</th><th>Requirements</th><th>Documents</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s._id} className={included(s._id) ? '' : 'off'}>
                    <td><input type="checkbox" checked={included(s._id)} onChange={(e) => setRow(s._id, 'include', e.target.checked)} /></td>
                    <td><b>{s.department?.code} · {s.name}</b><div className="muted small">{s.academicYear} · {s.status}</div></td>
                    <td><input type="number" min={0} value={val(s._id, 'amount')} onChange={(e) => setRow(s._id, 'amount', e.target.value)} /></td>
                    {hasPrac && <td><input type="number" min={0} value={val(s._id, 'practicalFee')} onChange={(e) => setRow(s._id, 'practicalFee', e.target.value)} /></td>}
                    <td><input type="number" min={0} value={val(s._id, 'lateFee')} onChange={(e) => setRow(s._id, 'lateFee', e.target.value)} /></td>
                    {hasPrac && <td><input type="number" min={0} value={val(s._id, 'practicalLateFee')} onChange={(e) => setRow(s._id, 'practicalLateFee', e.target.value)} /></td>}
                    <td><input type="date" value={val(s._id, 'startDate')} onChange={(e) => setRow(s._id, 'startDate', e.target.value)} /></td>
                    <td><input type="date" value={val(s._id, 'dueDate')} onChange={(e) => setRow(s._id, 'dueDate', e.target.value)} /></td>
                    <td><input type="date" value={val(s._id, 'lateDueDate')} onChange={(e) => setRow(s._id, 'lateDueDate', e.target.value)} /></td>
                    <td><input value={val(s._id, 'requirements')} onChange={(e) => setRow(s._id, 'requirements', e.target.value)} /></td>
                    <td><input value={val(s._id, 'requiredDocuments')} onChange={(e) => setRow(s._id, 'requiredDocuments', e.target.value)} /></td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={11} className="muted">{ann.scope === 'one' ? 'Choose a semester above.' : 'No semesters found for this choice.'}</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            A student who pays after the deadline but before the late deadline pays the fee plus the late fee. The server calculates it when they pay.
            {hasPrac && ' The student says how many practicals they have (1, 2 or 3). Fee = fee + practicals x practical fee, paid as ONE amount (the same rule applies to the late fee). Exam admission checks that this single payment is paid.'}
          </p>
          <div className="actions">
            <button className="btn btn-primary" disabled={busy} onClick={() => sendAnn(true)}>Send to students, teachers and HODs</button>
            <button className="btn" disabled={busy} onClick={() => sendAnn(false)}>Save as draft</button>
          </div>
        </div>
      )}

      {/* ---------- single notice form ---------- */}
      {form && canEdit && (
        <form className="card" onSubmit={save}>
          <h3>{form._id ? 'Edit fee notice' : 'New single fee notice'}</h3>
          <div className="form-grid">
            <div><label>Title</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <label>Semester</label>
              <select required disabled={!!form._id} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value, examination: '' })}>
                <option value="">Select...</option>
                {semesters.filter((s) => !['completed', 'archived'].includes(s.status) || s._id === form.semester).map((s) => <option key={s._id} value={s._id}>{s.department?.code} · {s.name} ({s.academicYear})</option>)}
              </select>
            </div>
            {role === 'hod' && !form._id && (
              <div>
                <label>Examination (optional)</label>
                <select value={form.examination} onChange={(e) => setForm({ ...form, examination: e.target.value })}>
                  <option value="">Not linked</option>
                  {exams.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label>Fee type</label>
              <select value={form.feeType} onChange={(e) => setForm({ ...form, feeType: e.target.value })}>
                <option value="examination">Examination fee</option>
                <option value="practical">Practical fee</option>
                <option value="promotion">Semester promotion fee</option>
                <option value="other">Other charge</option>
              </select>
            </div>
            <div><label>Normal fee amount</label><input type="number" min={0} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><label>Collection starts</label><input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label>Normal payment deadline</label><input type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            <div><label>Late fee amount</label><input type="number" min={0} value={form.lateFee} onChange={(e) => setForm({ ...form, lateFee: e.target.value })} /></div>
            <div><label>Late payment deadline</label><input type="date" value={form.lateDueDate} onChange={(e) => setForm({ ...form, lateDueDate: e.target.value })} /></div>
          </div>
          <label>Examination admission requirements</label>
          <textarea rows={2} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
          <label>Required documents (comma separated)</label>
          <input placeholder="transcript, photo" value={form.requiredDocuments} onChange={(e) => setForm({ ...form, requiredDocuments: e.target.value })} />
          <p className="muted small">A student who pays after the normal deadline but before the late deadline pays the amount plus the late fee. The server calculates this when they pay.</p>
          <div className="actions">
            <button className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-ghost mt" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {/* ---------- announcements ---------- */}
      {anns.length > 0 && <h3 className="mt">Fee announcements</h3>}
      {anns.map((a) => (
        <div className="card fee-announce" key={a.batch}>
          <div className="row-between">
            <div>
              <b className="fee-title">{a.title}</b>{' '}
              <Badge value={a.status} />
              <div className="muted small">{TYPE_TEXT[a.feeType] || a.feeType} · {a.lines.length} semester{a.lines.length === 1 ? '' : 's'} · created {fmtDate(a.createdAt)}</div>
            </div>
            <div className="actions">
              <button className="btn btn-small" onClick={() => setOpen({ ...open, [a.batch]: !(open[a.batch] ?? true) })}>{(open[a.batch] ?? true) ? 'Hide semesters' : 'Show semesters'}</button>
              {canEdit && ['draft', 'mixed'].includes(a.status) && <button className="btn btn-small btn-primary" onClick={() => batchAct(a, 'publish')}>Send now</button>}
              {canEdit && ['published', 'mixed'].includes(a.status) && <button className="btn btn-small btn-danger" onClick={() => batchAct(a, 'close')}>Close all</button>}
            </div>
          </div>
          {(open[a.batch] ?? true) && (
            <div className="table-wrap">
              <table className="fee-table">
                <thead>
                  <tr>
                    <th>Semester</th><th>{a.feeType === 'examination' ? 'Exam fee' : 'Fee'}</th>{anyPractical(a) && <th>Practical</th>}<th>Late fee</th>
                    <th>Starts</th><th>Deadline</th><th>Late until</th><th>Requirements</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {a.lines.map((l) => {
                    const n = l.main || l.practical;
                    return (
                      <tr key={l.semester._id}>
                        <td><b>{l.department?.code} · {l.semester.name}</b>{l.examination && <div className="muted small">Exam: {l.examination.name}</div>}</td>
                        <td>{l.main ? money(l.main.amount) : '—'}</td>
                        {anyPractical(a) && <td>{l.main?.practicalFee > 0 ? <>{money(l.main.practicalFee)} each<div className="muted small">up to {l.main.maxPracticals ?? 3}</div></> : l.practical ? money(l.practical.amount) : '—'}</td>}
                        <td>{(l.main?.lateFee || 0) > 0 ? `+${money(l.main.lateFee)}` : '—'}{(l.practical?.lateFee || 0) > 0 && <div className="muted small">practical +{money(l.practical.lateFee)}</div>}</td>
                        <td>{fmtDate(n.startDate)}</td>
                        <td>{fmtDate(n.dueDate)}</td>
                        <td>{fmtDate(n.lateDueDate)}</td>
                        <td className="small">{n.requirements || '—'}{n.requiredDocuments?.length > 0 && <div className="muted">Documents: {n.requiredDocuments.join(', ')}</div>}</td>
                        <td><Badge value={n.status} /></td>
                        <td className="actions">
                          {n.status !== 'draft' && l.main && <button className="btn btn-small" onClick={() => showPaid(l.main)}>Who paid{l.practical ? ' (exam)' : ''}</button>}
                          {n.status !== 'draft' && l.practical && <button className="btn btn-small" onClick={() => showPaid(l.practical)}>Who paid (practical)</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* ---------- all notices ---------- */}
      <h3 className="mt">All fee notices</h3>
      <div className="card filters">
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Fee</th><th>Department</th><th>Semester</th><th>Amount</th><th>Deadlines</th><th>Status</th>{canEdit && <th />}</tr></thead>
          <tbody>
            {notices.map((n) => (
              <tr key={n._id}>
                <td>{n.title}<div className="muted small">{n.feeType}{n.examination ? ` · ${n.examination.name}` : ''}</div></td>
                <td>{n.department?.code}</td>
                <td>{n.semester?.name}</td>
                <td>{money(n.amount)}{n.lateFee > 0 && <div className="muted small">late +{money(n.lateFee)}</div>}</td>
                <td className="small">{fmtDate(n.startDate)} → {fmtDate(n.dueDate)}{n.lateDueDate && <div>late until {fmtDate(n.lateDueDate)}</div>}</td>
                <td><Badge value={n.status} /></td>
                <td className="actions">
                  {n.status !== 'draft' && <button className="btn btn-small" onClick={() => showPaid(n)}>Who paid</button>}
                  {canEdit && n.status !== 'closed' && <button className="btn btn-small" onClick={() => edit(n)}>Edit</button>}
                  {canEdit && n.status === 'draft' && <button className="btn btn-small btn-primary" onClick={() => act(n, 'publish')}>Publish</button>}
                  {canEdit && n.status === 'published' && <button className="btn btn-small btn-danger" onClick={() => act(n, 'close')}>Close</button>}
                </td>
              </tr>
            ))}
            {!notices.length && <tr><td colSpan={7} className="muted">No fee notices.</td></tr>}
          </tbody>
        </table>
      </div>

      {paid && (
        <div className="card table-wrap">
          <div className="row-between">
            <h3>{paid.notice.title}: {paid.paidCount} paid, {paid.unpaidCount} not paid</h3>
            <button className="btn btn-ghost" onClick={() => setPaid(null)}>Close</button>
          </div>
          <table>
            <thead><tr><th>Roll</th><th>Student</th><th>Status</th><th>Amount</th><th>Receipt</th><th>Date</th></tr></thead>
            <tbody>
              {paid.rows.map((r) => (
                <tr key={r.student}>
                  <td>{r.rollNumber}</td><td>{r.name}</td>
                  <td><Badge value={r.paid ? 'paid' : 'pending'} text={r.paid ? 'paid' : 'not paid'} /></td>
                  <td>{r.amount != null ? money(r.amount) : '—'}</td><td>{r.receiptNumber || '—'}</td><td>{fmtDate(r.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
