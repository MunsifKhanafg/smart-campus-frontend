import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';
import { useConfirm } from '../components/ConfirmModal.jsx';

const EMPTY = { title: '', code: '', semester: '', creditHours: 3, section: 'A', description: '', outline: '' };

// One page, three views: the HOD manages courses, the head only looks, a teacher sees just their own.
export default function Courses() {
  const { user } = useSelector((s) => s.auth);
  const isHod = user.role === 'hod';
  const isHead = user.role === 'university_head';
  const isTeacher = user.role === 'teacher';
  const confirm = useConfirm();

  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [filter, setFilter] = useState({ department: '', semester: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [editing, setEditing] = useState(null); // null | 'new' | course
  const [form, setForm] = useState(EMPTY);
  const [assigning, setAssigning] = useState(null); // course whose teacher is being changed
  const [teacherId, setTeacherId] = useState('');

  const flash = (type, text) => setMsg({ type, text });

  const load = useCallback(async () => {
    try {
      const params = {};
      if (filter.department) params.department = filter.department;
      if (filter.semester) params.semester = filter.semester;
      const { data } = await api.get('/courses', { params });
      setCourses(data.data);
    } catch (e) {
      flash('error', errorMessage(e));
    }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/semesters').then((r) => setSemesters(r.data.data)).catch(() => {});
    if (isHead) api.get('/departments').then((r) => setDepartments(r.data.data)).catch(() => {});
    if (isHod) api.get('/users', { params: { role: 'teacher' } }).then((r) => setTeachers(r.data.data)).catch(() => {});
  }, [isHead, isHod]);

  const openForm = (c) => {
    setEditing(c || 'new');
    setForm(
      c
        ? { title: c.title, code: c.code, semester: c.semester?._id, creditHours: c.creditHours, section: c.section, description: c.description || '', outline: c.outline || '' }
        : EMPTY
    );
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form, creditHours: Number(form.creditHours) };
      if (editing === 'new') {
        await api.post('/courses', body);
      } else {
        const { semester, ...editable } = body; // semester can't change after creation
        await api.put(`/courses/${editing._id}`, editable);
      }
      flash('success', 'Course saved');
      setEditing(null);
      load();
    } catch (err) {
      flash('error', errorMessage(err));
    }
  };

  const saveTeacher = async () => {
    try {
      await api.patch(`/courses/${assigning._id}/teacher`, { teacher: teacherId || null });
      flash('success', teacherId ? 'Teacher assigned' : 'Teacher removed');
      setAssigning(null);
      load();
    } catch (err) {
      flash('error', errorMessage(err));
    }
  };

  const toggleArchive = async (c) => {
    const status = c.status === 'active' ? 'archived' : 'active';
    const archiving = status === 'archived';
    const yes = await confirm({
      tone: archiving ? 'danger' : 'primary',
      title: `${archiving ? 'Archive' : 'Re-activate'} ${c.code}?`,
      message: archiving
        ? 'The course is hidden from new work but all its records are kept.'
        : 'The course becomes active again.',
      confirmText: archiving ? 'Archive' : 'Re-activate',
    });
    if (!yes) return;
    try {
      await api.patch(`/courses/${c._id}/status`, { status });
      load();
    } catch (err) {
      flash('error', errorMessage(err));
    }
  };

  const remove = async (c) => {
    const yes = await confirm({
      tone: 'danger',
      title: `Delete ${c.code} - ${c.title}?`,
      message: `Section ${c.section} will be deleted permanently, together with its timetable slots and enrollments.\n\nThis is only allowed if the course has no attendance, topics, assignments, quizzes or marks yet. Otherwise use Archive.`,
      confirmText: 'Delete course',
    });
    if (!yes) return;
    try {
      await api.delete(`/courses/${c._id}`);
      flash('success', 'Course deleted');
      load();
    } catch (err) {
      flash('error', errorMessage(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openSemesters = semesters.filter((s) => !['completed', 'archived'].includes(s.status));

  return (
    <>
      <div className="row-between">
        <h1>{isTeacher ? 'My Courses' : 'Courses'}</h1>
        {isHod && <button className="btn btn-primary" onClick={() => openForm(null)}>+ New course</button>}
      </div>
      {isTeacher && <p className="muted">Only courses assigned to you by your HOD are shown here.</p>}
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {!isTeacher && (
        <div className="card filters">
          {isHead && (
            <div>
              <label>Department</label>
              <select value={filter.department} onChange={(e) => setFilter({ ...filter, department: e.target.value })}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label>Semester</label>
            <select value={filter.semester} onChange={(e) => setFilter({ ...filter, semester: e.target.value })}>
              <option value="">All semesters</option>
              {semesters
                .filter((s) => !filter.department || s.department?._id === filter.department)
                .map((s) => <option key={s._id} value={s._id}>{s.name} ({s.academicYear})</option>)}
            </select>
          </div>
        </div>
      )}

      {editing && isHod && (
        <form className="card" onSubmit={save}>
          <h3>{editing === 'new' ? 'New course' : `Edit ${editing.code}`}</h3>
          <div className="form-grid">
            <div><label>Title</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label>Course code</label><input required maxLength={20} value={form.code} placeholder="CS-301" onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div>
              <label>Semester</label>
              <select required disabled={editing !== 'new'} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                <option value="">Select semester...</option>
                {(editing === 'new' ? openSemesters : semesters).map((s) => <option key={s._id} value={s._id}>{s.name} ({s.academicYear})</option>)}
              </select>
            </div>
            <div><label>Credit hours</label><input type="number" min={1} max={6} required value={form.creditHours} onChange={(e) => setForm({ ...form, creditHours: e.target.value })} /></div>
            <div><label>Section</label><input maxLength={10} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></div>
          </div>
          <label>Description</label>
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label>Course outline</label>
          <textarea rows={5} value={form.outline} onChange={(e) => setForm({ ...form, outline: e.target.value })} />
          <div className="actions">
            <button className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {assigning && isHod && (
        <div className="card">
          <h3>Teacher for {assigning.code} (Section {assigning.section})</h3>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">— No teacher —</option>
            {teachers.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.email})</option>)}
          </select>
          <div className="actions">
            <button className="btn btn-primary" onClick={saveTeacher}>Save</button>
            <button className="btn btn-ghost" onClick={() => setAssigning(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th><th>Title</th>{isHead && <th>Dept</th>}<th>Semester</th><th>Sec</th><th>Cr.</th>
              {!isTeacher && <th>Teacher</th>}<th>Status</th>{isHod && <th />}
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c._id}>
                <td><Link to={`/courses/${c._id}`}>{c.code}</Link></td>
                <td>{c.title}</td>
                {isHead && <td>{c.department?.code}</td>}
                <td>{c.semester?.name}</td>
                <td>{c.section}</td>
                <td>{c.creditHours}</td>
                {!isTeacher && <td>{c.teacher ? c.teacher.name : <em className="muted">Unassigned</em>}</td>}
                <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                {isHod && (
                  <td className="actions">
                    {c.status === 'active' && <button className="btn btn-small" onClick={() => openForm(c)}>Edit</button>}
                    {c.status === 'active' && (
                      <button className="btn btn-small" onClick={() => { setAssigning(c); setTeacherId(c.teacher?._id || ''); }}>
                        Assign teacher
                      </button>
                    )}
                    <button className="btn btn-small btn-danger" onClick={() => toggleArchive(c)}>
                      {c.status === 'active' ? 'Archive' : 'Activate'}
                    </button>
                    <button className="btn btn-small btn-danger" onClick={() => remove(c)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {!courses.length && (
              <tr><td colSpan={9} className="muted">{isTeacher ? 'No courses assigned to you yet.' : 'No courses found.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
