import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios.js';
import { Badge } from './ui.jsx';

const WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1, 3);

// Smart semester planner panel (teacher). Shows the teaching days of the class, how the numbered topics are spread over them
// (2 to 3 topics per class), and the "Regenerate Schedule" button for a teacher who is not happy with the plan.
//   refreshKey : change it to reload the summary after the topics changed elsewhere on the page
//   onChanged  : called after the plan changed, so the topic list reloads
export default function SchedulePlanner({ courseId, refreshKey = 0, onChanged, ok, fail }) {
  const [info, setInfo] = useState(null);
  const [days, setDays] = useState([]);
  const [busy, setBusy] = useState('');

  const load = useCallback(
    () =>
      api
        .get(`/teaching-calendar/course/${courseId}`)
        .then((r) => { setInfo(r.data.data); setDays(r.data.data.weekdays || []); })
        .catch(fail),
    [courseId, fail]
  );
  useEffect(() => { load(); }, [load, refreshKey]);

  if (!info) return null;
  const { plan } = info;
  const changed = days.slice().sort().join() !== (info.weekdays || []).slice().sort().join();
  const toggle = (d) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const run = async (name, fn) => {
    setBusy(name);
    try { await fn(); } catch (err) { fail(err); } finally { setBusy(''); await load(); onChanged?.(); }
  };

  const saveDays = () =>
    run('days', async () => {
      const r = await api.put(`/teaching-calendar/course/${courseId}/days`, { days });
      ok(r.data.message);
    });

  const regenerate = () =>
    run('regen', async () => {
      const r = await api.post(`/teaching-calendar/course/${courseId}/regenerate`);
      const d = r.data.data;
      ok(`${r.data.message}${d.overCapacity ? '. The semester is short, so some classes carry more than 3 topics to finish the course in time' : ''}`);
    });

  const sourceText = { teacher: 'your own choice', timetable: 'the timetable', default: 'every working day (no choice made yet)' }[info.source];

  return (
    <div className="card">
      <h3>Semester course planner</h3>
      <p className="muted small">
        Semester {info.semester.name}: {info.range.from} to {info.range.to}. Teaching days follow {sourceText}. Holidays, examinations and vacations never get a topic.
      </p>

      <label>Days you teach this class each week (usually 2 or 3)</label>
      <div className="inline-form">
        {WEEK.map((d) => (
          <label key={d} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginRight: 10 }}>
            <input type="checkbox" checked={days.includes(d)} onChange={() => toggle(d)} /> {cap(d)}
          </label>
        ))}
        <button type="button" className="btn btn-small" disabled={!changed || !!busy} onClick={saveDays}>
          {busy === 'days' ? 'Saving…' : 'Save teaching days'}
        </button>
      </div>

      <div className="mt">
        <div>
          <strong>{plan.total}</strong> topics · <strong>{plan.upcoming}</strong> still ahead · <strong>{info.teachingDaysLeft}</strong> teaching days left
          {plan.classDays > 0 && <> · <strong>{plan.classDays}</strong> classes planned ({plan.minPerClass} to {plan.maxPerClass} topics each)</>}
        </div>
        {plan.lastTopicDate && (
          <div className="muted small">
            Last topic: {plan.lastTopicDate} · <Badge value={plan.withinSemester ? 'approved' : 'rejected'} text={plan.withinSemester ? 'finishes inside the semester' : 'runs past the semester end'} />
          </div>
        )}
        {plan.overCapacity && (
          <p className="muted small">There are more topics than the days left can hold at 3 per class. Add teaching days above so every class stays at 2 to 3 topics.</p>
        )}
        {info.nextTeachingDays.length > 0 && <div className="muted small">Next teaching days: {info.nextTeachingDays.join(', ')}</div>}
        {info.skippedPeriods.length > 0 && (
          <div className="muted small">Skipped: {info.skippedPeriods.map((p) => `${p.reason} (${p.from}${p.to !== p.from ? ` to ${p.to}` : ''})`).join('; ')}</div>
        )}
      </div>

      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={!!busy || plan.upcoming === 0} onClick={regenerate}>
          {busy === 'regen' ? 'Regenerating…' : 'Regenerate Schedule'}
        </button>
        <span className="muted small">
          Not happy with the plan? This arranges every topic that is still ahead again. Taught topics and dates you typed yourself stay as they are.
          If you are absent or on leave, that day&apos;s topics move to your next teaching day automatically.
        </span>
      </div>
    </div>
  );
}
