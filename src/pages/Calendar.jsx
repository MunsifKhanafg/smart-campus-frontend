import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate, toInputDate, label } from '../components/ui.jsx';
import './calendar.css';

const TYPES = ['semester_start', 'semester_end', 'midterm_exam', 'final_exam', 'summer_vacation', 'winter_vacation', 'holiday', 'event'];
const EMPTY = { title: '', type: 'event', startDate: '', endDate: '', description: '', department: '' };

// When two events cover the same day, the first type in this list decides the colour of that day.
const PRIORITY = ['final_exam', 'midterm_exam', 'summer_vacation', 'winter_vacation', 'holiday', 'semester_start', 'semester_end', 'event'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');
const ds = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`; // m = 1..12

// The academic year runs from September to August. 2026 means September 2026 to August 2027.
const currentStartYear = () => {
  const now = new Date();
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
};

// Two normal calendars. A HOT area has a long summer vacation, a COLD area has a long winter vacation.
// Every date can be changed before the events are created.
const CLIMATES = {
  hot: { icon: '☀️', title: 'Hot area', text: 'Long summer vacation (about 12 weeks) and a short winter break (2 weeks). Semesters: September to December, January to June.' },
  cold: { icon: '❄️', title: 'Cold area', text: 'Long winter vacation (about 10 weeks) and a short summer break (6 weeks). Semesters: September to mid-December, March to June.' },
};

const defaultPlan = (Y, climate = 'hot') => {
  const N = Y + 1;
  const hot = [
    { title: 'Fall semester starts', type: 'semester_start', startDate: ds(Y, 9, 1), endDate: ds(Y, 9, 1) },
    { title: 'Fall mid-term exams', type: 'midterm_exam', startDate: ds(Y, 10, 26), endDate: ds(Y, 11, 6) },
    { title: 'Fall final-term exams', type: 'final_exam', startDate: ds(Y, 12, 14), endDate: ds(Y, 12, 31) },
    { title: 'Fall semester ends', type: 'semester_end', startDate: ds(Y, 12, 31), endDate: ds(Y, 12, 31) },
    { title: 'Winter vacation', type: 'winter_vacation', startDate: ds(N, 1, 4), endDate: ds(N, 1, 17) },
    { title: 'Spring semester starts', type: 'semester_start', startDate: ds(N, 1, 19), endDate: ds(N, 1, 19) },
    { title: 'Spring mid-term exams', type: 'midterm_exam', startDate: ds(N, 3, 16), endDate: ds(N, 3, 27) },
    { title: 'Spring final-term exams', type: 'final_exam', startDate: ds(N, 5, 18), endDate: ds(N, 6, 5) },
    { title: 'Spring semester ends', type: 'semester_end', startDate: ds(N, 6, 5), endDate: ds(N, 6, 5) },
    { title: 'Summer vacation', type: 'summer_vacation', startDate: ds(N, 6, 8), endDate: ds(N, 8, 31) },
  ];
  const cold = [
    { title: 'Fall semester starts', type: 'semester_start', startDate: ds(Y, 9, 1), endDate: ds(Y, 9, 1) },
    { title: 'Fall mid-term exams', type: 'midterm_exam', startDate: ds(Y, 10, 12), endDate: ds(Y, 10, 23) },
    { title: 'Fall final-term exams', type: 'final_exam', startDate: ds(Y, 11, 30), endDate: ds(Y, 12, 11) },
    { title: 'Fall semester ends', type: 'semester_end', startDate: ds(Y, 12, 11), endDate: ds(Y, 12, 11) },
    { title: 'Winter vacation', type: 'winter_vacation', startDate: ds(Y, 12, 14), endDate: ds(N, 2, 26) },
    { title: 'Spring semester starts', type: 'semester_start', startDate: ds(N, 3, 1), endDate: ds(N, 3, 1) },
    { title: 'Spring mid-term exams', type: 'midterm_exam', startDate: ds(N, 4, 26), endDate: ds(N, 5, 7) },
    { title: 'Spring final-term exams', type: 'final_exam', startDate: ds(N, 6, 14), endDate: ds(N, 6, 25) },
    { title: 'Spring semester ends', type: 'semester_end', startDate: ds(N, 6, 25), endDate: ds(N, 6, 25) },
    { title: 'Summer vacation', type: 'summer_vacation', startDate: ds(N, 6, 28), endDate: ds(N, 8, 8) },
  ];
  return (climate === 'cold' ? cold : hot).map((r) => ({ ...r, on: true }));
};

// One small month. Days that belong to an event are coloured by the type of the event.
function Month({ year, month, events, today }) {
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push(d);

  const inMonth = events.filter((e) => e.s <= ds(year, month, days) && e.e >= ds(year, month, 1));
  return (
    <div className="cal-month">
      <h4>{MONTHS[month - 1]} {year}</h4>
      <div className="cal-dow">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => <span key={i}>{x}</span>)}</div>
      <div className="cal-days">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const key = ds(year, month, d);
          const hits = events.filter((e) => e.s <= key && e.e >= key);
          const top = PRIORITY.find((t) => hits.some((h) => h.type === t));
          return (
            <span key={i} className={`cal-d ${top ? `t-${top}` : ''} ${key === today ? 'today' : ''}`} title={hits.map((h) => h.title).join('\n')}>{d}</span>
          );
        })}
      </div>
      <ul className="cal-list">
        {inMonth.map((e) => (
          <li key={e._id}><i className={`dot t-${e.type}`} /> <b>{e.title}</b> <span className="muted">{fmtDate(e.s)}{e.e !== e.s ? ` – ${fmtDate(e.e)}` : ''}</span></li>
        ))}
      </ul>
    </div>
  );
}

// Everyone sees the events meant for them. The University Head manages university-wide events, an HOD their department's.
export default function Calendar() {
  const { user } = useSelector((s) => s.auth);
  const canEdit = ['university_head', 'hod'].includes(user.role);
  const isHead = user.role === 'university_head';
  const [msg, ok, fail] = useFlash();
  const [events, setEvents] = useState([]);
  const [depts, setDepts] = useState([]);
  const [form, setForm] = useState(null);
  const [view, setView] = useState('year'); // year | list
  const [year, setYear] = useState(currentStartYear());
  const [plan, setPlan] = useState(null); // { year, department, rows }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setEvents((await api.get('/calendar')).data.data); } catch (e) { fail(e); }
  }, [fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (isHead) api.get('/departments').then((r) => setDepts(r.data.data.filter((d) => d.status === 'active'))).catch(() => {});
  }, [isHead]);

  // Dates as plain YYYY-MM-DD text, so a day is never shifted by the time zone.
  const flat = useMemo(() => events.map((e) => ({ ...e, s: toInputDate(e.startDate), e: toInputDate(e.endDate) })), [events]);
  const today = new Date().toISOString().slice(0, 10);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const m = ((8 + i) % 12) + 1;
    return { m, y: year + (8 + i >= 12 ? 1 : 0) };
  }), [year]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form };
      if (!body.description) delete body.description;
      if (!isHead || !body.department) delete body.department;
      if (form._id) {
        const { _id, department, ...editable } = body;
        await api.put(`/calendar/${_id}`, editable);
      } else {
        await api.post('/calendar', body);
      }
      ok('Calendar saved');
      setForm(null);
      load();
    } catch (err) { fail(err); }
  };

  const remove = async (ev) => {
    if (!window.confirm(`Delete "${ev.title}"?`)) return;
    try { await api.delete(`/calendar/${ev._id}`); load(); } catch (err) { fail(err); }
  };

  // Creates every ticked row of the academic year plan. Events that already exist (same title and start date) are skipped.
  const createPlan = async () => {
    setBusy(true);
    let made = 0;
    let skipped = 0;
    try {
      for (const r of plan.rows.filter((x) => x.on)) {
        if (!r.title.trim() || !r.startDate || !r.endDate) continue;
        if (flat.some((e) => e.title === r.title && e.s === r.startDate)) { skipped += 1; continue; }
        const body = { title: r.title.trim(), type: r.type, startDate: r.startDate, endDate: r.endDate };
        if (isHead && plan.department) body.department = plan.department;
        await api.post('/calendar', body);
        made += 1;
      }
      ok(`${made} event(s) added to the calendar${skipped ? `, ${skipped} already existed` : ''}.`);
      setPlan(null);
      setYear(plan.year);
      load();
    } catch (err) { fail(err); load(); } finally { setBusy(false); }
  };

  const setRow = (i, patch) => setPlan((p) => ({ ...p, rows: p.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const editable = (ev) => isHead || (ev.department && ev.department._id === user.department?._id);
  const years = [currentStartYear() - 1, currentStartYear(), currentStartYear() + 1, currentStartYear() + 2];

  return (
    <>
      <div className="row-between">
        <div>
          <h1>Academic Calendar</h1>
          <p className="muted" style={{ margin: 0 }}>Semesters, mid-term and final-term exams, winter and summer vacations, holidays and events.</p>
        </div>
        {canEdit && (
          <div className="actions">
            <button className="btn btn-primary" style={{ marginTop: 0 }} onClick={() => setPlan({ year, department: '', climate: null, rows: [] })}>📅 Plan the academic year</button>
            <button className="btn" onClick={() => setForm(EMPTY)}>+ Add one event</button>
          </div>
        )}
      </div>
      <Alert msg={msg} />

      {plan && !plan.climate && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Which calendar do you want?</h3>
          <p className="muted small">Choose the kind of year that fits your area. The two calendars place the long vacation differently. You can change every date afterwards.</p>
          <div className="climate-grid">
            {Object.entries(CLIMATES).map(([key, c]) => (
              <button key={key} type="button" className="climate-card" onClick={() => setPlan({ ...plan, climate: key, rows: defaultPlan(plan.year, key) })}>
                <span className="ico">{c.icon}</span>
                <b>{c.title}</b>
                <span>{c.text}</span>
              </button>
            ))}
          </div>
          <div className="actions"><button className="btn btn-ghost" onClick={() => setPlan(null)}>Cancel</button></div>
        </div>
      )}

      {plan && plan.climate && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Plan the academic year: {CLIMATES[plan.climate].icon} {CLIMATES[plan.climate].title}</h3>
          <p className="muted small">
            This adds the whole year in one step: both semesters, the mid-term and final-term exams, and the winter and summer vacations.
            The dates are a normal starting point. Change any date, untick what you do not need, then press Create.
            {' '}<button type="button" className="linklike" onClick={() => setPlan({ ...plan, climate: null, rows: [] })}>Choose the other calendar</button>
          </p>
          <div className="form-grid">
            <div>
              <label>Academic year (September to August)</label>
              <select value={plan.year} onChange={(e) => setPlan({ ...plan, year: Number(e.target.value), rows: defaultPlan(Number(e.target.value), plan.climate) })}>
                {years.map((y) => <option key={y} value={y}>{y} – {y + 1}</option>)}
              </select>
            </div>
            {isHead && (
              <div>
                <label>Applies to</label>
                <select value={plan.department} onChange={(e) => setPlan({ ...plan, department: e.target.value })}>
                  <option value="">Whole university</option>
                  {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="plan-rows">
            {plan.rows.map((r, i) => (
              <div key={i} className={`plan-row ${r.on ? '' : 'off'}`}>
                <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={r.on} onChange={(e) => setRow(i, { on: e.target.checked })} /></label>
                <i className={`dot t-${r.type}`} />
                <input value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} aria-label="Event name" />
                <input type="date" value={r.startDate} onChange={(e) => setRow(i, { startDate: e.target.value, endDate: r.endDate < e.target.value ? e.target.value : r.endDate })} aria-label="From" />
                <input type="date" value={r.endDate} min={r.startDate} onChange={(e) => setRow(i, { endDate: e.target.value })} aria-label="To" />
              </div>
            ))}
          </div>
          <div className="actions">
            <button className="btn btn-primary" disabled={busy} onClick={createPlan}>{busy ? 'Creating...' : `Create ${plan.rows.filter((r) => r.on).length} events`}</button>
            <button className="btn btn-ghost" onClick={() => setPlan(null)}>Cancel</button>
          </div>
        </div>
      )}

      {form && (
        <form className="card" onSubmit={save}>
          <h3>{form._id ? 'Edit event' : 'New event'}</h3>
          <div className="form-grid">
            <div><label>Title</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
              </select>
            </div>
            <div><label>Start date</label><input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: form.endDate && form.endDate >= e.target.value ? form.endDate : e.target.value })} /></div>
            <div><label>End date</label><input required type="date" min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            {isHead && !form._id && (
              <div>
                <label>Applies to</label>
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  <option value="">Whole university</option>
                  {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <label>Description (optional)</label>
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="actions">
            <button className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="row-between" style={{ margin: '.4rem 0 .8rem' }}>
        <div className="actions">
          <button className={`btn btn-small ${view === 'year' ? 'btn-primary' : ''}`} style={{ marginTop: 0 }} onClick={() => setView('year')}>Year view</button>
          <button className={`btn btn-small ${view === 'list' ? 'btn-primary' : ''}`} style={{ marginTop: 0 }} onClick={() => setView('list')}>List</button>
        </div>
        {view === 'year' && (
          <select style={{ width: 'auto' }} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Academic year">
            {years.map((y) => <option key={y} value={y}>Academic year {y} – {y + 1}</option>)}
          </select>
        )}
      </div>

      {view === 'year' && (
        <>
          <div className="cal-legend">
            {['semester_start', 'midterm_exam', 'final_exam', 'winter_vacation', 'summer_vacation', 'holiday', 'event'].map((t) => (
              <span key={t}><i className={`dot t-${t}`} /> {t === 'semester_start' ? 'Semester start / end' : label(t)}</span>
            ))}
          </div>
          <div className="cal-year">
            {months.map(({ m, y }) => <Month key={`${y}-${m}`} year={y} month={m} events={flat} today={today} />)}
          </div>
          {!events.length && <div className="card empty-state"><div className="big">📅</div>No events yet.{canEdit && ' Press "Plan the academic year" to add both semesters, exams and vacations in one step.'}</div>}
        </>
      )}

      {view === 'list' && (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>From</th><th>To</th><th>Event</th><th>Type</th><th>For</th>{canEdit && <th />}</tr></thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev._id} style={fmtDate(ev.endDate) < today ? { opacity: 0.55 } : undefined}>
                  <td>{fmtDate(ev.startDate)}</td>
                  <td>{fmtDate(ev.endDate)}</td>
                  <td>{ev.title}{ev.description && <div className="muted small">{ev.description}</div>}</td>
                  <td><Badge value={ev.type} /></td>
                  <td>{ev.department ? ev.department.code : 'University'}{ev.semester ? ` · ${ev.semester.name}` : ''}</td>
                  {canEdit && (
                    <td className="actions">
                      {editable(ev) && (
                        <>
                          <button className="btn btn-small" onClick={() => setForm({ _id: ev._id, title: ev.title, type: ev.type, description: ev.description || '', startDate: toInputDate(ev.startDate), endDate: toInputDate(ev.endDate), department: '' })}>Edit</button>
                          <button className="btn btn-small btn-danger" onClick={() => remove(ev)}>Delete</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!events.length && <tr><td colSpan={6} className="muted">No events yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
