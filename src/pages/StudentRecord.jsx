import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate, money } from '../components/ui.jsx';
import PersonPhoto from '../components/PersonPhoto.jsx';

const pct = (v) => (v == null ? '—' : `${v}%`);

// The complete academic history of one student, grouped by semester.
// Student: /my-record (own data). HOD / University Head: /students/:id/record (department rule enforced by the server).
export default function StudentRecord() {
  const { id } = useParams();
  const [msg, , fail] = useFlash();
  const [rec, setRec] = useState(null);

  useEffect(() => {
    api.get(id ? `/students/${id}/record` : '/students/me/record').then((r) => setRec(r.data.data)).catch(fail);
  }, [id, fail]);

  if (!rec) return <><h1>Academic record</h1><Alert msg={msg} /></>;
  const { profile, semesters, results, admissions, payments, promotion } = rec;

  return (
    <>
      <div className="row-between">
        <h1>{profile.user?.name} <span className="muted small">{profile.rollNumber}</span></h1>
        {id && <Link className="btn btn-ghost" to="/students">← Students</Link>}
      </div>
      <Alert msg={msg} />
      <div className="card">
        <div className="cols-2">
          <div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '.8rem' }}>
              <PersonPhoto userId={profile.user?._id} size={96} />
              <dl className="pr-facts" style={{ flex: 1, minWidth: 220 }}>
                <dt>Email</dt><dd>{profile.user?.email}</dd>
                {profile.user?.phone && <><dt>Phone</dt><dd>{profile.user.phone}</dd></>}
                {profile.dateOfBirth && <><dt>Date of birth</dt><dd>{fmtDate(profile.dateOfBirth)}</dd></>}
                {profile.admissionYear && <><dt>Admitted</dt><dd>{profile.admissionYear}</dd></>}
                {profile.guardianName && <><dt>Guardian</dt><dd>{profile.guardianName}{profile.guardianPhone ? ` · ${profile.guardianPhone}` : ''}</dd></>}
                {profile.address && <><dt>Address</dt><dd>{profile.address}</dd></>}
              </dl>
            </div>
            <div>Department: <strong>{profile.department?.name}</strong></div>
            <div>Current semester: <strong>{profile.semester?.name || 'Not placed yet'}</strong></div>
            <div>Section: {profile.section} · Status: <Badge value={profile.status} /></div>
          </div>
          <div>
            <div className="muted small">Promotion history</div>
            {promotion.history.length ? promotion.history.map((h) => <div key={h.semester}>{h.semester}: <Badge value={h.outcome} /></div>) : <span className="muted">No published results yet</span>}
            <div className="muted small mt">{promotion.note}</div>
          </div>
        </div>
      </div>

      {semesters.map((s) => (
        <div className="card" key={s.semester._id}>
          <h3>{s.semester.name} <span className="muted small">{s.semester.academicYear}</span></h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Course</th><th>Teacher</th><th>Attendance</th><th>Assignments</th><th>Quizzes</th></tr></thead>
              <tbody>
                {s.courses.map((c) => (
                  <tr key={c._id}>
                    <td>{c.code} — {c.title}<div className="muted small">Sec {c.section} · {c.creditHours} cr · {c.enrollmentStatus}</div></td>
                    <td>{c.teacher || '—'}</td>
                    <td>{pct(c.attendance.percent)}<div className="muted small">P {c.attendance.present} · A {c.attendance.absent} · L {c.attendance.leave}</div></td>
                    <td>{c.assignments.length ? c.assignments.map((a, i) => <div key={i} className="small">{a.title}: {a.marks ?? 'pending'}/{a.maxMarks}{a.late ? ' (late)' : ''}</div>) : '—'}</td>
                    <td>{c.quizzes.length ? c.quizzes.map((q, i) => <div key={i} className="small">{q.title}: {q.score}/{q.maxScore}</div>) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {!semesters.length && <div className="card muted">No course enrollments yet.</div>}

      <div className="card table-wrap">
        <h3>Examination results</h3>
        <table>
          <thead><tr><th>Examination</th><th>Semester</th><th>Percentage</th><th>Grade</th><th>Outcome</th><th>Published</th></tr></thead>
          <tbody>
            {results.map((r) => (
              <tr key={r._id}>
                <td>{r.examination?.name}</td>
                <td>{r.semester?.name}</td>
                <td>{pct(r.percentage)}</td>
                <td>{r.grade}</td>
                <td><Badge value={r.outcome} /></td>
                <td>{fmtDate(r.publishedAt)}</td>
              </tr>
            ))}
            {!results.length && <tr><td colSpan={6} className="muted">No published results.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="cols-2">
        <div className="card table-wrap">
          <h3>Examination admission history</h3>
          <table>
            <tbody>
              {admissions.map((a, i) => <tr key={i}><td>{a.examination}</td><td><Badge value={a.status} /></td><td className="muted small">{a.reason}</td></tr>)}
              {!admissions.length && <tr><td className="muted">No admission requests.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card table-wrap">
          <h3>Fee payment history</h3>
          <table>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id}>
                  <td>{fmtDate(p.paidAt)}<div className="muted small">{p.receiptNumber}</div></td>
                  <td>{p.items.join(', ')}</td>
                  <td className="right">{money(p.total, p.currency)} <Badge value={p.status} /></td>
                </tr>
              ))}
              {!payments.length && <tr><td className="muted">No payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
