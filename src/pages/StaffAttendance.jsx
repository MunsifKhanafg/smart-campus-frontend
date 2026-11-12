import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import Avatar from '../components/Avatar.jsx';
import { useFlash, Alert, Badge, Tabs, label, fmtDate } from '../components/ui.jsx';

// Teachers' and HODs' OWN attendance (not the attendance of students).
//   teacher : check in / out with proof of presence, month record, leave requests
//   HOD     : the same, plus the staff of the department: who is here today, corrections, leave decisions, month summary
//   head    : the whole university, plus the college's attendance rules (start time, late, absent, campus point)

const thisMonth = () => new Date().toISOString().slice(0, 7);
const todayKey = () => new Date().toISOString().slice(0, 10);
const timeOf = (iso, tz) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: tz || undefined, hour: '2-digit', minute: '2-digit' }) : '—');

// Asks the browser for the phone's location. Never blocks the check-in: without a location the server decides what to do.
const getPosition = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });

const addMinutes = (hhmm, plus) => {
  const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) + Number(plus || 0);
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const STATE_TEXT = {
  not_open: 'Check-in has not opened yet',
  on_time: 'Check-in is open',
  late: 'Check-in is open, but you will be marked late',
  closed: 'Check-in is closed',
  holiday: 'Today is not a working day',
  done: 'You have checked in',
  absent: 'You are marked absent today',
};

