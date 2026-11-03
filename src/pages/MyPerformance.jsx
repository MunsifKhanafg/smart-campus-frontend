import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { useFlash, Alert, Badge } from '../components/ui.jsx';

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
const LEVEL_TEXT = { low: 'On track', medium: 'Needs attention', high: 'Needs support' };

// Student: an early-warning summary of every course of the current semester, plus an optional AI study plan.
// It is advice only. It never changes marks, grades, admission or promotion.
export default function MyPerformance() {
  const [msg, , fail] = useFlash();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = (plan) => {
    setBusy(true);
    api.get('/ai/performance/me', { params: plan ? { plan: 'true' } : {} })
      .then((r) => setData(r.data.data))
      .catch(fail)
      .finally(() => setBusy(false));
  };
  useEffect(() => { load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <>
      <div className="row-between">
        <h1>My Academic Support</h1>
        {data && <Badge value={data.overall} text={LEVEL_TEXT[data.overall]} />}
      </div>
      <Alert msg={msg} />

      {data && (
        <>
          {!data.rows.length && <div className="card muted">You are not enrolled in a course of the current semester yet.</div>}
          {data.rows.map((r) => (
            <div className="card" key={r.course._id}>
              <div className="row-between">
                <h3 style={{ margin: 0 }}><Link to={`/my-courses/${r.course._id}`}>{r.course.code}</Link> {r.course.title}</h3>
                <Badge value={r.level} text={LEVEL_TEXT[r.level]} />
              </div>
              <div className="grid mt">
                <div className="stat"><span>{pct(r.metrics.attendance)}</span>Attendance</div>
                <div className="stat"><span>{pct(r.metrics.assignmentAvg)}</span>Assignments</div>
                <div className="stat"><span>{pct(r.metrics.quizAvg)}</span>Quizzes</div>
                <div className="stat"><span>{pct(r.metrics.examPercent)}</span>Last exam</div>
              </div>
              {r.flags.length > 0 && <ul>{r.flags.map((f) => <li key={f.code}>{f.message}</li>)}</ul>}
              {r.revise?.length > 0 && <p className="small"><strong>Suggested topics to revise:</strong> {r.revise.join(', ')}</p>}
            </div>
          ))}

          {data.studyPlan && (
            <div className="card">
              <h3>Study plan</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{data.studyPlan}</p>
            </div>
          )}
          {data.rows.some((r) => r.level !== 'low') && !data.studyPlan && (
            <button className="btn btn-primary" disabled={busy} onClick={() => load(true)}>{busy ? 'Preparing…' : 'Suggest a study plan'}</button>
          )}
          <p className="muted small mt">{data.disclaimer}</p>
        </>
      )}
    </>
  );
}
