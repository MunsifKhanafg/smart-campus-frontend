import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate } from '../components/ui.jsx';
import TeacherPicker from '../components/TeacherPicker.jsx';
import { colorAt, colorFor, initials } from '../components/palette.js';

const EMPTY = { title: '', code: '', creditHours: 3, section: 'A', description: '', outline: '' };
const isOpen = (s) => ['upcoming', 'active'].includes(s.status);

// Step 1: choose a semester. Step 2: see only the courses of that semester and manage them.
// HOD manages (own department), the head only looks, a teacher sees just their own courses.
export default function Courses() {
  const { user } = useSelector((s) => s.auth);
  const isHod = user.role === 'hod';
  const isHead = user.role === 'university_head';
  const isTeacher = user.role === 'teacher';

  const [msg, ok, fail, clear] = useFlash();
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [department, setDepartment] = useState('');
  const [selected, setSelected] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | course
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [assigning, setAssigning] = useState(null); // course
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = department ? { department } : {};
      const [s, c] = await Promise.all([api.get('/semesters', { params }), api.get('/courses', { params })]);
      setSemesters(s.data.data);
      setCourses(c.data.data);
    } catch (e) { fail(e); }
  }, [department, fail]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isHead) api.get('/departments').then((r) => setDepartments(r.data.data)).catch(() => {});
    if (isHod) api.get('/users', { params: { role: 'teacher' } }).then((r) => setTeachers(r.data.data.filter((t) => t.isActive))).catch(() => {});
  }, [isHead, isHod]);

  const bySemester = useMemo(() => {
    const map = new Map();
    for (const c of courses) {
      const id = c.semester?._id;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(c);
    }
    return map;
  }, [courses]);

  const visible = useMemo(
    () => semesters.filter((s) => !isTeacher || (bySemester.get(s._id) || []).length > 0),
    [semesters, bySemester, isTeacher]
  );
  const current = visible.filter(isOpen);
  const past = visible.filter((s) => !isOpen(s));
  const ordered = [...current, ...past]; // one colour sequence for both lists

  // Pick a sensible semester automatically (first open one), and keep the choice after reloads.
  useEffect(() => {
    if (selected && visible.some((s) => s._id === selected)) return;
    setSelected((current[0] || visible[0])?._id || '');
  }, [visible, current, selected]);

  const semester = visible.find((s) => s._id === selected);
  const semIndex = Math.max(0, ordered.findIndex((s) => s._id === selected));
  const list = (bySemester.get(selected) || []).filter((c) => {
    const q = search.trim().toLowerCase();
    return !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || (c.teacher?.name || '').toLowerCase().includes(q);
  });
  const activeCount = (id) => (bySemester.get(id) || []).filter((c) => c.status === 'active').length;
  const unassignedCount = (id) => (bySemester.get(id) || []).filter((c) => c.status === 'active' && !c.teacher).length;

  // What each teacher already teaches (all semesters), shown in the picker so the HOD can balance the load.
  const teachersWithLoad = useMemo(() => teachers.map((t) => {
    const mine = courses.filter((c) => c.status === 'active' && c.teacher?._id === t._id);
    return { ...t, assignments: mine.map((c) => ({ _id: c._id, code: c.code, section: c.section })), creditHours: mine.reduce((n, c) => n + (c.creditHours || 0), 0) };
  }), [teachers, courses]);

  // ---------- course form ----------
  const openForm = (c) => {
    setFormError('');
    setEditing(c || 'new');
    setForm(c ? { title: c.title, code: c.code, creditHours: c.creditHours, section: c.section, description: c.description || '', outline: c.outline || '' } : EMPTY);
  };

  const save = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const body = { ...form, creditHours: Number(form.creditHours) };
      let message = 'Course updated';
      if (editing === 'new') message = (await api.post('/courses', { ...body, semester: selected })).data.message;
      else await api.put(`/courses/${editing._id}`, body);
      ok(message);
      setEditing(null);
      load();
    } catch (err) { setFormError(errorMessage(err)); }
  };

  const toggleArchive = async (c) => {
    const status = c.status === 'active' ? 'archived' : 'active';
    if (!window.confirm(`${status === 'archived' ? 'Archive' : 'Re-activate'} ${c.code}?`)) return;
    try { await api.patch(`/courses/${c._id}/status`, { status }); load(); } catch (err) { fail(err); }
  };

  // ---------- teacher assignment ----------
  const openAssign = (c) => { clear(); setAssigning(c); setPick(c.teacher?._id || ''); };

  const saveTeacher = async (teacherId) => {
    setBusy(true);
    try {
      await api.patch(`/courses/${assigning._id}/teacher`, { teacher: teacherId || null });
      ok(teacherId ? 'Teacher assigned' : 'Teacher removed');
      setAssigning(null);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const SemesterCard = ({ s }) => {
    const n = activeCount(s._id);
    const missing = unassignedCount(s._id);
    return (
      <button type="button" style={colorAt(ordered.findIndex((x) => x._id === s._id))} className={`cx-sem ${s._id === selected ? 'on' : ''}`}
        onClick={() => { setSelected(s._id); setSearch(''); setEditing(null); }}>
        <b>{s.name}</b>
        <small>{isHead && s.department?.code ? `${s.department.code} · ` : ''}{s.academicYear} · Semester {s.number}</small>
        <small>{fmtDate(s.startDate)} to {fmtDate(s.endDate)}</small>
        <div className="cx-tags">
          <span className="cx-tag">{s.status}</span>
          <span className="cx-tag">{n} course{n === 1 ? '' : 's'}</span>
          {!isTeacher && missing > 0 && <span className="cx-tag warn">{missing} without teacher</span>}
          {!isTeacher && missing === 0 && n > 0 && <span className="cx-tag">All assigned ✓</span>}
        </div>
      </button>
    );
  };

  return (
    <>
      <div className="row-between">
        <h1>{isTeacher ? 'My Courses' : 'Courses'}</h1>
        {isHead && (
          <select style={{ width: 'auto' }} value={department} onChange={(e) => { setDepartment(e.target.value); setSelected(''); }}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        )}
      </div>
      <p className="muted">
        {isTeacher ? 'Your assigned courses, grouped by semester.' : isHead ? 'Read-only view. Courses are managed by each HOD.' : 'Choose a semester, then add courses and assign teachers.'}
      </p>
      <Alert msg={assigning ? null : msg} />

      {!visible.length && <div className="card muted">{isTeacher ? 'No courses have been assigned to you yet.' : 'No semesters yet. Create one on the Semesters page first.'}</div>}

      {current.length > 0 && (
        <>
          <h3 className="cx-title"><span className="num">1</span> {isTeacher ? 'Your semesters' : 'Choose a semester'}</h3>
          <div className="cx-sems">{current.map((s) => <SemesterCard key={s._id} s={s} />)}</div>
        </>
      )}
      {past.length > 0 && (
        <>
          <button className="link-btn small" style={{ marginTop: '.8rem' }} onClick={() => setShowPast(!showPast)}>{showPast ? 'Hide' : 'Show'} past semesters ({past.length})</button>
          {showPast && <div className="cx-sems" style={{ marginTop: '.6rem' }}>{past.map((s) => <SemesterCard key={s._id} s={s} />)}</div>}
        </>
      )}

      {semester && (
        <>
          <div className="row-between" style={{ marginTop: '1.25rem' }}>
            <h3 className="cx-title" style={{ margin: 0 }}><span className="num">2</span> {semester.name} <span className="cx-muted">{semester.academicYear}</span></h3>
            <div className="actions">
              <input style={{ width: 230 }} placeholder="Search course or teacher..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {isHod && isOpen(semester) && <button className="btn btn-primary inline" onClick={() => openForm(null)}>+ Add course</button>}
            </div>
          </div>

          {editing && isHod && (
            <form className="card mt" onSubmit={save}>
              <h3>{editing === 'new' ? `New course in ${semester.name}` : `Edit ${editing.code}`}</h3>
              {formError && <div className="alert alert-error">{formError}</div>}
              <div className="form-grid">
                <div><label>Title</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><label>Course code</label><input required maxLength={20} placeholder="CS-301" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
                <div><label>Credit hours</label><input type="number" min={1} max={6} required value={form.creditHours} onChange={(e) => setForm({ ...form, creditHours: e.target.value })} /></div>
                <div><label>Section</label><input maxLength={10} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></div>
              </div>
              <label>Description</label>
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <label>Course outline</label>
              <textarea rows={4} value={form.outline} onChange={(e) => setForm({ ...form, outline: e.target.value })} />
              <p className="muted small">After saving, use "Assign teacher" on the course card. Students already placed in this semester and section are enrolled automatically.</p>
              <div className="actions">
                <button className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          )}

          {!list.length && <div className="card muted mt">{search ? 'No course matches your search.' : 'No courses in this semester yet.'}</div>}
          <div className="cx-subjects" style={{ marginTop: '.9rem' }}>
            {list.map((c, i) => (
              <div key={c._id} className="cx-subj" style={{ ...colorAt(semIndex + i), opacity: c.status === 'archived' ? 0.6 : 1 }}>
                <div className="cx-subj-head">
                  <div className="grow">
                    <div className="code">{c.code} · Section {c.section}</div>
                    <h4>{c.title}</h4>
                  </div>
                  <span className="cx-credit">{c.creditHours} cr</span>
                </div>
                <div className="cx-subj-body">
                  {c.status === 'archived' && <Badge value="archived" />}
                  {!isTeacher && (
                    <div className={`cx-class ${c.teacher ? '' : 'none'}`} style={c.teacher ? colorFor(c.teacher.name) : undefined}>
                      <span className={`cx-av ${c.teacher ? '' : 'empty'}`}>{c.teacher ? initials(c.teacher.name) : '?'}</span>
                      <div className="grow">
                        {c.teacher ? (<><div className="who">{c.teacher.name}</div><div className="cx-muted">{c.teacher.email}</div></>) : <div className="who" style={{ color: '#b91c1c' }}>No teacher assigned</div>}
                      </div>
                    </div>
                  )}
                  <div className="cx-actions">
                    <Link className="btn btn-small btn-primary" to={`/courses/${c._id}`}>Open</Link>
                    {isHod && c.status === 'active' && <button className="btn btn-small" onClick={() => openAssign(c)}>{c.teacher ? 'Change teacher' : 'Assign teacher'}</button>}
                    {isHod && c.status === 'active' && <button className="btn btn-small" onClick={() => openForm(c)}>Edit</button>}
                    {isHod && <button className="btn btn-small btn-danger" onClick={() => toggleArchive(c)}>{c.status === 'active' ? 'Archive' : 'Activate'}</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {assigning && isHod && (
        <TeacherPicker
          color={colorAt(semIndex + Math.max(0, list.findIndex((c) => c._id === assigning._id)))}
          title={`${assigning.code} — ${assigning.title}`}
          subtitle={`${semester?.name || ''} · Section ${assigning.section} · ${assigning.creditHours} credit hours`}
          teachers={teachersWithLoad}
          value={pick}
          onChange={setPick}
          note="If this course is already on the timetable, its classes move to the new teacher. A clash with another class is refused."
          canRemove={!!assigning.teacher}
          onRemove={() => saveTeacher(null)}
          onSave={() => saveTeacher(pick)}
          saveDisabled={!pick || pick === assigning.teacher?._id}
          busy={busy}
          error={msg.type === 'error' ? msg.text : ''}
          onClose={() => { setAssigning(null); clear(); }}
        />
      )}
    </>
  );
}