export default function StaffAttendance() {
  const { user } = useSelector((s) => s.auth);
  const isHead = user.role === 'university_head';
  const isHod = user.role === 'hod';
  const isStaff = !isHead; // teachers and HODs mark their own day
  const reviewer = isHead || isHod;
  const [msg, ok, fail] = useFlash();
  const [tab, setTab] = useState(isHead ? 'team' : 'day');

  const tabs = [
    ...(isStaff ? [['day', 'My day'], ['leave', 'My leave']] : []),
    ...(reviewer ? [['team', 'Staff today'], ['requests', 'Leave requests'], ['month', 'Month summary']] : []),
    ...(isHead ? [['rules', 'Attendance rules']] : []),
  ];

  return (
    <>
      <h1>Staff Attendance</h1>
      <p className="muted">
        {isHead ? 'Teachers, HODs and the finance officer check in when the college starts. Late, absent and leave are recorded automatically.' : 'Check in when you reach the college. Late, absent and leave are recorded automatically.'}
      </p>
      <Alert msg={msg} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'day' && <MyDay ok={ok} fail={fail} />}
      {tab === 'leave' && <MyLeave ok={ok} fail={fail} />}
      {tab === 'team' && <Team ok={ok} fail={fail} isHead={isHead} />}
      {tab === 'requests' && <Requests ok={ok} fail={fail} />}
      {tab === 'month' && <MonthSummary fail={fail} />}
      {tab === 'rules' && isHead && <Rules ok={ok} fail={fail} />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function MyDay({ ok, fail }) {
  const [today, setToday] = useState(null);
  const [month, setMonth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const [t, m] = await Promise.all([api.get('/staff-attendance/today'), api.get('/staff-attendance/mine', { params: { month: thisMonth() } })]);
      setToday(t.data.data);
      setMonth(m.data.data);
    } catch (e) { fail(e); }
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  const checkIn = async () => {
    setBusy(true);
    try {
      const pos = await getPosition();
      const body = { ...(pos || {}) };
      if (note.trim()) body.note = note.trim();
      const { data } = await api.post('/staff-attendance/check-in', body);
      ok(data.message);
      setNote('');
      load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const checkOut = async () => {
    setBusy(true);
    try { const { data } = await api.post('/staff-attendance/check-out'); ok(data.message); load(); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  if (!today) return <div className="card muted">Loading...</div>;
  const r = today.record;
  const tz = today.rules.timezone;
  const canIn = !r && ['on_time', 'late'].includes(today.state);
  const needsPlace = today.rules.requireOnCampus && today.rules.campus.lat != null;

  return (
    <>
      <div className="card">
        <div className="row-between">
          <div>
            <h3 style={{ marginBottom: 4 }}>{today.date}</h3>
            <div className="muted">{STATE_TEXT[today.state] || ''}{today.state === 'holiday' && today.holidayReason ? `: ${today.holidayReason}` : ''}</div>
            <div className="muted small">College starts {today.rules.opensAt} · on time until {addMinutes(today.rules.opensAt, today.rules.graceMinutes)} · absent after {today.rules.absentAfter}</div>
          </div>
          {r && <Badge value={r.status} />}
        </div>

        {r && (
          <p style={{ marginTop: '.75rem' }}>
            Check-in <b>{timeOf(r.checkInAt, tz)}</b>{r.minutesLate ? ` (${r.minutesLate} min late)` : ''} · Check-out <b>{timeOf(r.checkOutAt, tz)}</b>
            {r.proof?.onCampus === true && <> · <span className="badge approved">On campus</span></>}
            {r.proof?.onCampus === false && <> · <span className="badge rejected">Outside campus</span></>}
            {r.auto && <> · <span className="muted small">marked by the system</span></>}
          </p>
        )}

        {canIn && (
          <div className="actions" style={{ marginTop: '.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Note (optional)</label>
              <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="For example: bus was late" />
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={checkIn}>{busy ? 'Checking your location...' : 'Check in'}</button>
          </div>
        )}
        {canIn && needsPlace && <p className="muted small">Your location is used once, only to confirm that you are on the campus. Allow location access in the browser when asked.</p>}
        {r && r.checkInAt && !r.checkOutAt && ['present', 'late'].includes(r.status) && (
          <div className="actions" style={{ marginTop: '.75rem' }}><button className="btn" disabled={busy} onClick={checkOut}>Check out</button></div>
        )}
        {r && ['absent', 'leave'].includes(r.status) && (
          <p className="muted small" style={{ marginTop: '.5rem' }}>
            {r.topicsMoved ? `${r.topicsMoved} course content(s) planned for today were moved to the next teaching day. ` : ''}
            {r.status === 'absent' ? 'If this is wrong, ask your HOD or the principal to correct it.' : ''}
          </p>
        )}
      </div>

      {month && (
        <div className="card table-wrap">
          <h3>This month</h3>
          <p>
            Present <b>{month.counts.present || 0}</b> · Late <b>{month.counts.late || 0}</b> · Absent <b>{month.counts.absent || 0}</b> · Leave <b>{month.counts.leave || 0}</b>
          </p>
          <table>
            <thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th>Late (min)</th><th>Note</th></tr></thead>
            <tbody>
              {month.records.map((x) => (
                <tr key={x._id}>
                  <td>{x.date}</td><td><Badge value={x.status} /></td><td>{timeOf(x.checkInAt, tz)}</td><td>{timeOf(x.checkOutAt, tz)}</td>
                  <td>{x.minutesLate || ''}</td><td>{x.note}{x.auto ? ' (system)' : ''}</td>
                </tr>
              ))}
              {!month.records.length && <tr><td colSpan={6} className="muted">No attendance recorded this month yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function MyLeave({ ok, fail }) {
  const [leaves, setLeaves] = useState([]);
  const [form, setForm] = useState({ fromDate: todayKey(), toDate: todayKey(), type: 'casual', reason: '' });

  const load = useCallback(() => api.get('/staff-attendance/leaves').then((r) => setLeaves(r.data.data)).catch(fail), [fail]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/staff-attendance/leaves', form);
      ok(data.message);
      setForm({ ...form, reason: '' });
      load();
    } catch (err) { fail(err); }
  };
  const cancel = async (l) => {
    if (!window.confirm('Cancel this leave?')) return;
    try { await api.delete(`/staff-attendance/leaves/${l._id}`); load(); } catch (err) { fail(err); }
  };

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h3>Ask for leave</h3>
        <div className="form-grid">
          <div><label>First day</label><input type="date" required value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value, toDate: form.toDate < e.target.value ? e.target.value : form.toDate })} /></div>
          <div><label>Last day</label><input type="date" required min={form.fromDate} value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></div>
          <div>
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {['casual', 'sick', 'official', 'other'].map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </div>
        </div>
        <label>Reason</label>
        <textarea rows={2} required minLength={3} maxLength={600} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <p className="muted small">When the leave is approved, the course contents planned on those days move to the next teaching day automatically.</p>
        <div className="actions"><button className="btn btn-primary">Send request</button></div>
      </form>

      <div className="card table-wrap">
        <h3>My requests</h3>
        <table>
          <thead><tr><th>From</th><th>To</th><th>Type</th><th>Reason</th><th>Status</th><th>Decision</th><th /></tr></thead>
          <tbody>
            {leaves.map((l) => (
              <tr key={l._id}>
                <td>{l.fromDate}</td><td>{l.toDate}</td><td>{label(l.type)}</td><td>{l.reason}</td><td><Badge value={l.status} /></td>
                <td>{l.reviewedBy?.name ? `${l.reviewedBy.name}${l.reviewNote ? `: ${l.reviewNote}` : ''}` : ''}</td>
                <td className="actions">{['pending', 'approved'].includes(l.status) && <button className="btn btn-small" onClick={() => cancel(l)}>Cancel</button>}</td>
              </tr>
            ))}
            {!leaves.length && <tr><td colSpan={7} className="muted">No leave requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function Team({ ok, fail, isHead }) {
  const [date, setDate] = useState(todayKey());
  const [dept, setDept] = useState('');
  const [depts, setDepts] = useState([]);
  const [data, setData] = useState(null);
  const [fix, setFix] = useState(null); // { user, status, note }

  const load = useCallback(async () => {
    try {
      const params = { date };
      if (isHead && dept) params.department = dept;
      setData((await api.get('/staff-attendance/overview', { params })).data.data);
    } catch (e) { fail(e); }
  }, [date, dept, isHead, fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (isHead) api.get('/departments').then((r) => setDepts(r.data.data.filter((d) => d.status === 'active'))).catch(() => {});
  }, [isHead]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const { data: res } = await api.put('/staff-attendance/mark', { user: fix.user._id, date, status: fix.status, note: fix.note });
      ok(res.message || 'Saved');
      setFix(null);
      load();
    } catch (err) { fail(err); }
  };
  const move = async (u) => {
    try { const { data: res } = await api.post('/staff-attendance/move-topics', { date, user: u._id }); ok(res.message); load(); } catch (err) { fail(err); }
  };

  return (
    <>
      <div className="card filters">
        <div><label>Date</label><input type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {isHead && (
          <div>
            <label>Department</label>
            <select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {data && (
        <p>
          {['present', 'late', 'absent', 'leave', 'not_marked'].map((k) => <span key={k} style={{ marginRight: '1rem' }}>{label(k)} <b>{data.counts[k] || 0}</b></span>)}
          {data.pendingLeaves > 0 && <span className="badge pending">{data.pendingLeaves} leave request(s) waiting</span>}
        </p>
      )}

      {fix && (
        <form className="card" onSubmit={save}>
          <h3>Correct {fix.user.name} on {date}</h3>
          <div className="form-grid">
            <div>
              <label>Status</label>
              <select value={fix.status} onChange={(e) => setFix({ ...fix, status: e.target.value })}>
                {['present', 'late', 'absent', 'leave'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
            </div>
          </div>
          <label>Reason for the correction</label>
          <input required minLength={3} maxLength={300} value={fix.note} onChange={(e) => setFix({ ...fix, note: e.target.value })} />
          <p className="muted small">Marking absent or leave moves the course contents planned for that day to the next teaching day. The teacher is notified.</p>
          <div className="actions">
            <button className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setFix(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Staff</th>{isHead && <th>Department</th>}<th>Status</th><th>In</th><th>Out</th><th>Proof</th><th>Note</th><th /></tr></thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.user._id}>
                <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}><Avatar user={r.user} size={30} />{r.user.name}</span></td>
                {isHead && <td>{r.user.department?.code || (r.user.role === 'finance_officer' ? 'Finance office' : 'All')}</td>}
                <td><Badge value={r.status} />{r.minutesLate ? <div className="muted small">{r.minutesLate} min late</div> : null}</td>
                <td>{timeOf(r.checkInAt)}</td><td>{timeOf(r.checkOutAt)}</td>
                <td>
                  {r.onCampus === true && <span className="badge approved">On campus{r.distanceMeters != null ? ` (${r.distanceMeters} m)` : ''}</span>}
                  {r.onCampus === false && <span className="badge rejected">Outside{r.distanceMeters != null ? ` (${r.distanceMeters} m)` : ''}</span>}
                  {r.onCampus == null && r.checkInAt && <span className="muted small">not checked</span>}
                </td>
                <td>{r.note}{r.auto ? ' (system)' : ''}{r.topicsMoved ? ` · ${r.topicsMoved} content(s) moved` : ''}</td>
                <td className="actions">
                  <button className="btn btn-small" onClick={() => setFix({ user: r.user, status: r.status === 'not_marked' ? 'present' : r.status, note: '' })}>Correct</button>
                  {['absent', 'leave'].includes(r.status) && <button className="btn btn-small" onClick={() => move(r.user)}>Move contents</button>}
                </td>
              </tr>
            ))}
            {data && !data.rows.length && <tr><td colSpan={8} className="muted">No teachers found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function Requests({ ok, fail }) {
  const [status, setStatus] = useState('pending');
  const [list, setList] = useState([]);
  const [note, setNote] = useState({});

  const load = useCallback(
    () => api.get('/staff-attendance/leaves', { params: { scope: 'review', status } }).then((r) => setList(r.data.data)).catch(fail),
    [status, fail]
  );
  useEffect(() => { load(); }, [load]);

  const decide = async (l, decision) => {
    try {
      const { data } = await api.patch(`/staff-attendance/leaves/${l._id}/review`, { status: decision, note: note[l._id] || undefined });
      ok(data.message);
      load();
    } catch (err) { fail(err); }
  };

  return (
    <>
      <div className="card filters">
        <div>
          <label>Show</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {['pending', 'approved', 'rejected', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Teacher</th><th>From</th><th>To</th><th>Type</th><th>Reason</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((l) => (
              <tr key={l._id}>
                <td>{l.user?.name}</td><td>{fmtDate(`${l.fromDate}T00:00:00Z`)}</td><td>{fmtDate(`${l.toDate}T00:00:00Z`)}</td><td>{label(l.type)}</td><td>{l.reason}</td>
                <td><Badge value={l.status} /></td>
                <td>
                  {l.status === 'pending' ? (
                    <div className="actions">
                      <input placeholder="Note (optional)" maxLength={300} value={note[l._id] || ''} onChange={(e) => setNote({ ...note, [l._id]: e.target.value })} style={{ minWidth: 140 }} />
                      <button className="btn btn-small btn-primary" onClick={() => decide(l, 'approved')}>Approve</button>
                      <button className="btn btn-small btn-danger" onClick={() => decide(l, 'rejected')}>Reject</button>
                    </div>
                  ) : (l.reviewedBy?.name ? `${l.reviewedBy.name}${l.reviewNote ? `: ${l.reviewNote}` : ''}` : '')}
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="muted">No {status} requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function MonthSummary({ fail }) {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/staff-attendance/summary', { params: { month } }).then((r) => setData(r.data.data)).catch(fail); }, [month, fail]);

  return (
    <>
      <div className="card filters"><div><label>Month</label><input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></div></div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Teacher</th><th>Department</th><th>Present</th><th>Late</th><th>Minutes late</th><th>Absent</th><th>Leave</th></tr></thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.user._id}>
                <td>{r.user.name}</td><td>{r.user.department?.code || 'All'}</td><td>{r.present}</td><td>{r.late}</td><td>{r.minutesLate}</td><td>{r.absent}</td><td>{r.leave}</td>
              </tr>
            ))}
            {data && !data.rows.length && <tr><td colSpan={7} className="muted">No teachers found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function Rules({ ok, fail }) {
  const [f, setF] = useState(null);
  useEffect(() => { api.get('/staff-attendance/rules').then((r) => setF(r.data.data)).catch(fail); }, [fail]);
  if (!f) return <div className="card muted">Loading...</div>;

  const num = (v) => (v === '' ? null : Number(v));
  const useMyLocation = async () => {
    const p = await getPosition();
    if (!p) return fail('The location could not be read. Allow location access in the browser, or type the numbers.');
    setF({ ...f, campus: { ...f.campus, lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) } });
  };
  const save = async (e) => {
    e.preventDefault();
    try {
      const body = {
        timezone: f.timezone, opensAt: f.opensAt, graceMinutes: Number(f.graceMinutes), absentAfter: f.absentAfter, closesAt: f.closesAt,
        requireOnCampus: f.requireOnCampus, maxAccuracyMeters: Number(f.maxAccuracyMeters),
        campus: { lat: num(f.campus.lat), lng: num(f.campus.lng), radiusMeters: Number(f.campus.radiusMeters) },
      };
      const { data } = await api.put('/staff-attendance/rules', body);
      setF(data.data);
      ok(data.message);
    } catch (err) { fail(err); }
  };

  return (
    <form className="card" onSubmit={save}>
      <h3>When the college starts</h3>
      <div className="form-grid">
        <div><label>Check-in opens (college starts)</label><input type="time" required value={f.opensAt} onChange={(e) => setF({ ...f, opensAt: e.target.value })} /></div>
        <div><label>Grace (minutes after the start)</label><input type="number" min={0} max={240} required value={f.graceMinutes} onChange={(e) => setF({ ...f, graceMinutes: e.target.value })} /></div>
        <div><label>Marked absent if not checked in by</label><input type="time" required value={f.absentAfter} onChange={(e) => setF({ ...f, absentAfter: e.target.value })} /></div>
        <div><label>Check-out possible until</label><input type="time" required value={f.closesAt} onChange={(e) => setF({ ...f, closesAt: e.target.value })} /></div>
        <div><label>Time zone</label><input required value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} /></div>
      </div>

      <h3 style={{ marginTop: '1rem' }}>Proof that the teacher is on campus</h3>
      <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', fontWeight: 400 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={f.requireOnCampus} onChange={(e) => setF({ ...f, requireOnCampus: e.target.checked })} />
        Refuse check-in from outside the campus circle (or without a location)
      </label>
      <div className="form-grid">
        <div><label>Campus latitude</label><input type="number" step="any" value={f.campus.lat ?? ''} onChange={(e) => setF({ ...f, campus: { ...f.campus, lat: e.target.value } })} /></div>
        <div><label>Campus longitude</label><input type="number" step="any" value={f.campus.lng ?? ''} onChange={(e) => setF({ ...f, campus: { ...f.campus, lng: e.target.value } })} /></div>
        <div><label>Radius (metres)</label><input type="number" min={20} max={5000} value={f.campus.radiusMeters} onChange={(e) => setF({ ...f, campus: { ...f.campus, radiusMeters: e.target.value } })} /></div>
        <div><label>Worst accepted GPS accuracy (metres)</label><input type="number" min={10} max={2000} value={f.maxAccuracyMeters} onChange={(e) => setF({ ...f, maxAccuracyMeters: e.target.value })} /></div>
      </div>
      {f.requireOnCampus && (f.campus.lat == null || f.campus.lat === '' || f.campus.lng == null || f.campus.lng === '') && (
        <div className="alert alert-info">The campus point is not set, so the location is not checked yet. Stand on the campus and press "Use my current location", then save.</div>
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={useMyLocation}>Use my current location as the campus point</button>
        <button className="btn btn-primary">Save rules</button>
      </div>
    </form>
  );
}
