import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge } from '../components/ui.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { colorFor } from '../components/palette.js';
import WeeklyTimetable, { DAYS } from '../components/WeeklyTimetable.jsx';

const MIN_PER_CREDIT = 60; // 1 credit hour = 1 hour of class per week (same rule as the server)
const EMPTY = { course: '', room: '', day: 'monday', startTime: '09:00', endTime: '10:00' };

const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const hm = (min) => `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// HOD: build the timetable of one semester.
//  - every class shows the course NAME and its credit hours
//  - a course cannot get more weekly class time than its credit hours (the server checks this too)
//  - a teacher can never be in two places at once, in any semester; a room can never be double booked
export default function Timetable() {
  const settings = useSelector((s) => s.settings);
  const confirm = useConfirm();
  const [msg, ok, fail, clear] = useFlash();
  const [semesters, setSemesters] = useState([]);
  const [semester, setSemester] = useState('');
  const [courses, setCourses] = useState([]);
  const [data, setData] = useState({ timetable: null, slots: [] });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null); // slot being edited

  useEffect(() => {
    api.get('/semesters').then((r) => {
      const open = r.data.data.filter((s) => !['completed', 'archived'].includes(s.status)).sort((a, b) => a.number - b.number);
      setSemesters(open);
      if (open[0]) setSemester(open[0]._id);
    }).catch(fail);
  }, [fail]);

  const load = useCallback(async () => {
    if (!semester) return;
    try {
      const [t, c] = await Promise.all([api.get(`/timetables/semester/${semester}`), api.get('/courses', { params: { semester } })]);
      setData(t.data.data);
      setCourses(c.data.data.filter((x) => x.status === 'active'));
    } catch (e) { fail(e); }
  }, [semester, fail]);
  useEffect(() => { load(); }, [load]);

  // minutes already scheduled for each course
  const used = useMemo(() => {
    const m = {};
    data.slots.forEach((s) => { const k = s.course?._id; m[k] = (m[k] || 0) + (toMin(s.endTime) - toMin(s.startTime)); });
    return m;
  }, [data.slots]);

  const info = (c) => {
    const limit = (c.creditHours || 0) * MIN_PER_CREDIT;
    const u = used[c._id] || 0;
    return { limit, used: u, left: Math.max(limit - u, 0), full: u >= limit };
  };

  const chosen = courses.find((c) => c._id === form.course);
  const chosenInfo = chosen ? info(chosen) : null;
  const duration = toMin(form.endTime) - toMin(form.startTime);

  const add = async (e) => {
    e.preventDefault();
    clear();
    if (chosenInfo?.full) return fail(`Credit hours complete: ${chosen.code} already has all ${chosen.creditHours} credit hour(s) on the timetable.`);
    try {
      await api.post('/timetables/slots', form);
      ok('Class added to the timetable');
      setForm({ ...EMPTY, day: form.day, room: form.room });
      load();
    } catch (err) { fail(err); }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    clear();
    try {
      await api.put(`/timetables/slots/${editing._id}`, { room: editing.room, day: editing.day, startTime: editing.startTime, endTime: editing.endTime });
      ok('Class updated');
      setEditing(null);
      load();
    } catch (err) { fail(err); }
  };

  const remove = async (s) => {
    const yes = await confirm({
      tone: 'danger',
      title: `Remove ${s.course?.code} on ${cap(s.day)}?`,
      message: 'If the timetable is published, the students and the teacher are notified.',
      confirmText: 'Remove class',
    });
    if (!yes) return;
    try { await api.delete(`/timetables/slots/${s._id}`); ok('Class removed'); load(); } catch (err) { fail(err); }
  };

  const publish = async (pub) => {
    try {
      await api.post(`/timetables/semester/${semester}/${pub ? 'publish' : 'unpublish'}`);
      ok(pub ? 'Timetable published. Students and teachers can see it now' : 'Moved back to draft. Students no longer see it');
      load();
    } catch (err) { fail(err); }
  };

  const published = data.timetable?.status === 'published';
  const sem = semesters.find((s) => s._id === semester);
  const sorted = [...data.slots].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || toMin(a.startTime) - toMin(b.startTime));
  const incomplete = courses.filter((c) => !info(c).full);

  return (
    <>
      <div className="row-between no-print">
        <h1>Timetable</h1>
        <div className="actions">
          {data.timetable && <Badge value={data.timetable.status || 'draft'} />}
          <button className="btn" onClick={() => window.print()} disabled={!data.slots.length}>🖨️ Print timetable</button>
          {published
            ? <button className="btn" onClick={() => publish(false)}>Unpublish</button>
            : <button className="btn btn-primary inline" onClick={() => publish(true)}>Publish</button>}
        </div>
      </div>
      <div className="no-print"><Alert msg={msg} /></div>

      <div className="card no-print">
        <label>Semester</label>
        <select value={semester} onChange={(e) => { setSemester(e.target.value); setEditing(null); }}>
          {semesters.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.academicYear})</option>)}
        </select>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Students and teachers only see the timetable after you publish it. Each course can be scheduled for as many hours per week as its credit hours (1 credit hour = 1 hour).
        </p>
      </div>

      {/* ---- courses and their credit hours ---- */}
      <div className="card no-print">
        <h3 style={{ marginTop: 0 }}>Courses of this semester</h3>
        <div className="tt-courses">
          {courses.map((c) => {
            const i = info(c);
            return (
              <div className={`tt-course ${i.full ? 'full' : ''}`} key={c._id} style={colorFor(c.code || c.title)}>
                <div className="tt-course-top">
                  <b>{c.code}</b>
                  <span>{c.creditHours} credit hr{c.creditHours === 1 ? '' : 's'}</span>
                </div>
                <div className="tt-course-title">{c.title}</div>
                <div className="tt-course-teacher">{c.teacher ? `👤 ${c.teacher.name}` : '⚠️ No teacher assigned'}</div>
                <div className="tt-bar"><i style={{ width: `${Math.min(100, (i.used / i.limit) * 100)}%` }} /></div>
                <div className="tt-course-foot">
                  {i.full ? <b>✓ Credit hours complete</b> : <span>{hm(i.used)} of {hm(i.limit)} scheduled · {hm(i.left)} left</span>}
                </div>
              </div>
            );
          })}
          {!courses.length && <p className="muted">No active courses in this semester yet.</p>}
        </div>
      </div>

      {/* ---- add a class ---- */}
      <form className="card no-print" onSubmit={add}>
          <h3 style={{ marginTop: 0 }}>Add a class</h3>
          <div className="form-grid">
            <div>
              <label>Course</label>
              <select required value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                <option value="">Select a course...</option>
                {courses.map((c) => {
                  const i = info(c);
                  return (
                    <option key={c._id} value={c._id} disabled={i.full || !c.teacher}>
                      {c.code} - {c.title} ({c.creditHours} CH{i.full ? ' · COMPLETE' : ` · ${hm(i.left)} left`}{!c.teacher ? ' · no teacher' : ''})
                    </option>
                  );
                })}
              </select>
            </div>
            <div><label>Room</label><input required placeholder="e.g. R-101" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
            <div>
              <label>Day</label>
              <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                {DAYS.map((d) => <option key={d} value={d}>{cap(d)}</option>)}
              </select>
            </div>
            <div><label>Start</label><input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><label>End</label><input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
          </div>

          {chosen && (
            <div className={`tt-hint ${chosenInfo.full ? 'bad' : duration > chosenInfo.left ? 'warn' : ''}`}>
              {chosenInfo.full
                ? `Credit hours complete: ${chosen.title} already has all ${chosen.creditHours} credit hour(s) scheduled.`
                : duration > chosenInfo.left
                ? `This class is ${hm(Math.max(duration, 0))} long but only ${hm(chosenInfo.left)} is left for ${chosen.title}. Shorten it.`
                : `${chosen.title} · ${chosen.teacher?.name} · ${hm(chosenInfo.left)} of weekly time left (this class uses ${hm(Math.max(duration, 0))}).`}
            </div>
          )}
          <button className="btn btn-primary" disabled={!!chosenInfo?.full}>Add class</button>
          {!incomplete.length && courses.length > 0 && <span className="muted small" style={{ marginLeft: '.75rem' }}>🎉 Every course has all its credit hours scheduled.</span>}
        </form>

      {/* ---- the timetable ---- */}
      <div className="no-print">
        <h3>Weekly view</h3>
        {data.slots.length ? <WeeklyTimetable slots={data.slots} who="student" /> : <div className="empty-state">No classes yet. Add the first class above.</div>}
      </div>

      {data.slots.length > 0 && (
        <div className="card table-wrap no-print">
          <h3 style={{ marginTop: 0 }}>All classes</h3>
          <table>
            <thead><tr><th>Day</th><th>Time</th><th>Course</th><th>Credit hrs</th><th>Teacher</th><th>Room</th><th /></tr></thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s._id}>
                  {editing?._id === s._id ? (
                    <>
                      <td><select value={editing.day} onChange={(e) => setEditing({ ...editing, day: e.target.value })}>{DAYS.map((d) => <option key={d} value={d}>{cap(d)}</option>)}</select></td>
                      <td>
                        <input type="time" style={{ width: 110 }} value={editing.startTime} onChange={(e) => setEditing({ ...editing, startTime: e.target.value })} />
                        {' - '}
                        <input type="time" style={{ width: 110 }} value={editing.endTime} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} />
                      </td>
                      <td colSpan={3}>{s.course?.code} - {s.course?.title}</td>
                      <td><input style={{ width: 90 }} value={editing.room} onChange={(e) => setEditing({ ...editing, room: e.target.value })} /></td>
                      <td className="actions">
                        <button className="btn btn-small btn-primary" onClick={saveEdit}>Save</button>
                        <button className="btn btn-small" onClick={() => setEditing(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{cap(s.day)}</td>
                      <td><b>{s.startTime} - {s.endTime}</b><div className="muted small">{hm(toMin(s.endTime) - toMin(s.startTime))}</div></td>
                      <td><b>{s.course?.code}</b> {s.course?.title}<div className="muted small">Section {s.course?.section}</div></td>
                      <td>{s.course?.creditHours}</td>
                      <td>{s.teacher?.name}</td>
                      <td>{s.room}</td>
                      <td className="actions">
                        <button className="btn btn-small" onClick={() => setEditing({ _id: s._id, room: s.room, day: s.day, startTime: s.startTime, endTime: s.endTime })}>Edit</button>
                        <button className="btn btn-small btn-danger" onClick={() => remove(s)}>Remove</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- print sheet: hidden on screen, the only thing that prints ---- */}
      <div className="print-sheet">
        <div className="ps-head">
          <h1>{settings.universityName}</h1>
          {settings.campusName && <div>{settings.campusName}</div>}
          <h2>Class Timetable · {sem?.name} ({sem?.academicYear})</h2>
          <div className="ps-sub">Status: {data.timetable?.status || 'draft'} · Printed {new Date().toLocaleDateString()}</div>
        </div>
        <table className="ps-table">
          <thead><tr><th>Day</th><th>Time</th><th>Course</th><th>Credit hrs</th><th>Teacher</th><th>Room</th></tr></thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s._id} className={i > 0 && sorted[i - 1].day !== s.day ? 'new-day' : ''}>
                <td>{i === 0 || sorted[i - 1].day !== s.day ? cap(s.day) : ''}</td>
                <td>{s.startTime} - {s.endTime}</td>
                <td>{s.course?.code} - {s.course?.title}</td>
                <td>{s.course?.creditHours}</td>
                <td>{s.teacher?.name}</td>
                <td>{s.room}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ps-foot">
          <div>Head of Department: ____________________</div>
          <div>Signature / Stamp: ____________________</div>
        </div>
      </div>
    </>
  );
}
