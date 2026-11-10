import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';
import AdmissionShell from '../components/AdmissionShell.jsx';
import { fmtDate } from '../components/ui.jsx';

const MAX_MB = 5;
const EMPTY = {
  name: '', fatherName: '', gender: 'male', dateOfBirth: '', nationalId: '', email: '', phone: '', address: '', city: '',
  department: '', program: '', secondDepartment: '',
  matricMarks: '', matricTotal: '1100', interMarks: '', interTotal: '1100', testMarks: '', testTotal: '',
};
const pct = (m, t) => (Number(t) > 0 && m !== '' ? Math.min(100, (Number(m) / Number(t)) * 100) : null);

// Public admission form. Needs no login. The server decides whether admissions are open and calculates the merit score itself.
export default function Apply() {
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState({}); // required document name -> File
  const [extra, setExtra] = useState([]); // other documents
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.get('/public/admissions/portal').then((r) => setInfo(r.data.data)).catch((e) => setLoadError(errorMessage(e)));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const portal = info?.portal;
  const dept = info?.departments.find((d) => d._id === form.department);

  // Live preview only. The server calculates the official score.
  const preview = useMemo(() => {
    const m = pct(form.matricMarks, form.matricTotal);
    const i = pct(form.interMarks, form.interTotal);
    if (m === null || i === null) return null;
    const t = pct(form.testMarks, form.testTotal);
    return { m, i, t, score: t === null ? m * 0.3 + i * 0.7 : m * 0.2 + i * 0.5 + t * 0.3 };
  }, [form]);

  const pick = (label, file) => {
    if (file && file.size > MAX_MB * 1024 * 1024) { setError(`"${file.name}" is larger than ${MAX_MB} MB`); return; }
    setError('');
    setFiles((f) => ({ ...f, [label]: file || undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const missing = portal.requiredDocuments.filter((d) => !files[d]);
    if (missing.length) return setError(`Please upload: ${missing.join(', ')}`);
    if (!agree) return setError('Please confirm that the information is correct');

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v); });
    fd.append('declaration', 'true');
    portal.requiredDocuments.forEach((label) => { fd.append('files', files[label]); fd.append('labels', label); });
    extra.forEach((f) => { fd.append('files', f); fd.append('labels', 'Other document'); });

    setBusy(true);
    try {
      const { data } = await api.post('/public/admissions/apply', fd);
      setDone(data.data);
    } catch (err) { setError(errorMessage(err)); } finally {
      setBusy(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loadError) return <AdmissionShell title="Apply for admission"><div className="adm-alert error">{loadError}</div></AdmissionShell>;
  if (!info) return <AdmissionShell title="Apply for admission"><p className="muted">Loading…</p></AdmissionShell>;

  if (portal.externalUrl) {
    return (
      <AdmissionShell title="Apply for admission" subtitle={portal.intakeName}>
        <div className="adm-card">
          <p>Applications are received on the university's admission website.</p>
          <div className="adm-actions"><a className="adm-btn" href={portal.externalUrl} target="_blank" rel="noreferrer">Go to the admission website</a></div>
        </div>
      </AdmissionShell>
    );
  }

  if (done) {
    return (
      <AdmissionShell title="Application received">
        <div className="adm-card">
          <div className="adm-alert ok">Thank you. Your application has been submitted.</div>
          <p>Your application number is:</p>
          <div className="adm-number">{done.applicationNumber}</div>
          <p>
            <b>Keep this number.</b> You need it, together with the email address you used on the form ({form.email}), to check the status of your application.
          </p>
          <div className="adm-actions">
            <Link className="adm-btn" to="/track-application">Track my application</Link>
            <button type="button" className="adm-btn ghost" onClick={() => navigator.clipboard?.writeText(done.applicationNumber)}>Copy number</button>
            <button type="button" className="adm-btn ghost" onClick={() => window.print()}>Print</button>
          </div>
        </div>
      </AdmissionShell>
    );
  }

  if (!portal.open) {
    return (
      <AdmissionShell title="Apply for admission" subtitle={portal.intakeName}>
        <div className="adm-card">
          <div className={`adm-alert ${portal.status === 'upcoming' ? 'warn' : 'error'}`}>{portal.closedReason || 'Admissions are not open at the moment.'}</div>
          <p className="muted">
            Opening date: <b>{portal.startDate ? fmtDate(portal.startDate) : 'not announced'}</b> · Last day to apply: <b>{portal.deadline ? fmtDate(portal.deadline) : 'not announced'}</b>
          </p>
          {portal.instructions && <p style={{ whiteSpace: 'pre-wrap' }}>{portal.instructions}</p>}
          <div className="adm-actions">
            <Link className="adm-btn ghost" to="/track-application">Track an existing application</Link>
            {portal.meritListPublished && <Link className="adm-btn ghost" to="/merit-list">Merit list</Link>}
          </div>
        </div>
      </AdmissionShell>
    );
  }

  return (
    <AdmissionShell title="Apply for admission" subtitle={`${portal.intakeName ? `${portal.intakeName} · ` : ''}Applications close on ${portal.deadline ? fmtDate(portal.deadline) : 'a date to be announced'}`}>
      {portal.instructions && <div className="adm-alert info" style={{ whiteSpace: 'pre-wrap' }}>{portal.instructions}</div>}
      {error && <div className="adm-alert error">{error}</div>}

      <form onSubmit={submit}>
        <div className="adm-card">
          <h3>1. What do you want to study?</h3>
          <div className="adm-grid">
            <div>
              <label>Department (first choice)</label>
              <select required value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value, program: '' }))}>
                <option value="">Select a department</option>
                {info.departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            {dept?.programs.length > 0 && (
              <div>
                <label>BS programme</label>
                <select required value={form.program} onChange={(e) => set('program', e.target.value)}>
                  <option value="">Select a programme</option>
                  {dept.programs.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}
            <div>
              <label>Second choice (optional)</label>
              <select value={form.secondDepartment} onChange={(e) => set('secondDepartment', e.target.value)}>
                <option value="">None</option>
                {info.departments.filter((d) => d._id !== form.department).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="adm-card">
          <h3>2. About you</h3>
          <div className="adm-grid">
            <div><label>Full name</label><input required minLength={2} maxLength={100} value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div><label>Father's name</label><input required minLength={2} maxLength={100} value={form.fatherName} onChange={(e) => set('fatherName', e.target.value)} /></div>
            <div>
              <label>Gender</label>
              <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </div>
            <div><label>Date of birth</label><input type="date" required max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} /></div>
            <div><label>CNIC / B-Form number</label><input required placeholder="12345-1234567-1" value={form.nationalId} onChange={(e) => set('nationalId', e.target.value)} /></div>
            <div><label>Mobile number</label><input required placeholder="03xx-xxxxxxx" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            <div><label>Email (used to track your application)</label><input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
            <div><label>City</label><input maxLength={80} value={form.city} onChange={(e) => set('city', e.target.value)} /></div>
            <div className="full"><label>Home address</label><input required minLength={5} maxLength={300} value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
          </div>
        </div>

        <div className="adm-card">
          <h3>3. Academic record</h3>
          <div className="adm-grid">
            <div><label>Matric marks obtained</label><input type="number" min={0} required value={form.matricMarks} onChange={(e) => set('matricMarks', e.target.value)} /></div>
            <div><label>Matric total marks</label><input type="number" min={1} required value={form.matricTotal} onChange={(e) => set('matricTotal', e.target.value)} /></div>
            <div><label>Intermediate marks obtained</label><input type="number" min={0} required value={form.interMarks} onChange={(e) => set('interMarks', e.target.value)} /></div>
            <div><label>Intermediate total marks</label><input type="number" min={1} required value={form.interTotal} onChange={(e) => set('interTotal', e.target.value)} /></div>
            <div><label>Entry test marks (if you took one)</label><input type="number" min={0} value={form.testMarks} onChange={(e) => set('testMarks', e.target.value)} /></div>
            <div><label>Entry test total marks</label><input type="number" min={1} value={form.testTotal} onChange={(e) => set('testTotal', e.target.value)} /></div>
          </div>
          {preview && (
            <p className="small muted">
              Matric {preview.m.toFixed(1)}% · Intermediate {preview.i.toFixed(1)}%{preview.t !== null ? ` · Test ${preview.t.toFixed(1)}%` : ''} →
              estimated merit <span className="adm-pct">{preview.score.toFixed(2)}</span> (the university calculates the official score).
            </p>
          )}
        </div>

        <div className="adm-card">
          <h3>4. Documents (PDF, JPG, PNG or WEBP, max {MAX_MB} MB each)</h3>
          <div className="adm-grid">
            {portal.requiredDocuments.map((label) => (
              <div key={label}>
                <label>{label}</label>
                <input type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => pick(label, e.target.files[0])} />
              </div>
            ))}
            <div className="full">
              <label>Other documents (optional, up to 4)</label>
              <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setExtra([...e.target.files].filter((f) => f.size <= MAX_MB * 1024 * 1024).slice(0, 4))} />
            </div>
          </div>
        </div>

        <div className="adm-card">
          <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I confirm that the information and documents are correct. I understand that wrong information can cancel my application.</label>
          <div className="adm-actions"><button className="adm-btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button></div>
        </div>
      </form>
    </AdmissionShell>
  );
}
