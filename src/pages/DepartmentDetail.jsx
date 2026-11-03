import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api, { errorMessage } from '../api/axios.js';
import { Tabs, fmtDate, useFlash, Alert } from '../components/ui.jsx';
import TeachersPanel from '../components/TeachersPanel.jsx';
import StudentsPanel from '../components/StudentsPanel.jsx';
import AttendancePanel from '../components/AttendancePanel.jsx';

// One department: its semesters (click one to see classes), teachers, students and attendance.
export default function DepartmentDetail() {
  const { deptId } = useParams();
  const { user } = useSelector((s) => s.auth);
  const navigate = useNavigate();
  const isHod = user.role === 'hod';
  const [dept, setDept] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [teacherCount, setTeacherCount] = useState(0);
  const [tab, setTab] = useState('semesters');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ description: '', contact: { email: '', phone: '', office: '', officeHours: '' } });
  const [msg, ok, fail] = useFlash();

  const load = () => {
    const p = { department: deptId };
    Promise.all([
      api.get('/departments'),
      api.get('/semesters', { params: p }),
      api.get('/courses', { params: p }),
      api.get('/students', { params: p }),
      api.get('/users', { params: p }),
    ])
      .then(([d, s, c, st, u]) => {
        const found = d.data.data.find((x) => x._id === deptId);
        if (!found) return setError('Department not found or you do not have access to it.');
        setDept(found);
        setSemesters(s.data.data);
        setCourses(c.data.data);
        setStudents(st.data.data);
        setTeacherCount(u.data.data.filter((x) => ['teacher', 'hod'].includes(x.role)).length);
      })
      .catch((e) => setError(errorMessage(e)));
  };
  useEffect(load, [deptId]); // eslint-disable-line react-hooks/exhaustive-deps

  const perSemester = useMemo(() => {
    const out = {};
    semesters.forEach((s) => { out[s._id] = { courses: 0, students: 0 }; });
    courses.forEach((c) => { if (out[c.semester?._id]) out[c.semester._id].courses += 1; });
    students.forEach((p) => { if (out[p.semester?._id]) out[p.semester._id].students += 1; });
    return out;
  }, [semesters, courses, students]);

  const startEdit = () => {
    setForm({ description: dept.description || '', contact: { email: '', phone: '', office: '', officeHours: '', ...dept.contact } });
    setEditing(true);
  };
  const saveInfo = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/departments/${deptId}`, form);
      ok('Department information saved');
      setEditing(false);
      load();
    } catch (err) { fail(err); }
  };
  const setC = (k, v) => setForm({ ...form, contact: { ...form.contact, [k]: v } });

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!dept) return <p className="muted">Loading department...</p>;

  return (
    <>
      <div className="crumbs">
        {!isHod && <><Link to="/departments">Departments</Link><span>/</span></>}
        <span>{dept.name}</span>
      </div>

      <div className="hero">
        <div className="grow">
          <h1>{dept.name} <span className="badge">{dept.code}</span></h1>
          <p>Head of Department: <b>{dept.hod ? dept.hod.name : 'Not assigned yet'}</b></p>
          {dept.description && <p>{dept.description}</p>}
        </div>
        <span className={`badge ${dept.status}`}>{dept.status}</span>
        {isHod && <button className="btn" onClick={startEdit}>Edit info</button>}
      </div>
      <Alert msg={msg} />

      {editing && (
        <form className="card" onSubmit={saveInfo}>
          <h3>Department information</h3>
          <div className="form-grid">
            <div><label>Contact email</label><input type="email" value={form.contact.email || ''} onChange={(e) => setC('email', e.target.value)} /></div>
            <div><label>Contact phone</label><input value={form.contact.phone || ''} onChange={(e) => setC('phone', e.target.value)} /></div>
            <div><label>Office / location</label><input value={form.contact.office || ''} onChange={(e) => setC('office', e.target.value)} /></div>
            <div><label>Office hours</label><input value={form.contact.officeHours || ''} onChange={(e) => setC('officeHours', e.target.value)} /></div>
          </div>
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="actions">
            <button className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="tiles">
        <div className="tile"><div className="ico">📚</div><div><b>{semesters.length}</b><span>Semesters</span></div></div>
        <div className="tile teal"><div className="ico">🏫</div><div><b>{courses.length}</b><span>Classes / courses</span></div></div>
        <div className="tile amber"><div className="ico">👩‍🏫</div><div><b>{teacherCount}</b><span>Teachers</span></div></div>
        <div className="tile rose"><div className="ico">🎓</div><div><b>{students.length}</b><span>Students</span></div></div>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[['semesters', 'Semesters'], ['teachers', 'Teachers'], ['students', 'Students'], ['attendance', 'Attendance']]}
      />

      {tab === 'semesters' && (
        <>
          {isHod && (
            <div className="row-between" style={{ marginBottom: '.75rem' }}>
              <span className="muted">Open a semester to see its classes, timetable and students.</span>
              <Link className="btn btn-ghost" to="/semesters">Manage semesters</Link>
            </div>
          )}
          <div className="dept-grid">
            {semesters.map((s) => (
              <div key={s._id} className="dept-card sem-card" role="link" tabIndex={0}
                onClick={() => navigate(`/departments/${deptId}/semesters/${s._id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/departments/${deptId}/semesters/${s._id}`)}>
                <div className="row-between" style={{ gap: '.5rem' }}>
                  <span className="code">Semester {s.number}</span>
                  <span className={`badge ${s.status}`}>{s.status}</span>
                </div>
                <h3>{s.name}</h3>
                <div className="meta">{s.academicYear} · {fmtDate(s.startDate)} to {fmtDate(s.endDate)}</div>
                <div className="mini">
                  <div><b>{perSemester[s._id]?.courses || 0}</b>Courses</div>
                  <div><b>{perSemester[s._id]?.students || 0}</b>Students</div>
                </div>
              </div>
            ))}
            {!semesters.length && (
              <div className="card empty-state" style={{ gridColumn: '1/-1' }}>
                <div className="big">📚</div>No semesters yet.{isHod && <> <Link to="/semesters">Create the first semester</Link>.</>}
              </div>
            )}
          </div>
        </>
      )}
      {tab === 'teachers' && <TeachersPanel department={deptId} canDelete />}
      {tab === 'students' && <StudentsPanel department={deptId} />}
      {tab === 'attendance' && <AttendancePanel department={deptId} />}
    </>
  );
}
