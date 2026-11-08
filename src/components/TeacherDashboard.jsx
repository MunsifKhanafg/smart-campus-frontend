import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { colorFor, colorAt } from './palette.js';
import WeeklyTimetable, { todayName, slotState, byTime } from './WeeklyTimetable.jsx';
import TimetableGrid from './TimetableGrid.jsx';

const STATE_LABEL = { live: 'In progress', upcoming: 'Upcoming', done: 'Finished' };

// Teacher home: today's classes as timeline cards, the weekly timetable, and subjects grouped by semester.
export default function TeacherDashboard() {
  const [courses, setCourses] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/courses'), api.get('/timetables/mine')])
      .then(([c, t]) => {
        setCourses(c.data.data.filter((x) => x.status !== 'archived'));
        setSlots(t.data.data);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return <p className="muted">Loading your classes…</p>;

  const today = todayName();
  const now = new Date();
  const todays = slots.filter((s) => s.day === today).sort(byTime);
  const next = todays.find((s) => slotState(s, now) !== 'done');
  const semesterIds = new Set(courses.map((c) => c.semester?._id).filter(Boolean));

  const bySemester = new Map();
  for (const c of courses) {
    const key = c.semester?._id || 'none';
    if (!bySemester.has(key)) bySemester.set(key, { semester: c.semester, list: [] });
    bySemester.get(key).list.push({ ...c, slots: slots.filter((s) => String(s.course?._id) === String(c._id)).sort(byTime) });
  }

  return (
    <>
      <div className="tiles">
        <div className="tile"><div className="ico">📘</div><div><b>{courses.length}</b><span>My subjects</span></div></div>
        <div className="tile teal"><div className="ico">📚</div><div><b>{semesterIds.size}</b><span>Semesters</span></div></div>
        <div className="tile amber"><div className="ico">🕘</div><div><b>{slots.length}</b><span>Classes per week</span></div></div>
        <div className="tile rose"><div className="ico">📅</div><div><b>{todays.length}</b><span>Classes today</span></div></div>
      </div>

      <section className="td-section">
        <div className="td-head">
          <h3>Today · <span style={{ textTransform: 'capitalize' }}>{today}</span></h3>
          {next && <span className="td-next">Next: <b>{next.startTime}</b> {next.course?.code} · Room {next.room}</span>}
        </div>
        {todays.length ? (
          <div className="td-today">
            {todays.map((s) => {
              const st = slotState(s, now);
              return (
                <div className={`td-class ${st}`} key={s._id} style={colorFor(s.course?.code || s.course?.title)}>
                  <div className="td-time"><b>{s.startTime}</b><span>to</span><b>{s.endTime}</b></div>
                  <div className="td-info">
                    <div className="td-code">{s.course?.code}<span className={`td-state ${st}`}>{STATE_LABEL[st]}</span></div>
                    <h4>{s.course?.title}</h4>
                    <div className="td-chips">
                      <span>🚪 Room {s.room || '—'}</span>
                      {s.semester?.name && <span>📚 {s.semester.name}</span>}
                      {s.course?.section && <span>Section {s.course.section}</span>}
                    </div>
                  </div>
                  {s.course?._id && <Link className="td-open" to={`/courses/${s.course._id}`}>Open →</Link>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state"><div className="big">☕</div>No classes today. Enjoy the free time!</div>
        )}
      </section>

      <section className="td-section">
        <div className="td-head"><h3>My weekly timetable</h3></div>
        {slots.length ? <TimetableGrid slots={slots} who="teacher" /> : (
          <div className="empty-state">Your timetable will appear here after your HOD publishes it.</div>
        )}
      </section>

      <section className="td-section">
        <div className="td-head"><h3>My subjects</h3></div>
        {[...bySemester.values()].map(({ semester, list }, gi) => (
          <div className="td-sem" key={semester?._id || 'none'}>
            <div className="td-sem-title" style={colorAt(gi)}>
              <span>{semester ? semester.name : 'No semester'}</span>
              {semester?.academicYear && <small>{semester.academicYear}</small>}
              {semester?.status && <em>{semester.status}</em>}
            </div>
            <div className="td-subjects">
              {list.map((c) => (
                <div className="td-subj" key={c._id} style={colorFor(c.code || c.title)}>
                  <div className="td-subj-head">
                    <div>
                      <div className="td-subj-code">{c.code}</div>
                      <h4>{c.title}</h4>
                    </div>
                    <span className="td-credit">{c.creditHours} cr</span>
                  </div>
                  <div className="td-subj-body">
                    <div className="td-chips dark">
                      {c.section && <span>Section {c.section}</span>}
                      <span>{c.slots.length} class{c.slots.length === 1 ? '' : 'es'}/week</span>
                    </div>
                    <div className="td-sched">
                      {c.slots.length ? c.slots.map((s) => (
                        <div key={s._id}><b style={{ textTransform: 'capitalize' }}>{s.day.slice(0, 3)}</b> {s.startTime}–{s.endTime} <span>· Room {s.room}</span></div>
                      )) : <span className="muted small">Not scheduled yet</span>}
                    </div>
                    <details className="td-contents">
                      <summary>Course contents</summary>
                      <p>{c.outline ? c.outline : 'No course contents were added to the curriculum for this subject.'}</p>
                    </details>
                    <Link className="td-btn" to={`/courses/${c._id}`}>Open subject</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!courses.length && <div className="empty-state"><div className="big">📘</div>No subject has been assigned to you yet. Your HOD assigns subjects to teachers.</div>}
      </section>
    </>
  );
}
