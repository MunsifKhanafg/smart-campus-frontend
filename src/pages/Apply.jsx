import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';
import AdmissionShell from '../components/AdmissionShell.jsx';
import { fmtDate } from '../components/ui.jsx';

const MAX_MB = 5;
const EMPTY = {
  department: '', program: '', fullName: '', fatherName: '', gender: '', dateOfBirth: '', cnic: '', email: '', phone: '', address: '', city: '',
  lastQualification: 'intermediate', institution: '', board: '', passingYear: String(new Date().getFullYear()), obtainedMarks: '', totalMarks: '',
  statement: '', agree: false,
};

// Public page: a new student applies without a login. The server checks the dates, the department, the documents and
// calculates the percentage itself, so nothing shown here is trusted.
export default function Apply() {
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState({}); // required document label -> File
  const [extra, setExtra] = useState([]); // other documents
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.get('/public/admissions/portal').then((r) => setInfo(r.data.data)).catch((e) => setLoadError(errorMessage(e)));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const portal = info?.portal;
  const dept = info?.departments.find((d) => d._id === form.department);
  const pct = Number(form.totalMarks) > 0 && form.obtainedMarks !== '' ? ((Number(form.obtainedMarks) / Number(form.totalMarks)) * 100).toFixed(2) : null;

  const pick = (label, file) => {
    if (file && file.size > MAX_MB * 1024 * 1024) { setError(`"${file.name}" is larger than ${MAX_MB} MB`); return; }
    setError('');
    setFiles((f) => ({ ...f, [label]: file || undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'agree') { if (v) fd.append('agree', 'true'); } else if (v !== '') fd.append(k, v);
    });
    portal.requiredDocuments.forEach((label) => {
      if (files[label]) { fd.append('files', files[label]); fd.append('labels', label); }
    });
    extra.forEach((f) => { fd.append('files', f); fd.append('labels', 'Other document'); });
    setBusy(true);
    try {
      const { data } = await api.post('/public/admissions/apply', fd);
      setDone(data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loadError) return <AdmissionShell title="Apply for admission"><div className="adm-alert error">{loadError}</div></AdmissionShell>;
  if (!info) return <AdmissionShell title="Apply for admission"><p className="muted">Loading…</p></AdmissionShell>;

  // The University Head can send applicants to another website instead.
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
      <AdmissionShell title="Application received" subtitle={`${done.department}${done.programName ? ` · ${done.programName}` : ''}`}>
        <div className="adm-card">
          <div className="adm-alert ok">Thank you. Your application has been submitted.</div>
          <p>Your application number is:</p>
          <div className="adm-number">{done.applicationNumber}</div>
          <p>
            <b>Keep this number.</b> You need it, together with the email address you used on the form, to check the status of your application.
            The university may ask for more information, so check the status from time to time.
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
          <div className={`adm-alert ${portal.status === 'upcoming' ? 'warn' : 'error'}`}>{portal.closedReason}</div>
          <p className="muted">
            Opening date: <b>{portal.startDate ? fmtDate(portal.startDate) : 'not announced'}</b> · Last day to apply: <b>{portal.deadline ? fmtDate(portal.deadline) : 'not announced'}</b>
          </p>
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
              <label>Department</label>
              <select required value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value, program: '' }))}>
                <option value="">Select a department</option>
                {info.departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            {dept?.programs.length > 0 && (
              <div>
                <label>Programme</label>
                <select required value={form.program} onChange={(e) => set('program', e.target.value)}>
                  <option value="">Select a programme</option>
                  {dept.programs.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="adm-card">
          <h3>2. About you</h3>
          <div className="adm-grid">
            <div><label>Full name</label><input required maxLength={100} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} /></div>
            <div><label>Father's name</label><input required maxLength={100} value={form.fatherName} onChange={(e) => set('fatherName', e.target.value)} /></div>
            <div>
              <label>Gender</label>
              <select required value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </div>
            <div><label>Date of birth</label><input type="date" required max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} /></div>
            <div><label>CNIC / B-Form (13 digits, optional)</label><input placeholder="12345-1234567-1" value={form.cnic} onChange={(e) => set('cnic', e.target.value)} /></div>
            <div><label>Email (used to track your application)</label><input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
            <div><label>Mobile number</label><input required placeholder="03xx-xxxxxxx" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            <div><label>City</label><input required maxLength={60} value={form.city} onChange={(e) => set('city', e.target.value)} /></div>
            <div className="full"><label>Home address</label><input required maxLength={250} value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
          </div>
        </div>

        <div className="adm-card">
          <h3>3. Your last qualification</h3>
          <div className="adm-grid">
            <div>
              <label>Qualification</label>
              <select value={form.lastQualification} onChange={(e) => set('lastQualification', e.target.value)}>
                <option value="matric">Matric</option><option value="intermediate">Intermediate (FSc / FA / ICS)</option><option value="a_level">A-Level</option><option value="other">Other</option>
              </select>
            </div>
            <div><label>School / college</label><input required maxLength={150} value={form.institution} onChange={(e) => set('institution', e.target.value)} /></div>
            <div><label>Board (optional)</label><input maxLength={100} value={form.board} onChange={(e) => set('board', e.target.value)} /></div>
            <div><label>Passing year</label><input type="number" required min="1990" max={new Date().getFullYear()} value={form.passingYear} onChange={(e) => set('passingYear', e.target.value)} /></div>
            <div><label>Marks obtained</label><input type="number" required min="0" step="any" value={form.obtainedMarks} onChange={(e) => set('obtainedMarks', e.target.value)} /></div>
            <div><label>Total marks</label><input type="number" required min="1" step="any" value={form.totalMarks} onChange={(e) => set('totalMarks', e.target.value)} /></div>
          </div>
          {pct && <p className="small muted">Your percentage: <span className="adm-pct">{pct}%</span>. The university recalculates it from your marks. It decides your place on the merit list.</p>}
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
              <label>Other documents (optional)</label>
              <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setExtra([...e.target.files].filter((f) => f.size <= MAX_MB * 1024 * 1024).slice(0, 4))} />
            </div>
          </div>
        </div>

        <div className="adm-card">
          <h3>5. Anything else? (optional)</h3>
          <textarea rows={3} maxLength={1500} placeholder="A short note for the admission committee" value={form.statement} onChange={(e) => set('statement', e.target.value)} />
          <label className="check" style={{ marginTop: '.8rem' }}>
            <input type="checkbox" required checked={form.agree} onChange={(e) => set('agree', e.target.checked)} />
            I confirm that the information and documents are correct. I understand that wrong information can cancel my application.
          </label>
          <div className="adm-actions"><button className="adm-btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button></div>
        </div>
      </form>
    </AdmissionShell>
  );
}
