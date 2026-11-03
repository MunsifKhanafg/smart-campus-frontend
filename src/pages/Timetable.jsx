import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios.js';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { useFlash, Alert, Badge } from '../components/ui.jsx';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const EMPTY = { course: '', room: '', day: 'monday', startTime: '09:00', endTime: '10:30' };

// HOD builds the timetable of one semester. The server blocks teacher and room clashes.
export default function Timetable() {
  const [msg, ok, fail] = useFlash();
  const confirm = useConfirm();
  const [semesters, setSemesters] = useState([]);
  const [semester, setSemester] = useState('');
  const [courses, setCourses] = useState([]);
  const [data, setData] = useState({ timetable: null, slots: [] });
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    api.get('/semesters').then((r) => {
      const open = r.data.data.filter((s) => !['completed', 'archived'].includes(s.status));
      setSemesters(open);
      if (open[0]) setSemester(open[0]._id);
    }).catch(fail);
  }, [fail]);

  const load = useCallback(async () => {
    if (!semester) return;
    try {
      setData((await api.get(`/timetables/semester/${semester}`)).data.data);
      setCourses((await api.get('/courses', { params: { semester } })).data.data.filter((c) => c.status === 'active' && c.teacher));
    } catch (e) { fail(e); }
  }, [semester, fail]);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    try { await api.post('/timetables/slots', form); ok('Class added'); setForm({ ...EMPTY, day: form.day }); load(); } catch (err) { fail(err); }
  };
  const remove = async (s) => {
    const yes = await confirm({
      tone: 'danger',
      title: 'Remove this class?',
      message: 'Affected students and the teacher will be notified.',
      confirmText: 'Remove class',
    });
    if (!yes) return;
    try { await api.delete(`/timetables/slots/${s._id}`); load(); } catch (err) { fail(err); }
  };
  const publish = async (pub) => {
    try { await api.post(`/timetables/semester/${semester}/${pub ? 'publish' : 'unpublish'}`); ok(pub ? 'Timetable published' : 'Moved back to draft'); load(); } catch (err) { fail(err); }
  };

  const published = data.timetable?.status === 'published';
  return (
    <>
      <div className="row-between">
        <h1>Timetable</h1>
        <div className="actions">
          {data.timetable && <Badge value={data.timetable.status || 'draft'} />}
          {published
            ? <button className="btn" onClick={() => publish(false)}>Unpublish</button>
            : <button className="btn btn-primary inline" onClick={() => publish(true)}>Publish</button>}
        </div>
      </div>
      <Alert msg={msg} />
      <div className="card">
        <label>Semester</label>
        <select value={semester} onChange={(e) => setSemester(e.target.value)}>
          {semesters.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.academicYear})</option>)}
        </select>
        <p className="muted small">Students only see the timetable after you publish it. Courses need an assigned teacher to be scheduled.</p>
      </div>

      <form className="card" onSubmit={add}>
        <h3>Add a class</h3>
        <div className="form-grid">
          <div><label>Course</label>
            <select required value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
              <option value="">Select...</option>
              {courses.map((c) => <option key={c._id} value={c._id}>{c.code} (Sec {c.section}) - {c.teacher.name}</option>)}
            </select>
          </div>
          <div><label>Room</label><input required value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
          <div><label>Day</label><select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select></div>
          <div><label>Start</label><input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
          <div><label>End</label><input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
        </div>
        <button className="btn btn-primary">Add class</button>
      </form>

      <div className="tt-grid">
        {DAYS.map((d) => {
          const slots = data.slots.filter((s) => s.day === d);
          if (!slots.length) return null;
          return (
            <div key={d} className="tt-day">
              <h4>{d}</h4>
              {slots.map((s) => (
                <div key={s._id} className="tt-slot">
                  <strong>{s.startTime}-{s.endTime}</strong> {s.course?.code}
                  <div className="muted">{s.teacher?.name} · Room {s.room}</div>
                  <button className="link-btn small" onClick={() => remove(s)}>Remove</button>
                </div>
              ))}
            </div>
          );
        })}
        {!data.slots.length && <p className="muted">No classes yet.</p>}
      </div>
    </>
  );
}
