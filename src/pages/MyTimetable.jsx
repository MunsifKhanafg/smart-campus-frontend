import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert } from '../components/ui.jsx';
import WeeklyTimetable, { todayName } from '../components/WeeklyTimetable.jsx';
import TimetableGrid from '../components/TimetableGrid.jsx';

// Student or teacher: their own classes from the PUBLISHED timetable only.
export default function MyTimetable() {
  const { user } = useSelector((s) => s.auth);
  const [msg, , fail] = useFlash();
  const [slots, setSlots] = useState(null);

  useEffect(() => {
    api.get('/timetables/mine').then((r) => setSlots(r.data.data)).catch(fail);
  }, [fail]);

  const today = todayName();
  const todayCount = slots ? slots.filter((s) => s.day === today).length : 0;
  const subjects = slots ? new Set(slots.map((s) => s.course?._id)).size : 0;

  return (
    <>
      <div className="row-between">
        <h1>My Timetable</h1>
        {slots?.length > 0 && (
          <div className="tt-summary">
            <span><b>{slots.length}</b> classes / week</span>
            <span><b>{subjects}</b> subjects</span>
            <span><b>{todayCount}</b> today</span>
          </div>
        )}
      </div>
      <Alert msg={msg} />
      {slots && !slots.length && (
        <div className="empty-state"><div className="big">🗓️</div>No published timetable yet. You will be notified when your department publishes it.</div>
      )}
      {slots?.length > 0 && <TimetableGrid slots={slots} who={user.role === 'teacher' ? 'teacher' : 'student'} />}
    </>
  );
}
