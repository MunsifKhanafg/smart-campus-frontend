import { colorFor } from './palette.js';

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const todayName = () => DAYS[(new Date().getDay() + 6) % 7]; // JS: Sunday = 0

const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
};

// 'done' | 'live' | 'upcoming' for a class happening today.
export const slotState = (s, now = new Date()) => {
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins >= toMin(s.endTime)) return 'done';
  if (mins >= toMin(s.startTime)) return 'live';
  return 'upcoming';
};

export const byTime = (a, b) => toMin(a.startTime) - toMin(b.startTime);

// Weekly timetable: one coloured column per day, one coloured block per class. Today is highlighted.
// Every subject keeps its own colour everywhere (colour is chosen from the course code).
// who="teacher" shows semester and section, who="student" shows the teacher's name.
export default function WeeklyTimetable({ slots = [], who = 'student' }) {
  const today = todayName();
  const now = new Date();
  const days = DAYS.filter((d) => d !== 'sunday' || slots.some((s) => s.day === 'sunday'));

  return (
    <div className="wt-scroll">
    <div className="wt" style={{ '--days': days.length }}>
      {days.map((d) => {
        const list = slots.filter((s) => s.day === d).sort(byTime);
        const isToday = d === today;
        return (
          <div className={`wt-day ${isToday ? 'today' : ''}`} key={d}>
            <div className="wt-head">
              <span>{d}</span>
              {isToday ? <em>Today</em> : <small>{list.length || ''}</small>}
            </div>
            <div className="wt-body">
              {list.map((s) => {
                const state = isToday ? slotState(s, now) : '';
                return (
                  <div className={`wt-slot ${state}`} key={s._id} style={colorFor(s.course?.code || s.course?.title)}>
                    <div className="wt-time">
                      {s.startTime} – {s.endTime}
                      {state === 'live' && <span className="wt-live">LIVE</span>}
                    </div>
                    <div className="wt-code">{s.course?.code}</div>
                    <div className="wt-title">{s.course?.title}</div>
                    <div className="wt-meta">
                      <span>🚪 {s.room || '—'}</span>
                      {who === 'teacher' ? (
                        <span>{[s.semester?.name, s.course?.section && `Sec ${s.course.section}`].filter(Boolean).join(' · ')}</span>
                      ) : (
                        s.teacher?.name && <span>👤 {s.teacher.name}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {!list.length && <div className="wt-empty">No classes</div>}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
