import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { useFlash, Alert, Tabs, Badge } from '../components/ui.jsx';

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

// HOD (own department) and University Head (any department): university reports, attendance summaries
// and the early-warning view of students who may need support. Recommendations only.
export default function Insights() {
  const role = useSelector((s) => s.auth.user.role);
  const isHead = role === 'university_head';
  const [msg, , fail] = useFlash();
  const [tab, setTab] = useState('overview');
  const [depts, setDepts] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [filter, setFilter] = useState({ department: '', semester: '' });
  const [overview, setOverview] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [support, setSupport] = useState(null);

  useEffect(() => {
    api.get('/semesters').then((r) => setSemesters(r.data.data)).catch(() => {});
    if (isHead) api.get('/departments').then((r) => setDepts(r.data.data)).catch(() => {});
  }, [isHead]);

  const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
  useEffect(() => {
    if (tab === 'overview') api.get('/reports/overview').then((r) => setOverview(r.data.data)).catch(fail);
    if (tab === 'attendance') api.get('/attendance/department', { params }).then((r) => setAttendance(r.data.data)).catch(fail);
    if (tab === 'support') { setSupport(null); api.get('/ai/performance/department', { params }).then((r) => setSupport(r.data.data)).catch(fail); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filter.department, filter.semester]);

  return (
    <>
      <h1>Reports and Insights</h1>
      <Alert msg={msg} />
      <Tabs tabs={[['overview', 'University overview'], ['attendance', 'Attendance'], ['support', 'Student support']]} active={tab} onChange={setTab} />

      {tab !== 'overview' && (
        <div className="card filters">
          {isHead && (
            <div>
              <label>Department</label>
              <select value={filter.department} onChange={(e) => setFilter({ department: e.target.value, semester: '' })}>
                <option value="">All departments</option>
                {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label>Semester</label>
            <select value={filter.semester} onChange={(e) => setFilter({ ...filter, semester: e.target.value })}>
              <option value="">All semesters</option>
              {semesters.filter((s) => !filter.department || s.department?._id === filter.department).map((s) => <option key={s._id} value={s._id}>{s.name} ({s.academicYear})</option>)}
            </select>
          </div>
        </div>
      )}

      {tab === 'overview' && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Department</th><th>Students</th><th>Teachers</th><th>Courses</th><th>Attendance</th><th>Pass rate</th>{isHead && <th>Fees collected</th>}</tr>
            </thead>
            <tbody>
              {overview.map((r) => (
                <tr key={r.department._id}>
                  <td>{r.department.name} <Badge value={r.department.status} /></td>
                  <td>{r.students}</td><td>{r.teachers}</td><td>{r.courses}</td>
                  <td>{pct(r.attendancePercent)}</td><td>{pct(r.passRate)}</td>
                  {isHead && <td>{Number(r.feesCollected || 0).toLocaleString()}</td>}
                </tr>
              ))}
              {!overview.length && <tr><td colSpan={7} className="muted">No data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'attendance' && attendance && (
        <div className="card table-wrap">
          <p className="muted small">Minimum required attendance: {attendance.minPercent}%</p>
          <table>
            <thead><tr><th>Course</th><th>Semester</th><th>Teacher</th><th>Students</th><th>Average</th><th>Below limit</th></tr></thead>
            <tbody>
              {attendance.rows.map((r) => (
                <tr key={r.course._id}>
                  <td><Link to={`/courses/${r.course._id}`}>{r.course.code}</Link> {r.course.title} <span className="muted small">Sec {r.course.section}</span></td>
                  <td>{r.semester}</td><td>{r.teacher || '—'}</td><td>{r.students}</td>
                  <td>{pct(r.averagePercent)}</td>
                  <td>{r.belowLimit > 0 ? <Badge value="high" text={`${r.belowLimit} students`} /> : '—'}</td>
                </tr>
              ))}
              {!attendance.rows.length && <tr><td colSpan={6} className="muted">No courses found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'support' && support && (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Course</th><th>Semester</th><th>Teacher</th><th>Students</th><th>High concern</th><th>Medium concern</th></tr></thead>
            <tbody>
              {support.rows.map((r) => (
                <tr key={r.course._id}>
                  <td><Link to={`/courses/${r.course._id}`}>{r.course.code}</Link> {r.course.title}</td>
                  <td>{r.semester}</td><td>{r.teacher || '—'}</td><td>{r.students}</td>
                  <td>{r.high ? <Badge value="high" text={String(r.high)} /> : '—'}</td>
                  <td>{r.medium ? <Badge value="medium" text={String(r.medium)} /> : '—'}</td>
                </tr>
              ))}
              {!support.rows.length && <tr><td colSpan={6} className="muted">No enrolled students yet.</td></tr>}
            </tbody>
          </table>
          <p className="muted small">{support.disclaimer} Open a course and use its "Student support" tab to see the individual students.</p>
        </div>
      )}
    </>
  );
}
