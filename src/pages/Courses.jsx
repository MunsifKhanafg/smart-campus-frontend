import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate } from '../components/ui.jsx';
import TeacherPicker from '../components/TeacherPicker.jsx';
import { colorAt, colorFor, initials } from '../components/palette.js';
import { useConfirm } from '../components/ConfirmModal.jsx';

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
  const confirm = useConfirm();
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
  const [selectMode, setSelectMode] = useState(false); // HOD: tick several courses, then delete / archive them together
  const [picked, setPicked] = useState([]);
  const [match, setMatch] = useState(null); // plan returned by "Match to curriculum"
  const [replaceContents, setReplaceContents] = useState(true);

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
    if (!(await confirm({
      tone: status === 'archived' ? 'danger' : 'primary',
      title: `${status === 'archived' ? 'Archive' : 'Re-activate'} ${c.code}?`,
      message: status === 'archived'
        ? `${c.code} ${c.title} (section ${c.section}) is hidden from students and teachers. Its records are kept and you can activate it again later.`
        : `${c.code} ${c.title} (section ${c.section}) becomes active again.`,
      confirmText: status === 'archived' ? 'Archive' : 'Re-activate',
    }))) return;
    try { await api.patch(`/courses/${c._id}/status`, { status }); load(); } catch (err) { fail(err); }
  };

  // Deleting a subject. The page first reads what is inside it:
  //   nothing inside      -> a simple confirmation
  //   attendance, assignments, quizzes ... -> a warning that lists them; only "Yes, delete everything" removes the subject WITH them
  //   saved results       -> refused (results are official records), the HOD can archive the subject instead
  const remove = async (c) => {
    let info;
    try { info = (await api.get(`/courses/${c._id}/delete-preview`)).data.data; } catch (err) { return fail(err); }
    if (info.blocked) return fail(info.blocked);
    const yes = await confirm(info.hasRecords
      ? {
        tone: 'danger',
        title: `${c.code} already has records. Delete everything?`,
        message: `${c.code} ${c.title} (section ${c.section}) contains the data below. If you continue, the subject AND all of this data are deleted permanently. This cannot be undone.`,
        details: info.items.map((i) => `${i.count} ${i.label}`),
        confirmText: 'Yes, delete everything',
        cancelText: 'No, keep it',
      }
      : {
        tone: 'danger',
        title: `Delete ${c.code} ${c.title}?`,
        message: `It has no attendance, assignments or marks. Its timetable classes and student enrolments for section ${c.section} of ${semester?.name} are removed too. If it came from the BS curriculum, the subject stays in the curriculum and you can offer it again later.`,
        confirmText: 'Delete',
      });
    if (!yes) return;
    try {
      await api.delete(`/courses/${c._id}`, { params: info.hasRecords ? { force: 'true' } : {} });
      ok(`${c.code} deleted${info.hasRecords ? ' together with its records' : ''}`);
      load();
    } catch (err) { fail(err); }
  };

  // ---------- bulk: pick the 5-6 subjects a semester really teaches and remove the others ----------
  const semCourses = bySemester.get(selected) || [];
  const togglePick = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const stopSelecting = () => { setSelectMode(false); setPicked([]); };

  // mode 'selected' = remove the ticked courses; mode 'others' = keep the ticked courses, remove everything else.
  // Every subject is checked first. Those with records (attendance, assignments, quizzes ...) are listed in the window, and
  // one "Yes, delete everything" removes them together with their records. Subjects in saved results are skipped.
  const bulkDelete = async (mode) => {
    const chosen = semCourses.filter((c) => (mode === 'selected' ? picked.includes(c._id) : !picked.includes(c._id)));
    if (!chosen.length) return;
    setBusy(true);
    let infos;
    try {
      infos = await Promise.all(chosen.map(async (c) => ({ c, info: (await api.get(`/courses/${c._id}/delete-preview`)).data.data })));
    } catch (err) { setBusy(false); return fail(err); }
    setBusy(false);

    const skipped = infos.filter((x) => x.info.blocked);
    const todo = infos.filter((x) => !x.info.blocked);
    if (!todo.length) return fail(`Nothing was deleted. ${skipped.map((x) => x.info.blocked).join(' ')}`);
    const withData = todo.filter((x) => x.info.hasRecords);

    const head = mode === 'selected'
      ? `Delete these ${todo.length} course(s) from ${semester?.name}?`
      : `Keep your ${picked.length} ticked course(s) and DELETE the other ${todo.length} from ${semester?.name}?`;
    const yes = await confirm({
      tone: 'danger',
      title: withData.length ? `${withData.length} of these subjects already have records. Delete everything?` : head,
      message: `${withData.length ? `${head}\n\n` : ''}Their timetable classes and enrolments are removed too.${withData.length ? ' The records listed below are deleted permanently with their subject. This cannot be undone.' : ' Subjects from the BS curriculum stay in the curriculum.'}${skipped.length ? `\n\nSkipped (part of saved results): ${skipped.map((x) => x.c.code).join(', ')}.` : ''}`,
      details: todo.map(({ c, info }) => `${c.code} ${c.title} (Sec ${c.section})${info.hasRecords ? ` has ${info.items.map((i) => `${i.count} ${i.label}`).join(', ')}` : ''}`),
      confirmText: withData.length ? 'Yes, delete everything' : 'Delete',
      cancelText: 'No, keep them',
    });
    if (!yes) return;

    setBusy(true);
    let done = 0;
    const failed = [];
    for (const { c, info } of todo) {
      try { await api.delete(`/courses/${c._id}`, { params: info.hasRecords ? { force: 'true' } : {} }); done += 1; } catch { failed.push(c); }
    }
    setBusy(false);
    setPicked(mode === 'selected' ? [...failed, ...skipped.map((x) => x.c)].map((c) => c._id) : picked);
    if (failed.length || skipped.length) fail(`${done} deleted. Not deleted: ${[...failed, ...skipped.map((x) => x.c)].map((c) => c.code).join(', ')}.${skipped.length ? ' Subjects in saved results can only be archived.' : ''}`);
    else { ok(`${done} course(s) deleted from ${semester?.name}`); if (mode === 'others') stopSelecting(); }
    load();
  };

  const bulkArchive = async () => {
    const chosen = semCourses.filter((c) => picked.includes(c._id) && c.status === 'active');
    if (!chosen.length) return;
    if (!(await confirm({
      tone: 'danger',
      title: `Archive ${chosen.length} course(s)?`,
      message: 'They are hidden from students and teachers. Their records are kept and you can activate them again later.',
      details: chosen.map((c) => `${c.code} ${c.title} (Sec ${c.section})`),
      confirmText: 'Archive',
    }))) return;
    setBusy(true);
    let done = 0;
    for (const c of chosen) { try { await api.patch(`/courses/${c._id}/status`, { status: 'archived' }); done += 1; } catch { /* skipped */ } }
    setBusy(false);
    ok(`${done} course(s) archived`);
    setPicked([]);
    load();
  };

  // ---------- curriculum: official subject names + course contents ----------
  const syncSemester = async () => {
    if (!(await confirm({
      title: `Fill ${semester?.name} from the curriculum?`,
      message: 'Every class gets the official subject name and the course contents of the BS curriculum. Classes that already have their own contents keep them. Classes are matched by code, then by subject name.',
      confirmText: 'Fill from curriculum',
    }))) return;
    setBusy(true);
    try {
      const { data } = await api.post('/courses/sync-curriculum', { semester: selected });
      const s = data.data;
      const parts = [`${s.updated} class(es) updated`];
      if (s.alreadyComplete) parts.push(`${s.alreadyComplete} already complete`);
      if (s.noContents.length) parts.push(`${s.noContents.length} matched but the curriculum has no contents for: ${s.noContents.join(', ')}`);
      if (s.notFound.length) parts.push(`not found in the curriculum: ${s.notFound.join(', ')}`);
      (s.notFound.length ? fail : ok)(parts.join('. ') + '.');
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const syncOne = async (c) => {
    try {
      const { data } = await api.post(`/courses/${c._id}/sync-curriculum`, {});
      ok(`${c.code}: ${data.message}`);
      load();
    } catch (err) { fail(err); }
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

  // ---------- make this semester match the curriculum (fix wrong / duplicate / missing courses) ----------
  const previewMatch = async () => {
    clear();
    setBusy(true);
    try { setMatch((await api.post('/teaching/match', { semester: selected, replaceContents })).data.data); } catch (err) { fail(err); window.scrollTo({ top: 0, behavior: 'smooth' }); } finally { setBusy(false); }
  };
  const applyMatch = async () => {
    // Subjects that will be removed but already hold attendance, assignments, quizzes ... need the HOD's explicit "yes".
    const withData = match.remove.filter((r) => r.hasRecords && !r.archive);
    if (withData.length && !(await confirm({
      tone: 'danger',
      title: `${withData.length} subject(s) to be removed already have records. Delete everything?`,
      message: 'They are deleted permanently together with the data listed below. This cannot be undone.',
      details: withData.map((r) => `${r.code} Sec ${r.section}: ${r.items.map((i) => `${i.count} ${i.label}`).join(', ')}`),
      confirmText: 'Yes, delete everything',
      cancelText: 'No, go back',
    }))) return;
    setBusy(true);
    try {
      const { data } = await api.post('/teaching/match', { semester: selected, apply: true, replaceContents, force: withData.length > 0 });
      const r = data.data.result;
      ok(`${data.message}${r.archived.length ? `. ${r.archived.length} class(es) were archived instead of deleted because they have records` : ''}.`);
      setMatch(null);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };
  const replaceAllContents = async () => {
    if (!(await confirm({
      tone: 'danger',
      title: `Replace ALL course contents of ${semester?.name}?`,
      message: 'The course contents of every class are replaced with the contents of the BS curriculum. Contents that were typed by hand are overwritten.',
      confirmText: 'Replace all',
    }))) return;
    setBusy(true);
    try {
      const { data } = await api.post('/courses/sync-curriculum', { semester: selected, overwrite: true });
      const s = data.data;
      (s.notFound.length ? fail : ok)(`${s.updated} class(es) updated from the curriculum.${s.notFound.length ? ` Not found in the curriculum: ${s.notFound.join(', ')}.` : ''}`);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };
  const replaceOneContents = async (c) => {
    try { const { data } = await api.post(`/courses/${c._id}/sync-curriculum`, { overwrite: true }); ok(`${c.code}: ${data.message}`); load(); } catch (err) { fail(err); }
  };

  const SemesterCard = ({ s }) => {
    const n = activeCount(s._id);
    const missing = unassignedCount(s._id);
    return (
      <button type="button" style={colorAt(ordered.findIndex((x) => x._id === s._id))} className={`cx-sem ${s._id === selected ? 'on' : ''}`}
        onClick={() => { setSelected(s._id); setSearch(''); setEditing(null); setMatch(null); }}>
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
              {isHod && isOpen(semester) && <button className="btn" disabled={busy} onClick={previewMatch} title="Compare this semester with the BS curriculum and fix wrong, duplicate and missing courses">✅ Match to curriculum</button>}
              {isHod && semCourses.length > 0 && (
                <button className="btn" disabled={busy} onClick={syncSemester} title="Copy the official subject names and the course contents from the BS curriculum">📚 Fill from curriculum</button>
              )}
              {isHod && semCourses.length > 0 && (
                <button className="btn" disabled={busy} onClick={replaceAllContents} title="Overwrite the course contents of every class with the curriculum's">↻ Replace all contents</button>
              )}
              {isHod && semCourses.length > 0 && (
                <button className={`btn ${selectMode ? 'btn-primary' : ''}`} onClick={() => (selectMode ? stopSelecting() : setSelectMode(true))}>
                  {selectMode ? 'Done selecting' : '☑ Select courses'}
                </button>
              )}
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

          {match && isHod && (
            <div className="card mt" style={{ borderLeft: '5px solid #4f46e5' }}>
              <div className="row-between">
                <div>
                  <h3 style={{ margin: 0 }}>{semester.name} should have {match.expected} subject{match.expected === 1 ? '' : 's'}</h3>
                  <div className="muted small">From the curriculum: {match.program.name}, semester {match.semesterNumber}. Nothing changes until you press "Fix this semester".</div>
                </div>
                <button className="btn btn-ghost" onClick={() => setMatch(null)}>Close</button>
              </div>

              {match.remove.length === 0 && match.add.length === 0 && match.fix.length === 0 && (
                <div className="alert alert-success mt">This semester already matches the curriculum. {match.keep.length} subject(s) are correct.</div>
              )}

              {match.keep.length > 0 && (
                <div className="mt"><b>✓ Correct ({match.keep.length})</b>
                  <div className="muted small">{match.keep.map((k) => `${k.code} ${k.title}${k.section ? ` (Sec ${k.section})` : ''}`).join(' · ')}</div>
                </div>
              )}
              {match.fix.length > 0 && (
                <div className="mt"><b>✎ Will be corrected ({match.fix.length})</b>
                  {match.fix.map((f, i) => <div key={i} className="small">{f.code} {f.title} → <b>{f.to.code} {f.to.title}</b> ({f.changes.join(', ')})</div>)}
                </div>
              )}
              {match.remove.length > 0 && (
                <div className="mt"><b style={{ color: '#b91c1c' }}>🗑 Will be removed ({match.remove.length})</b>
                  {match.remove.map((r, i) => (
                    <div key={i} className="small">{r.code} {r.title} (Sec {r.section}){r.teacher ? ` · teacher ${r.teacher}` : ''} — {r.reason}.{' '}
                      {r.archive
                        ? <b>It is part of saved results, so it is archived, not deleted.</b>
                        : r.hasRecords
                          ? <b>Has {r.because}. You will be asked to confirm deleting it with them.</b>
                          : 'Its timetable classes are removed too.'}</div>
                  ))}
                </div>
              )}
              {match.add.length > 0 && (
                <div className="mt"><b style={{ color: '#15803d' }}>＋ Will be added ({match.add.length})</b>
                  {match.add.map((a, i) => <div key={i} className="small">{a.code} {a.title} ({a.creditHours} cr) for section{match.sections.length > 1 ? 's' : ''} {match.sections.join(', ')}</div>)}
                  <div className="muted small">Elective options are never added here. Offer the ones you need on the Assign Teachers page.</div>
                </div>
              )}

              <label className="check mt"><input type="checkbox" checked={replaceContents} onChange={(e) => { setReplaceContents(e.target.checked); setMatch(null); }} /> Also replace the course contents with the curriculum's (changing this closes the plan)</label>
              <div className="actions">
                <button className="btn btn-primary" disabled={busy} onClick={applyMatch}>{busy ? 'Working…' : 'Fix this semester'}</button>
                <button className="btn" onClick={() => setMatch(null)}>Cancel</button>
              </div>
            </div>
          )}

          {selectMode && isHod && (
            <div className="card mt" style={{ borderColor: 'var(--primary-light)' }}>
              <div className="row-between">
                <div>
                  <b>{picked.length} of {semCourses.length} selected</b>
                  <div className="muted small">Tick the subjects, then choose what to do. Tip: tick the 5 or 6 subjects this semester really teaches and press "Keep selected, delete the rest".</div>
                </div>
                <div className="actions">
                  <button className="btn btn-small" onClick={() => setPicked(semCourses.map((c) => c._id))}>Select all</button>
                  <button className="btn btn-small" onClick={() => setPicked(semCourses.filter((c) => !c.teacher).map((c) => c._id))}>Select without teacher</button>
                  <button className="btn btn-small" onClick={() => setPicked([])}>Clear</button>
                </div>
              </div>
              <div className="actions" style={{ marginTop: '.75rem' }}>
                <button className="btn btn-danger" disabled={busy || !picked.length} onClick={() => bulkDelete('selected')}>🗑 Delete selected ({picked.length})</button>
                <button className="btn btn-danger" disabled={busy || !picked.length || picked.length === semCourses.length} onClick={() => bulkDelete('others')}>Keep selected, delete the rest ({Math.max(semCourses.length - picked.length, 0)})</button>
                <button className="btn" disabled={busy || !picked.length} onClick={bulkArchive}>Archive selected</button>
              </div>
            </div>
          )}

          {!list.length && <div className="card muted mt">{search ? 'No course matches your search.' : 'No courses in this semester yet.'}</div>}
          <div className="cx-subjects" style={{ marginTop: '.9rem' }}>
            {list.map((c, i) => (
              <div key={c._id} className="cx-subj" style={{ ...colorAt(semIndex + i), opacity: c.status === 'archived' ? 0.6 : 1, ...(picked.includes(c._id) ? { outline: '3px solid var(--primary-light)', outlineOffset: 2 } : {}) }}>
                <div className="cx-subj-head">
                  {selectMode && isHod && (
                    <input type="checkbox" aria-label={`Select ${c.code}`} style={{ width: 20, height: 20, marginRight: '.6rem', flex: 'none' }} checked={picked.includes(c._id)} onChange={() => togglePick(c._id)} />
                  )}
                  <div className="grow">
                    <div className="code">{c.code} · Section {c.section}</div>
                    <h4>{c.title}</h4>
                  </div>
                  <span className="cx-credit">{c.creditHours} cr</span>
                </div>
                <div className="cx-subj-body">
                  {c.status === 'archived' && <Badge value="archived" />}
                  {c.status === 'active' && !c.outline && <span className="cx-chip bad" style={{ alignSelf: 'flex-start' }}>No course contents yet</span>}
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
                    {isHod && c.status === 'active' && !c.outline && <button className="btn btn-small" onClick={() => syncOne(c)}>📚 From curriculum</button>}
                    {isHod && c.status === 'active' && c.outline && <button className="btn btn-small" title="Overwrite this class's contents with the curriculum's" onClick={() => replaceOneContents(c)}>↻ Contents</button>}
                    {isHod && <button className="btn btn-small" onClick={() => toggleArchive(c)}>{c.status === 'active' ? 'Archive' : 'Activate'}</button>}
                    {isHod && <button className="btn btn-small btn-danger" onClick={() => remove(c)}>Delete</button>}
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
