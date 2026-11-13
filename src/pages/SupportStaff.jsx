import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import api, { errorMessage } from '../api/axios.js';
import Avatar, { forgetPhoto } from '../components/Avatar.jsx';
import { shrink } from '../components/PhotoUpload.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { useFlash, Alert, Badge, Tabs, toInputDate, label } from '../components/ui.jsx';

// Class IV (support) staff: peons, cleaners, guards, gardeners, drivers ...
// Each person works in a DEPARTMENT or in an OFFICE (main college, principal's office, controller office, finance office ...).
//   Staff tab    the list, add / edit / photo / delete
//   Duties tab   daily responsibilities: assign a duty (one day or a range of days) and track it (assigned, in progress, done, not done)
// University Head: every department and office. HOD: only their own department (the server enforces this too).

const PHOTO_BASE = '/support-staff/photo';
const OFFICES = ['Main College', "Principal's Office", 'Controller Office', 'Finance Office', 'Admission Office', 'Library', 'Examination Section', 'Hostel / Mess'];
const OTHER = '__other__';
const DESIGNATIONS = ['Naib Qasid', 'Peon', 'Sweeper / Cleaner', 'Chowkidar (Guard)', 'Mali (Gardener)', 'Driver', 'Lab Attendant', 'Electrician', 'Plumber', 'Mess / Cook', 'Other'];
const DUTY_IDEAS = ['Clean classrooms', 'Clean offices', 'Clean labs', 'Guard the main gate', 'Carry files / post', 'Water the garden', 'Open and close the office', 'Arrange chairs for an event'];
const SHIFTS = [['morning', 'Morning'], ['evening', 'Evening'], ['full_day', 'Full day']];
const STATUSES = [['active', 'Active'], ['on_leave', 'On leave'], ['inactive', 'Inactive']];
const todayKey = () => new Date().toISOString().slice(0, 10);
const EMPTY = { name: '', fatherName: '', designation: '', phone: '', cnic: '', address: '', joiningDate: '', shift: 'full_day', duty: '', status: 'active', place: '', customOffice: '' };

// A "place" is written 'd:<departmentId>' or 'o:<office name>', so one dropdown can hold both.
const placeParams = (place) => (place.startsWith('d:') ? { department: place.slice(2) } : place.startsWith('o:') ? { office: place.slice(2) } : {});
const deptText = (d) => (d ? `${d.name}${d.code ? ` (${d.code})` : ''}` : '');
const placeName = (s) => (s?.department?.name ? deptText(s.department) : s?.office || '—');
const placeOfStaff = (s) => (s.department?._id ? `d:${s.department._id}` : s.office ? `o:${s.office}` : '');

function PlaceOptions({ departments, offices, withOther }) {
  return (
    <>
      {departments.length > 0 && (
        <optgroup label="Departments">
          {departments.map((d) => <option key={d._id} value={`d:${d._id}`}>{deptText(d)}</option>)}
        </optgroup>
      )}
      <optgroup label="Offices & sections">
        {offices.map((o) => <option key={o} value={`o:${o}`}>{o}</option>)}
        {withOther && <option value={OTHER}>Other office (type the name)…</option>}
      </optgroup>
    </>
  );
}

