import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios.js';
import Avatar from './Avatar.jsx';
import PhotoUpload from './PhotoUpload.jsx';
import { colorAt } from './palette.js';
import { useFlash, Alert, fmtDate } from './ui.jsx';

const ROLE = { university_head: 'University Head (Principal)', hod: 'Head of Department', finance_officer: 'Finance Officer', teacher: 'Teacher', student: 'Student' };
const LEVELS = [
  ['matric', 'Matric / SSC'], ['intermediate', 'Intermediate / HSSC'], ['bachelors', "Bachelor's"], ['masters', "Master's"],
  ['mphil', 'MPhil'], ['phd', 'PhD'], ['postdoc', 'Post-doctorate'], ['diploma', 'Diploma / certificate'], ['other', 'Other'],
];
const LEVEL_TEXT = Object.fromEntries(LEVELS);
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const blankEducation = () => ({ level: 'masters', degree: '', field: '', institution: '', year: '', grade: '' });
const blankExperience = () => ({ title: '', organization: '', fromYear: '', toYear: '', details: '' });

// A person's photo, education, degrees and experience. Anybody logged in may read the professional part (like a faculty page);
// the personal part (date of birth, address) is only shown to the person, the principal and the HOD of their department.
// canEdit comes from the server, so the buttons only appear for people the server will accept.
export default function ProfileDetails({ userId, onLoaded, onPhotoChanged, showHero = true }) {
  const [msg, ok, fail, clear] = useFlash();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null); // null = reading, object = editing
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/profile/${userId}`).then((r) => { setData(r.data.data); onLoaded?.(r.data.data); }).catch(fail);
  }, [userId, fail, onLoaded]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <><Alert msg={msg} /><p className="muted">Loading...</p></>;
  const { user, profile, canEdit, canChangePhoto } = data;
  const edu = profile.education || [];
  const exp = profile.experience || [];
  const personal = [
    ['Gender', profile.gender && profile.gender[0].toUpperCase() + profile.gender.slice(1)],
    ['Date of birth', profile.dateOfBirth && fmtDate(profile.dateOfBirth)],
    ['Joined', profile.joiningDate && fmtDate(profile.joiningDate)],
    ['City', profile.city],
    ['Address', profile.address],
  ].filter(([, v]) => v);

  const openEdit = () => {
    clear();
    setForm({
      designation: profile.designation || '', gender: profile.gender || '', dateOfBirth: day(profile.dateOfBirth), joiningDate: day(profile.joiningDate),
      city: profile.city || '', address: profile.address || '', experienceYears: profile.experienceYears ?? '', bio: profile.bio || '',
      education: edu.map((e) => ({ ...e, field: e.field || '', year: e.year ?? '', grade: e.grade || '' })),
      experience: exp.map((e) => ({ ...e, fromYear: e.fromYear ?? '', toYear: e.toYear ?? '', details: e.details || '' })),
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
      await api.put(`/profile/${userId}`, {
        designation: form.designation, gender: form.gender, dateOfBirth: form.dateOfBirth, joiningDate: form.joiningDate,
        city: form.city, address: form.address, experienceYears: num(form.experienceYears), bio: form.bio,
        education: form.education.filter((x) => x.degree.trim() && x.institution.trim()).map((x) => ({ ...x, year: num(x.year) })),
        experience: form.experience.filter((x) => x.title.trim() && x.organization.trim()).map((x) => ({ ...x, fromYear: num(x.fromYear), toYear: num(x.toYear) })),
      });
      ok('Profile saved');
      setForm(null);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const setRow = (key, i, patch) => setForm({ ...form, [key]: form[key].map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const dropRow = (key, i) => setForm({ ...form, [key]: form[key].filter((_, j) => j !== i) });

  return (
    <>
      <Alert msg={msg} />
      {showHero ? (
      <div className="pr-hero">
        {canChangePhoto ? (
          <PhotoUpload user={user} size={104} onMessage={(t, text) => (t === 'success' ? ok(text) : fail(text))} onChanged={(patch) => { setData({ ...data, user: { ...user, ...patch } }); onPhotoChanged?.(patch); }} />
        ) : (
          <Avatar user={user} size={104} />
        )}
        <div className="grow">
          <h2>{user.name}</h2>
          <div className="sub">{profile.designation || ROLE[user.role]}</div>
          <div className="pr-chips">
            <span className="pr-chip">{ROLE[user.role]}</span>
            {user.department?.name && <span className="pr-chip">{user.department.name}</span>}
            {user.allDepartments && <span className="pr-chip">Teaches in every department</span>}
            {user.qualification && <span className="pr-chip">🎓 {user.qualification}</span>}
            {profile.experienceYears != null && <span className="pr-chip">{profile.experienceYears} year{profile.experienceYears === 1 ? '' : 's'} experience</span>}
          </div>
        </div>
        {canEdit && !form && <button className="btn" onClick={openEdit}>Edit details</button>}
      </div>
      ) : (
        // Embedded in another page (for example a teacher's page that already has its own header): only the photo and the edit button.
        <div className="pr-card">
          <div className="row-between">
            {canChangePhoto ? (
              <PhotoUpload user={user} size={72} onMessage={(t, text) => (t === 'success' ? ok(text) : fail(text))} onChanged={(patch) => { setData({ ...data, user: { ...user, ...patch } }); onPhotoChanged?.(patch); }} />
            ) : (
              <Avatar user={user} size={72} />
            )}
            {canEdit && !form && <button className="btn" onClick={openEdit}>Edit education and details</button>}
          </div>
        </div>
      )}

      {form ? (
        <form className="pr-card" onSubmit={save}>
          <h3>Edit education and details</h3>
          <div className="form-grid">
            <div><label>Designation</label><input value={form.designation} maxLength={100} placeholder="e.g. Assistant Professor" onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
            <div><label>Total experience (years)</label><input type="number" min={0} max={60} value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} /></div>
            <div><label>Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Not said</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </div>
            <div><label>Date of birth</label><input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
            <div><label>Joining date</label><input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></div>
            <div><label>City</label><input value={form.city} maxLength={60} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          </div>
          <label>Address</label>
          <input value={form.address} maxLength={250} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <label>About (short introduction)</label>
          <textarea rows={3} maxLength={1500} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />

          <h4>Education and degrees</h4>
          {form.education.map((r, i) => (
            <div key={i} className="pr-edit-row">
              <div className="form-grid">
                <div><label>Level</label><select value={r.level} onChange={(e) => setRow('education', i, { level: e.target.value })}>{LEVELS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
                <div><label>Degree</label><input value={r.degree} maxLength={120} placeholder="e.g. MS Computer Science" onChange={(e) => setRow('education', i, { degree: e.target.value })} /></div>
                <div><label>Field / specialization</label><input value={r.field} maxLength={120} onChange={(e) => setRow('education', i, { field: e.target.value })} /></div>
                <div><label>University / institute</label><input value={r.institution} maxLength={150} onChange={(e) => setRow('education', i, { institution: e.target.value })} /></div>
                <div><label>Year</label><input type="number" min={1950} max={new Date().getFullYear() + 1} value={r.year} onChange={(e) => setRow('education', i, { year: e.target.value })} /></div>
                <div><label>Grade / CGPA</label><input value={r.grade} maxLength={40} onChange={(e) => setRow('education', i, { grade: e.target.value })} /></div>
              </div>
              <button type="button" className="btn btn-small btn-danger" onClick={() => dropRow('education', i)}>Remove this degree</button>
            </div>
          ))}
          <button type="button" className="btn btn-small" onClick={() => setForm({ ...form, education: [...form.education, blankEducation()] })}>+ Add a degree</button>

          <h4>Work experience</h4>
          {form.experience.map((r, i) => (
            <div key={i} className="pr-edit-row">
              <div className="form-grid">
                <div><label>Position</label><input value={r.title} maxLength={120} placeholder="e.g. Lecturer" onChange={(e) => setRow('experience', i, { title: e.target.value })} /></div>
                <div><label>Organization</label><input value={r.organization} maxLength={150} onChange={(e) => setRow('experience', i, { organization: e.target.value })} /></div>
                <div><label>From (year)</label><input type="number" min={1950} max={new Date().getFullYear() + 1} value={r.fromYear} onChange={(e) => setRow('experience', i, { fromYear: e.target.value })} /></div>
                <div><label>To (year, empty = until now)</label><input type="number" min={1950} max={new Date().getFullYear() + 1} value={r.toYear} onChange={(e) => setRow('experience', i, { toYear: e.target.value })} /></div>
              </div>
              <label>Details (optional)</label>
              <input value={r.details} maxLength={500} onChange={(e) => setRow('experience', i, { details: e.target.value })} />
              <button type="button" className="btn btn-small btn-danger mt" onClick={() => dropRow('experience', i)}>Remove this job</button>
            </div>
          ))}
          <button type="button" className="btn btn-small" onClick={() => setForm({ ...form, experience: [...form.experience, blankExperience()] })}>+ Add a job</button>

          <div className="actions">
            <button className="btn btn-primary mt" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn btn-ghost mt" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="pr-cols">
          <div>
            <div className="pr-card">
              <h3>🎓 Education and degrees</h3>
              {edu.length ? (
                <ul className="pr-timeline">
                  {edu.map((e, i) => (
                    <li key={i} style={colorAt(i)}>
                      <b><span className="pr-level">{LEVEL_TEXT[e.level] || e.level}</span>{e.degree}</b>
                      <span className="where">{[e.field, e.institution, e.year, e.grade].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">{user.qualification ? `Qualification: ${user.qualification}` : 'No education has been added yet.'}{canEdit && ' Use "Edit details" to add degrees.'}</p>}
            </div>

            {exp.length > 0 && (
              <div className="pr-card">
                <h3>💼 Work experience</h3>
                <ul className="pr-timeline">
                  {exp.map((e, i) => (
                    <li key={i} style={colorAt(i + 3)}>
                      <b>{e.title}</b>
                      <span className="where">{e.organization}{e.fromYear ? ` · ${e.fromYear} to ${e.toYear || 'now'}` : ''}</span>
                      {e.details && <div className="small">{e.details}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile.bio && <div className="pr-card"><h3>About</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{profile.bio}</p></div>}
          </div>

          <div>
            <div className="pr-card">
              <h3>Contact and details</h3>
              <dl className="pr-facts">
                {user.email && <><dt>Email</dt><dd>{user.email}</dd></>}
                {user.phone && <><dt>Phone</dt><dd>{user.phone}</dd></>}
                {personal.map(([k, v]) => <><dt key={`k${k}`}>{k}</dt><dd key={`v${k}`}>{v}</dd></>)}
                {(user.subjects || []).length > 0 && <><dt>Teaches</dt><dd>{user.subjects.join(', ')}</dd></>}
                {(user.extraDepartments || []).length > 0 && <><dt>Also in</dt><dd>{user.extraDepartments.map((d) => d.code).join(', ')}</dd></>}
              </dl>
              {!user.email && !user.phone && !personal.length && <p className="muted" style={{ margin: 0 }}>No contact details to show.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
