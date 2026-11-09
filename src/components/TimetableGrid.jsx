import { colorFor } from './palette.js';
import { DAYS, todayName, slotState, byTime } from './WeeklyTimetable.jsx';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

// The classic timetable of a university: ONE ROW PER DAY (Monday, Tuesday, ...) and ONE COLUMN PER PERIOD (09:00-10:00 ...).
// Every box holds one class: subject code, subject name, room and the teacher (students) or semester (teachers / HOD).
// Today's row is highlighted and the class that is running right now is marked LIVE.
// who = 'student' (show the teacher) | 'teacher' (show the semester and section) | 'hod' (show teacher and section)
export default function TimetableGrid({ slots = [], who = 'student' }) {
  const today = todayName();
  const now = new Date();

  // every distinct "start-end" time becomes a column, in time order
  const periods = [...new Map(slots.map((s) => [`${s.startTime}-${s.endTime}`, { start: s.startTime, end: s.endTime }])).values()].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : 1));
  const days = DAYS.filter((d) => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(d) || slots.some((s) => s.day === d));

  const sub = (s) => {
    if (who === 'teacher') return [s.semester?.name, s.course?.section && `Sec ${s.course.section}`].filter(Boolean).join(' · ');
    if (who === 'hod') return [s.teacher?.name || '⚠️ No teacher assigned', s.course?.section && `Sec ${s.course.section}`].filter(Boolean).join(' · ');
    return s.teacher?.name || '⚠️ No teacher assigned yet'; // the teacher of this subject was removed: the class stays until a new one is chosen
  };

  if (!slots.length) return null;

  return (
    <div className="tg-wrap">
      <table className="tg">
        <thead>
          <tr>
            <th className="tg-corner">Day</th>
            {periods.map((p, i) => (
              <th key={`${p.start}-${p.end}`}>
                <span className="tg-no">{ORD[i] || `${i + 1}th`} period</span>
                <span className="tg-time">{p.start} – {p.end}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const count = slots.filter((s) => s.day === d).length;
            return (
              <tr key={d} className={d === today ? 'today' : ''}>
                <th className="tg-day">
                  <span>{cap(d)}</span>
                  <small>{d === today ? 'Today · ' : ''}{count} class{count === 1 ? '' : 'es'}</small>
                </th>
                {periods.map((p) => {
                  const here = slots.filter((s) => s.day === d && s.startTime === p.start && s.endTime === p.end).sort(byTime);
                  return (
                    <td key={`${p.start}-${p.end}`} className={here.length ? '' : 'tg-empty'}>
                      {here.map((s) => {
                        const st = d === today ? slotState(s, now) : '';
                        return (
                          <div key={s._id} className={`tg-box ${st}`} style={colorFor(s.course?.code || s.course?.title)}>
                            {st === 'live' && <span className="tg-live">LIVE</span>}
                            <b>{s.course?.code}</b>
                            <span className="tg-title">{s.course?.title}</span>
                            <small>🚪 {s.room || '—'}</small>
                            {sub(s) && <small>{who === 'student' && s.teacher ? '👤 ' : ''}{sub(s)}</small>}
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