export default function SupportStaff() {
  const { user } = useSelector((s) => s.auth);
  const isHead = user.role === 'university_head';
  const confirm = useConfirm();
  const [msg, ok, fail, clear] = useFlash();
  const [tab, setTab] = useState('staff');
  const [place, setPlace] = useState(''); // filter: '' | 'd:<id>' | 'o:<name>'
  const [departments, setDepartments] = useState([]); // the head gets all of them, an HOD only their own
  const [deptLoaded, setDeptLoaded] = useState(false);
  const [staff, setStaff] = useState([]);
  const [customOffices, setCustomOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ search: '', status: '' });
  const [editing, setEditing] = useState(null); // null | { ...staff } | EMPTY

  const activeDepts = useMemo(() => departments.filter((d) => !d.status || d.status === 'active'), [departments]);
  const offices = useMemo(() => [...OFFICES, ...customOffices.filter((o) => !OFFICES.includes(o))], [customOffices]);

  useEffect(() => {
    api.get('/departments')
      .then((r) => { const d = r.data.data; setDepartments(Array.isArray(d) ? d : d?.departments || []); })
      .catch(fail)
      .finally(() => setDeptLoaded(true));
  }, [fail]);

  const loadStaff = useCallback(() => {
    const params = isHead ? placeParams(place) : {};
    if (filter.status) params.status = filter.status;
    if (filter.search.trim()) params.search = filter.search.trim();
    setLoading(true);
    api.get('/support-staff', { params })
      .then((r) => {
        setStaff(r.data.data);
        const names = r.data.data.map((s) => s.office).filter(Boolean);
        setCustomOffices((old) => [...new Set([...old, ...names])]); // offices typed earlier stay in the dropdowns
      })
      .catch(fail)
      .finally(() => setLoading(false));
  }, [isHead, place, filter, fail]);
  useEffect(() => { const t = setTimeout(loadStaff, 250); return () => clearTimeout(t); }, [loadStaff]);

  const openAdd = () => {
    clear();
    // The principal starts from the place filtered above; an HOD always works in their own department.
    setEditing({ ...EMPTY, place: isHead ? place : activeDepts[0] ? `d:${activeDepts[0]._id}` : '' });
  };

  const remove = async (s) => {
    const yes = await confirm({
      tone: 'danger',
      title: `Delete ${s.name}?`,
      message: 'Their assigned duties are deleted too. To keep the history, set the status to Inactive instead.',
      confirmText: 'Delete',
    });
    if (!yes) return;
    try { await api.delete(`/support-staff/${s._id}`); ok('Staff member deleted'); loadStaff(); } catch (err) { fail(err); }
  };

  // After saving, make sure the new person is not hidden by a place / status / search filter that was set before.
  const saved = (text, savedPlace) => {
    setEditing(null);
    ok(text);
    setFilter({ search: '', status: '' });
    if (isHead && place && savedPlace && place !== savedPlace) setPlace(savedPlace);
    else loadStaff();
  };

  return (
    <>
      <div className="row-between">
        <div>
          <h1>Class IV Staff</h1>
          <p className="muted">
            {isHead
              ? 'Peons, cleaners, guards and other support staff of every department and office (main college, principal, controller, finance ...), and their daily duties.'
              : `Peons, cleaners, guards and other support staff of ${deptText(activeDepts[0]) || 'your department'}, and their daily duties.`}
          </p>
        </div>
        {tab === 'staff' && <button className="btn btn-primary" onClick={openAdd}>＋ Add staff</button>}
      </div>
      <Alert msg={msg} />
      <Tabs tabs={[['staff', 'Staff'], ['duties', 'Duties & activity']]} active={tab} onChange={(t) => { setTab(t); clear(); }} />

      {isHead && (
        <div className="card filters">
          <select value={place} onChange={(e) => setPlace(e.target.value)}>
            <option value="">All departments and offices</option>
            <PlaceOptions departments={departments} offices={offices} />
          </select>
        </div>
      )}

      {tab === 'staff' && (
        <>
          <div className="card filters">
            <input placeholder="Search name, phone, designation…" value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
              <option value="">All statuses</option>
              {STATUSES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="ss-grid">
            {loading && <div className="card muted">Loading…</div>}
            {!loading && !staff.length && <div className="card muted">No staff found. Use “Add staff” to add the first one.</div>}
            {staff.map((s) => (
              <article key={s._id} className="card ss-card">
                <div className="ss-head">
                  <Avatar user={s} size={56} photoBase={PHOTO_BASE} />
                  <div className="ss-who">
                    <b>{s.name}</b>
                    <span className="muted small">{s.designation}</span>
                  </div>
                  <Badge value={s.status} text={label(s.status)} />
                </div>
                <dl className="ss-info">
                  <dt>Works at</dt><dd><b>{placeName(s)}</b></dd>
                  {s.phone && <><dt>Phone</dt><dd><a href={`tel:${s.phone}`}>{s.phone}</a></dd></>}
                  <dt>Shift</dt><dd>{label(s.shift)}</dd>
                  {s.joiningDate && <><dt>Joined</dt><dd>{toInputDate(s.joiningDate)}</dd></>}
                  {s.duty && <><dt>Duty</dt><dd>{s.duty}</dd></>}
                </dl>
                <div className="actions">
                  <button className="btn btn-small" onClick={() => { clear(); setEditing({ ...EMPTY, ...s, place: placeOfStaff(s), joiningDate: toInputDate(s.joiningDate) }); }}>Edit</button>
                  <button className="btn btn-small btn-danger" onClick={() => remove(s)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'duties' && <Duties staff={staff} place={isHead ? place : ''} ok={ok} fail={fail} confirm={confirm} />}

      {editing && (
        <StaffForm
          initial={editing}
          isHead={isHead}
          departments={activeDepts}
          allDepartments={departments}
          offices={offices}
          deptLoaded={deptLoaded}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </>
  );
}

// ---------- add / edit window ----------
// Errors are shown INSIDE this window (a message window opened by the page would hide behind it).
function StaffForm({ initial, isHead, departments, allDepartments, offices, deptLoaded, onClose, onSaved }) {
  const isNew = !initial._id;
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // An HOD's department may arrive after the window opened (the list is still loading): pick it as soon as it is known.
  useEffect(() => {
    if (isNew && !isHead && !form.place && departments.length) setForm((f) => ({ ...f, place: `d:${departments[0]._id}` }));
  }, [isNew, isHead, departments, form.place]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const fixedPlace = (() => {
    if (form.place.startsWith('d:')) return deptText(allDepartments.find((d) => d._id === form.place.slice(2))) || initial.department?.name || '';
    if (form.place.startsWith('o:')) return form.place.slice(2);
    return '';
  })();
  const noDepartment = deptLoaded && isNew && !isHead && !departments.length;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const customName = form.customOffice.trim();
    if (isNew && !form.place) return setError('Choose where this staff member works: a department or an office.');
    if (isNew && form.place === OTHER && customName.length < 2) return setError('Type the name of the office.');
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(), fatherName: form.fatherName, designation: form.designation.trim(), phone: form.phone, cnic: form.cnic,
        address: form.address, joiningDate: form.joiningDate || null, shift: form.shift, duty: form.duty, status: form.status,
      };
      let id = initial._id;
      let savedPlace = form.place;
      if (isNew) {
        // The server uses the place for the principal and ignores it for an HOD (their own department is always used).
        if (form.place.startsWith('d:')) body.department = form.place.slice(2);
        else if (form.place === OTHER) { body.office = customName; savedPlace = `o:${customName}`; }
        else body.office = form.place.slice(2);
        id = (await api.post('/support-staff', body)).data.data._id;
      } else {
        await api.put(`/support-staff/${id}`, body);
      }
      let photoNote = '';
      try {
        if (file) { const f = new FormData(); f.append('photo', await shrink(file), 'photo.jpg'); await api.put(`/support-staff/${id}/photo`, f); forgetPhoto(id); }
        else if (removePhoto && initial.hasPhoto) { await api.delete(`/support-staff/${id}/photo`); forgetPhoto(id); }
      } catch { photoNote = ' The photo could not be saved: open Edit and try again.'; }
      onSaved(`${isNew ? 'Staff member added' : 'Staff member updated'}${fixedPlace || form.place === OTHER ? ` — ${form.place === OTHER ? customName : fixedPlace}` : ''}.${photoNote}`, savedPlace);
    } catch (err) {
      setError(errorMessage(err));
      document.querySelector('.ss-modal')?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop ss-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal ss-modal" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="ss-title">
        <h3 id="ss-title">{isNew ? 'Add Class IV staff' : `Edit ${initial.name}`}</h3>
        {error && <div className="alert alert-error ss-error" role="alert">{error}</div>}
        {noDepartment && <div className="alert alert-error ss-error">No active department is assigned to you, so staff cannot be added yet.</div>}

        <div className="ss-photo">
          {preview ? <img className="avatar-img" src={preview} alt="" style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover' }} />
            : removePhoto ? <Avatar user={{ name: form.name }} size={84} /> : <Avatar user={initial} size={84} photoBase={PHOTO_BASE} />}
          <div className="photo-actions">
            <label className="btn btn-small btn-primary" style={{ cursor: 'pointer', margin: 0 }}>
              {initial.hasPhoto || file ? 'Change photo' : 'Upload photo'}
              <input type="file" accept="image/*" hidden onChange={(e) => { setFile(e.target.files?.[0] || null); setRemovePhoto(false); }} />
            </label>
            {(file || (initial.hasPhoto && !removePhoto)) && (
              <button type="button" className="btn btn-small" onClick={() => { setFile(null); setRemovePhoto(!!initial.hasPhoto); }}>Remove</button>
            )}
            <span className="muted small">Cropped to a square and shrunk automatically.</span>
          </div>
        </div>

        <div className="form-grid ss-fields">
          {/* Works at: the principal chooses a department or an office; an HOD (and every edit) sees it fixed. Always visible. */}
          <div className="ss-wide">
            <label>Works at (department or office)</label>
            {isNew && isHead ? (
              <select required value={form.place} onChange={set('place')}>
                <option value="">{deptLoaded ? 'Choose where this person works…' : 'Loading…'}</option>
                <PlaceOptions departments={departments} offices={offices} withOther />
              </select>
            ) : (
              <input readOnly value={fixedPlace || (deptLoaded ? 'Your department' : 'Loading…')} />
            )}
          </div>
          {isNew && isHead && form.place === OTHER && (
            <div className="ss-wide"><label>Office name</label><input required minLength={2} maxLength={80} value={form.customOffice} placeholder="e.g. Sports Office" onChange={set('customOffice')} /></div>
          )}
          <div><label>Full name</label><input required minLength={2} value={form.name} onChange={set('name')} /></div>
          <div>
            <label>Designation</label>
            <input required minLength={2} list="ss-designations" value={form.designation} placeholder="e.g. Peon" onChange={set('designation')} />
            <datalist id="ss-designations">{DESIGNATIONS.map((d) => <option key={d} value={d} />)}</datalist>
          </div>
          <div><label>Phone</label><input type="tel" value={form.phone} placeholder="03xx-xxxxxxx" onChange={set('phone')} /></div>
          <div><label>Joining date</label><input type="date" value={form.joiningDate} onChange={set('joiningDate')} /></div>
          <div><label>Shift</label><select value={form.shift} onChange={set('shift')}>{SHIFTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          {!isNew && <div><label>Status</label><select value={form.status} onChange={set('status')}>{STATUSES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>}
          <div className="ss-wide"><label>Regular duty / place</label><input maxLength={300} value={form.duty} placeholder="e.g. Block A, ground floor" onChange={set('duty')} /></div>
          <div><label>Father’s name</label><input value={form.fatherName} onChange={set('fatherName')} /></div>
          <div><label>CNIC</label><input value={form.cnic} placeholder="12345-1234567-1" onChange={set('cnic')} /></div>
          <div className="ss-wide"><label>Address</label><input value={form.address} onChange={set('address')} /></div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || noDepartment}>{busy ? 'Saving…' : isNew ? 'Add staff' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}

// ---------- duties ----------
const DUTY_BADGE = { assigned: 'Assigned', in_progress: 'In progress', done: 'Done', not_done: 'Not done' };

function Duties({ staff, place, ok, fail, confirm }) {
  const [date, setDate] = useState(todayKey());
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ staff: '', title: '', details: '', date: todayKey(), repeatUntil: '' });
  const [busy, setBusy] = useState(false);

  const active = useMemo(() => staff.filter((s) => s.status !== 'inactive'), [staff]);

  const load = useCallback(() => {
    const params = { date, ...placeParams(place) };
    setLoading(true);
    api.get('/support-staff/duties', { params }).then((r) => setDuties(r.data.data)).catch(fail).finally(() => setLoading(false));
  }, [date, place, fail]);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { assigned: 0, in_progress: 0, done: 0, not_done: 0 };
    duties.forEach((d) => { c[d.status] += 1; });
    return c;
  }, [duties]);

  const byStaff = useMemo(() => {
    const m = new Map();
    duties.forEach((d) => { const k = d.staff._id; m.set(k, [...(m.get(k) || []), d]); });
    return m;
  }, [duties]);
  const idle = active.filter((s) => s.status === 'active' && !byStaff.has(s._id));

  const assign = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { staff: form.staff, title: form.title, details: form.details, date: form.date };
      if (form.repeatUntil) body.repeatUntil = form.repeatUntil;
      const r = await api.post('/support-staff/duties', body);
      ok(r.data.message);
      setForm({ ...form, title: '', details: '', repeatUntil: '' });
      if (form.date === date || (form.repeatUntil && form.date <= date && form.repeatUntil >= date)) load();
      else setDate(form.date);
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const setStatus = async (d, status) => {
    let note;
    if (status === 'not_done') {
      note = await confirm.prompt({ tone: 'danger', title: 'Mark as not done', message: `${d.staff.name}: ${d.title}`, label: 'Reason (optional)', required: false, multiline: true, confirmText: 'Mark not done' });
      if (note === null) return;
    }
    try { await api.put(`/support-staff/duties/${d._id}`, note !== undefined ? { status, note } : { status }); load(); } catch (err) { fail(err); }
  };

  const del = async (d) => {
    if (!(await confirm({ tone: 'danger', title: 'Remove this duty?', message: `${d.staff.name}: ${d.title} (${d.date})`, confirmText: 'Remove' }))) return;
    try { await api.delete(`/support-staff/duties/${d._id}`); load(); } catch (err) { fail(err); }
  };

  return (
    <>
      <form className="card" onSubmit={assign}>
        <h3>Assign a duty</h3>
        <div className="form-grid ss-fields">
          <div>
            <label>Staff member</label>
            <select required value={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.value })}>
              <option value="">Choose…</option>
              {active.map((s) => <option key={s._id} value={s._id}>{s.name} — {s.designation} ({placeName(s)})</option>)}
            </select>
          </div>
          <div>
            <label>Duty</label>
            <input required minLength={2} maxLength={120} list="ss-duty-ideas" value={form.title} placeholder="e.g. Clean labs" onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <datalist id="ss-duty-ideas">{DUTY_IDEAS.map((d) => <option key={d} value={d} />)}</datalist>
          </div>
          <div><label>Day</label><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value, repeatUntil: form.repeatUntil && form.repeatUntil < e.target.value ? '' : form.repeatUntil })} /></div>
          <div><label>Repeat every day until (optional)</label><input type="date" min={form.date} value={form.repeatUntil} onChange={(e) => setForm({ ...form, repeatUntil: e.target.value })} /></div>
          <div className="ss-wide"><label>Details (optional)</label><input maxLength={500} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} /></div>
        </div>
        <button className="btn btn-primary mt" disabled={busy}>{busy ? 'Saving…' : 'Assign duty'}</button>
      </form>

      <div className="card filters ss-datebar">
        <div><label>Day</label><input type="date" value={date} onChange={(e) => setDate(e.target.value || todayKey())} /></div>
        <div className="ss-chips">
          {Object.entries(DUTY_BADGE).map(([k, v]) => <span key={k} className={`ss-chip ${k}`}><b>{counts[k]}</b> {v}</span>)}
        </div>
      </div>

      {loading && <div className="card muted">Loading…</div>}
      {!loading && !duties.length && <div className="card muted">No duties assigned for {date}.</div>}

      <div className="ss-duty-groups">
        {[...byStaff.entries()].map(([id, list]) => (
          <section key={id} className="card ss-duty-card">
            <div className="ss-head">
              <Avatar user={list[0].staff} size={44} photoBase={PHOTO_BASE} />
              <div className="ss-who"><b>{list[0].staff.name}</b><span className="muted small">{list[0].staff.designation} · {placeName(list[0])}</span></div>
            </div>
            {list.map((d) => (
              <div key={d._id} className={`ss-duty ${d.status}`}>
                <div className="ss-duty-main">
                  <b>{d.title}</b>
                  {d.details && <div className="muted small">{d.details}</div>}
                  {d.note && <div className="small ss-note">Note: {d.note}</div>}
                </div>
                <Badge value={d.status} text={DUTY_BADGE[d.status]} />
                <div className="actions">
                  {d.status !== 'in_progress' && d.status !== 'done' && <button className="btn btn-small" onClick={() => setStatus(d, 'in_progress')}>Start</button>}
                  {d.status !== 'done' && <button className="btn btn-small btn-primary" onClick={() => setStatus(d, 'done')}>Done</button>}
                  {d.status !== 'not_done' && d.status !== 'done' && <button className="btn btn-small" onClick={() => setStatus(d, 'not_done')}>Not done</button>}
                  {(d.status === 'done' || d.status === 'not_done') && <button className="btn btn-small" onClick={() => setStatus(d, 'assigned')}>Reopen</button>}
                  <button className="btn btn-small btn-danger" onClick={() => del(d)} aria-label="Remove duty">✕</button>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      {!loading && idle.length > 0 && (
        <p className="muted small ss-idle">No duty yet on {date}: {idle.map((s) => s.name).join(', ')}.</p>
      )}
    </>
  );
}
