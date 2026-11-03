import { useEffect, useState } from 'react';
import api from '../api/axios.js';
import { useFlash, Alert } from '../components/ui.jsx';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Student or teacher: their own classes from the PUBLISHED timetable only.
export default function MyTimetable() {
  const [msg, , fail] = useFlash();
  const [slots, setSlots] = useState(null);

  useEffect(() => {
    api.get('/timetables/mine').then((r) => setSlots(r.data.data)).catch(fail);
  }, [fail]);

  return (
    <>
      <h1>My Timetable</h1>
      <Alert msg={msg} />
      {slots && !slots.length && <div className="card muted">No published timetable yet. You will be notified when your department publishes it.</div>}
      <div className="tt-grid">
        {DAYS.filter((d) => slots?.some((s) => s.day === d)).map((d) => (
          <div className="tt-day" key={d}>
            <h4>{d}</h4>
            {slots.filter((s) => s.day === d).map((s) => (
              <div className="tt-slot" key={s._id}>
                <strong>{s.startTime}–{s.endTime}</strong> · {s.course?.code}
                <div>{s.course?.title}</div>
                <div className="muted">Room {s.room}{s.teacher?.name ? ` · ${s.teacher.name}` : ''}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
