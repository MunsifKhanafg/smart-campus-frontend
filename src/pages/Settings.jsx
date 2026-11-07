import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import api, { errorMessage, assetUrl } from '../api/axios.js';
import { setBranding, fetchPublicSettings } from '../store/settingsSlice.js';
import MeritControl from '../components/MeritControl.jsx';

export default function Settings() {
  const dispatch = useDispatch();
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [docsText, setDocsText] = useState(''); // required documents, one per line
  const [meritKey, setMeritKey] = useState(0); // bumped after a save so the merit list panel reloads

  useEffect(() => {
    api.get('/settings').then((r) => { setS(r.data.data); setDocsText((r.data.data.admissionPortal?.requiredDocuments || []).join('\n')); }).catch((e) => setMsg({ type: 'error', text: errorMessage(e) }));
  }, []);

  if (!s) return <p>{msg.text || 'Loading...'}</p>;

  const set = (k, v) => setS({ ...s, [k]: v });
  const setNested = (group, k, v) => setS({ ...s, [group]: { ...s[group], [k]: v } });
  const setGrade = (i, k, v) => {
    const rules = s.gradingRules.map((r, idx) => (idx === i ? { ...r, [k]: v } : r));
    setS({ ...s, gradingRules: rules });
  };
  const addGrade = () => setS({ ...s, gradingRules: [...s.gradingRules, { grade: '', minPercentage: 0, gpaPoints: 0 }] });
  const removeGrade = (i) => setS({ ...s, gradingRules: s.gradingRules.filter((_, idx) => idx !== i) });

  const ar = s.admissionRules || {};
  const ap = s.admissionPortal || {};
  const bk = s.bankAccount || {};
  const setInterview = (k, v) => setNested('admissionPortal', 'interview', { ...(ap.interview || {}), [k]: v });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ type: '', text: '' });
    try {
      const body = {
        universityName: s.universityName,
        campusName: s.campusName,
        address: s.address,
        contactNumber: s.contactNumber,
        email: s.email,
        website: s.website,
        officeHours: s.officeHours,
        currentAcademicYear: s.currentAcademicYear,
        passingPercentage: Number(s.passingPercentage),
        gradingRules: s.gradingRules.map((r) => ({
          grade: r.grade,
          minPercentage: Number(r.minPercentage),
          gpaPoints: Number(r.gpaPoints),
        })),
        feePolicy: { lateFeeEnabled: s.feePolicy.lateFeeEnabled, currency: s.feePolicy.currency },
        admissionRules: {
          minAttendancePercentage: Number(ar.minAttendancePercentage),
          requireFeePayment: !!ar.requireFeePayment,
          requireDocuments: !!ar.requireDocuments,
          minAssignmentCompletionPercentage: Number(ar.minAssignmentCompletionPercentage || 0),
          requirePreviousSemesterPass: !!ar.requirePreviousSemesterPass,
        },
        attendanceRules: { allowApprovedLeaveAsPresent: s.attendanceRules.allowApprovedLeaveAsPresent },
        bankAccount: {
          bankName: bk.bankName || '', accountTitle: bk.accountTitle || '', accountNumber: bk.accountNumber || '',
          iban: bk.iban || '', branch: bk.branch || '', instructions: bk.instructions || '',
        },
        admissionPortal: {
          open: !!ap.open,
          intakeName: ap.intakeName || '',
          startDate: ap.startDate ? String(ap.startDate).slice(0, 10) : null,
          deadline: ap.deadline ? String(ap.deadline).slice(0, 10) : null,
          instructions: ap.instructions || '',
          externalUrl: ap.externalUrl || '',
          requiredDocuments: docsText.split('\n').map((x) => x.trim()).filter(Boolean),
          meritListDate: ap.meritListDate ? String(ap.meritListDate).slice(0, 10) : null,
          meritSeats: Number(ap.meritSeats || 0),
          meritAutoPublish: ap.meritAutoPublish !== false,
          interview: {
            date: ap.interview?.date ? String(ap.interview.date).slice(0, 10) : null,
            time: ap.interview?.time || '',
            venue: ap.interview?.venue || '',
            instructions: ap.interview?.instructions || '',
          },
        },
      };
      const { data } = await api.put('/settings', body);
      const { admissionPortal: _portal, ...branding } = data.data; // the public portal state comes from the public settings
      dispatch(setBranding(branding)); // header, login page etc. update immediately
      dispatch(fetchPublicSettings()); // Home and Login: admission button, dates, open/closed
      setMsg({ type: 'success', text: 'Settings saved' });
      setMeritKey((k) => k + 1);
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const { data } = await api.post('/settings/logo', fd);
      set('logoUrl', data.data.logoUrl);
      dispatch(setBranding({ logoUrl: data.data.logoUrl }));
      setMsg({ type: 'success', text: 'Logo updated' });
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    }
  };

  return (
    <form onSubmit={save}>
      <h1>University Settings</h1>
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <h3>Branding</h3>
        <div className="logo-row">
          {s.logoUrl ? <img className="logo-preview" src={assetUrl(s.logoUrl)} alt="logo" /> : <div className="logo-preview empty">No logo</div>}
          <div>
            <label>Upload logo (PNG/JPG/WebP, max 2 MB)</label>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} />
          </div>
        </div>
        <div className="form-grid">
          <div><label>University name</label><input value={s.universityName} onChange={(e) => set('universityName', e.target.value)} required /></div>
          <div><label>Campus name</label><input value={s.campusName} onChange={(e) => set('campusName', e.target.value)} required /></div>
          <div><label>Address</label><input value={s.address} onChange={(e) => set('address', e.target.value)} /></div>
          <div><label>Contact number</label><input value={s.contactNumber} onChange={(e) => set('contactNumber', e.target.value)} /></div>
          <div><label>Email</label><input type="email" value={s.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div><label>Website</label><input value={s.website} onChange={(e) => set('website', e.target.value)} /></div>
          <div><label>Office hours</label><input value={s.officeHours} onChange={(e) => set('officeHours', e.target.value)} /></div>
          <div><label>Academic year (e.g. 2025-2026)</label><input value={s.currentAcademicYear} onChange={(e) => set('currentAcademicYear', e.target.value)} /></div>
        </div>
      </div>

      <div className="card">
        <h3>Grading rules</h3>
        <div className="form-grid">
          <div><label>Passing percentage</label><input type="number" min="0" max="100" value={s.passingPercentage} onChange={(e) => set('passingPercentage', e.target.value)} /></div>
        </div>
        <table>
          <thead><tr><th>Grade</th><th>Min %</th><th>GPA points</th><th /></tr></thead>
          <tbody>
            {s.gradingRules.map((r, i) => (
              <tr key={i}>
                <td><input required value={r.grade} onChange={(e) => setGrade(i, 'grade', e.target.value)} /></td>
                <td><input type="number" min="0" max="100" value={r.minPercentage} onChange={(e) => setGrade(i, 'minPercentage', e.target.value)} /></td>
                <td><input type="number" min="0" max="4" step="0.1" value={r.gpaPoints} onChange={(e) => setGrade(i, 'gpaPoints', e.target.value)} /></td>
                <td>{s.gradingRules.length > 2 && <button type="button" className="btn btn-small btn-danger" onClick={() => removeGrade(i)}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn btn-small" onClick={addGrade}>+ Add grade</button>
        <p className="muted small">One grade must start at 0%. Rules apply to results published after you save.</p>
      </div>

      <div className="card">
        <h3>Fee, admission and attendance policy</h3>
        <div className="form-grid">
          <div><label>Currency (3 letters)</label><input maxLength={3} value={s.feePolicy.currency} onChange={(e) => setNested('feePolicy', 'currency', e.target.value.toUpperCase())} /></div>
          <div><label>Minimum attendance % for exam admission</label><input type="number" min="0" max="100" value={ar.minAttendancePercentage} onChange={(e) => setNested('admissionRules', 'minAttendancePercentage', e.target.value)} /></div>
          <div><label>Minimum assignments submitted % (0 = off)</label><input type="number" min="0" max="100" value={ar.minAssignmentCompletionPercentage ?? 0} onChange={(e) => setNested('admissionRules', 'minAssignmentCompletionPercentage', e.target.value)} /></div>
        </div>
        <label className="check"><input type="checkbox" checked={!!s.feePolicy.lateFeeEnabled} onChange={(e) => setNested('feePolicy', 'lateFeeEnabled', e.target.checked)} /> Allow late fees</label>
        <label className="check"><input type="checkbox" checked={!!ar.requireFeePayment} onChange={(e) => setNested('admissionRules', 'requireFeePayment', e.target.checked)} /> Require fee payment for exam admission</label>
        <label className="check"><input type="checkbox" checked={!!ar.requireDocuments} onChange={(e) => setNested('admissionRules', 'requireDocuments', e.target.checked)} /> Require approved documents for exam admission</label>
        <label className="check"><input type="checkbox" checked={!!ar.requirePreviousSemesterPass} onChange={(e) => setNested('admissionRules', 'requirePreviousSemesterPass', e.target.checked)} /> Require a pass in the previous semester</label>
        <label className="check"><input type="checkbox" checked={!!s.attendanceRules.allowApprovedLeaveAsPresent} onChange={(e) => setNested('attendanceRules', 'allowApprovedLeaveAsPresent', e.target.checked)} /> Count approved leave as present</label>
      </div>

      <div className="card">
        <h3>Bank account for fee transfers</h3>
        <p className="muted small">Students who pay by bank transfer see these details on their Fees page. The finance office checks each transfer and presses Received.</p>
        <div className="form-grid">
          <div><label>Bank name</label><input maxLength={80} value={bk.bankName || ''} onChange={(e) => setNested('bankAccount', 'bankName', e.target.value)} /></div>
          <div><label>Account title</label><input maxLength={120} value={bk.accountTitle || ''} onChange={(e) => setNested('bankAccount', 'accountTitle', e.target.value)} /></div>
          <div><label>Account number</label><input maxLength={40} value={bk.accountNumber || ''} onChange={(e) => setNested('bankAccount', 'accountNumber', e.target.value)} /></div>
          <div><label>IBAN</label><input maxLength={40} value={bk.iban || ''} onChange={(e) => setNested('bankAccount', 'iban', e.target.value)} /></div>
          <div><label>Branch</label><input maxLength={120} value={bk.branch || ''} onChange={(e) => setNested('bankAccount', 'branch', e.target.value)} /></div>
        </div>
        <label>Instructions for students (optional)</label>
        <textarea rows={2} maxLength={600} value={bk.instructions || ''} onChange={(e) => setNested('bankAccount', 'instructions', e.target.value)} placeholder="e.g. Write your roll number in the transfer remarks" />
      </div>

      <div className="card">
        <h3>New student admissions (public Apply page)</h3>
        <p className="muted small">
          New students apply on the public Apply page without a login. Applications are accepted only while the switch is on
          AND today is between the opening and closing dates. The closing day itself still counts.
        </p>
        <label className="check"><input type="checkbox" checked={!!ap.open} onChange={(e) => setNested('admissionPortal', 'open', e.target.checked)} /> Admissions are open</label>
        <div className="form-grid">
          <div><label>Intake name (e.g. Fall 2026)</label><input maxLength={60} value={ap.intakeName || ''} onChange={(e) => setNested('admissionPortal', 'intakeName', e.target.value)} /></div>
          <div><label>Opening date</label><input type="date" value={ap.startDate ? String(ap.startDate).slice(0, 10) : ''} onChange={(e) => setNested('admissionPortal', 'startDate', e.target.value || null)} /></div>
          <div><label>Closing date (last day to apply)</label><input type="date" value={ap.deadline ? String(ap.deadline).slice(0, 10) : ''} onChange={(e) => setNested('admissionPortal', 'deadline', e.target.value || null)} /></div>
          <div><label>External admission website (optional)</label><input type="url" placeholder="https://admissions.example.edu" value={ap.externalUrl || ''} onChange={(e) => setNested('admissionPortal', 'externalUrl', e.target.value)} /></div>
        </div>
        <label>Instructions shown to applicants</label>
        <textarea rows={3} maxLength={2000} value={ap.instructions || ''} onChange={(e) => setNested('admissionPortal', 'instructions', e.target.value)} />
        <label>Required documents (one per line; leave empty to use the default list)</label>
        <textarea rows={4} value={docsText} onChange={(e) => setDocsText(e.target.value)} placeholder={'CNIC or B-Form\nMatric certificate\nIntermediate certificate\nPassport-size photo'} />
        <h4 className="mt">Merit list and interviews</h4>
        <p className="muted small">
          The merit list is never shown while applications are open. After the closing date, on the merit list date, the system ranks the applicants
          of every department, calls the top ones for an interview and gives them the message below on their tracking page (and by e-mail when the server has e-mail set up).
        </p>
        <div className="form-grid">
          <div><label>Merit list date (after the closing date)</label><input type="date" value={ap.meritListDate ? String(ap.meritListDate).slice(0, 10) : ''} onChange={(e) => setNested('admissionPortal', 'meritListDate', e.target.value || null)} /></div>
          <div><label>Applicants called for interview in each department</label><input type="number" min="0" max="5000" value={ap.meritSeats ?? 0} onChange={(e) => setNested('admissionPortal', 'meritSeats', e.target.value)} /></div>
          <div><label>Interview date</label><input type="date" value={ap.interview?.date ? String(ap.interview.date).slice(0, 10) : ''} onChange={(e) => setInterview('date', e.target.value || null)} /></div>
          <div><label>Interview time</label><input maxLength={40} placeholder="10:00 AM" value={ap.interview?.time || ''} onChange={(e) => setInterview('time', e.target.value)} /></div>
          <div><label>Interview venue</label><input maxLength={200} placeholder="Main Block, Room 12" value={ap.interview?.venue || ''} onChange={(e) => setInterview('venue', e.target.value)} /></div>
        </div>
        <label>What called applicants should bring or know (optional)</label>
        <textarea rows={2} maxLength={1000} value={ap.interview?.instructions || ''} onChange={(e) => setInterview('instructions', e.target.value)} />
        <label className="check"><input type="checkbox" checked={ap.meritAutoPublish !== false} onChange={(e) => setNested('admissionPortal', 'meritAutoPublish', e.target.checked)} /> Publish the merit list automatically on the merit list date</label>
        <p className="muted small">Save the settings first. The panel below always shows what is saved.</p>
        <MeritControl refreshKey={meritKey} />
        <p className="muted small">
          If you enter an external website, applicants are sent there and the built-in form is not used.{' '}
          <a href="/apply" target="_blank" rel="noreferrer">Preview the Apply page</a> · <a href="/merit-list" target="_blank" rel="noreferrer">Preview the merit list</a>
        </p>
      </div>

      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save settings'}</button>
    </form>
  );
}
