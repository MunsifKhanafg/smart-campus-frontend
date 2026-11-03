import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import api, { errorMessage, assetUrl } from '../api/axios.js';
import { setBranding } from '../store/settingsSlice.js';

export default function Settings() {
  const dispatch = useDispatch();
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/settings').then((r) => setS(r.data.data)).catch((e) => setMsg({ type: 'error', text: errorMessage(e) }));
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
      };
      const { data } = await api.put('/settings', body);
      dispatch(setBranding(data.data)); // header, login page etc. update immediately
      setMsg({ type: 'success', text: 'Settings saved' });
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

      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save settings'}</button>
    </form>
  );
}
