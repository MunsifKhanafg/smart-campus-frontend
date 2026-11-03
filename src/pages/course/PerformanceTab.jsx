import { useEffect, useState } from 'react';
import api from '../../api/axios.js';
import { useFlash, Alert, Badge } from '../../components/ui.jsx';

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

// Early-warning view for staff. Recommendations only: it never changes marks, grades, admission or promotion.
export default function PerformanceTab({ courseId }) {
  const [msg, , fail] = useFlash();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/ai/performance/course/${courseId}`).then((r) => setData(r.data.data)).catch(fail);
  }, [courseId, fail]);

  return (
    <>
      <Alert msg={msg} />
      {data && (
        <div className="card table-wrap">
          <h3>Students who may need support</h3>
          <table>
            <thead><tr><th>Roll</th><th>Student</th><th>Attendance</th><th>Assignments</th><th>Missing</th><th>Quizzes</th><th>Exam</th><th>Level</th><th>Why</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.student}>
                  <td>{r.rollNumber}</td><td>{r.name}</td>
                  <td>{pct(r.metrics.attendance)}</td><td>{pct(r.metrics.assignmentAvg)}</td><td>{r.metrics.missingAssignments}</td>
                  <td>{pct(r.metrics.quizAvg)}</td><td>{pct(r.metrics.examPercent)}</td>
                  <td><Badge value={r.level} /></td>
                  <td className="small">{r.flags.map((f) => f.message).join('; ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">{data.disclaimer}</p>
        </div>
      )}
    </>
  );
}
