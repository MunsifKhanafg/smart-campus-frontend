import { useEffect, useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api, { errorMessage } from '../api/axios.js';
import { useConfirm } from '../components/ConfirmModal.jsx';

const EMPTY = { name: '', code: '', description: '', contact: { email: '', phone: '', office: '', officeHours: '' } };

// University head: a card for every department. Click a card to open it (semesters, teachers, students, attendance).
// An HOD only has one department, so they are sent straight to it.
export default function Departments() {
  const { user } = useSelector((s) => s.auth);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const isHead = user.role === 'university_head';
  const [list, setList] = useState([]);
  const [counts, setCounts] = useState({ semesters: {}, students: {} });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [editing, setEditing] = useState(null); // null | 'new' | department object
  const [form, setForm] = useState(EMPTY);
  const [hodFor, setHodFor] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/departments');
      setList(data.data);
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Small numbers shown on each card.
  useEffect(() => {
    Promise.all([api.get('/semesters'), api.get('/students')])
      .then(([s, st]) => {
        const sem = {};
        const stu = {};
        s.data.data.forEach((x) => { const k = x.department?._id; sem[k] = (sem[k] || 0) + 1; });
        st.data.data.forEach((x) => { const k = x.department?._id; stu[k] = (stu[k] || 0) + 1; });
        setCounts({ semesters: sem, students: stu });
      })
      .catch(() => {});
  }, []);

  if (!isHead) {
    const id = user.department?._id || user.department;
    if (id) return <Navigate to={`/departments/${id}`} replace />;
  }

  const flash = (type, text) => setMsg({ type, text });

  const openForm = (d) => {
    setEditing(d || 'new');
    setForm(d ? { name: d.name, code: d.code, description: d.description || '', contact: { ...EMPTY.contact, ...d.contact } } : EMPTY);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing === 'new') await api.post('/departments', form);
      else await api.put(`/departments/${editing._id}`, form);
      flash('success', 'Department saved');
      setEditing(null);
      load();
    } catch (err) {
      flash('error', errorMessage(err));
    }
  };

  const toggleStatus = async (d) => {
    const status = d.status === 'active' ? 'archived' : 'active';
    const archiving = status === 'archived';
    const yes = await confirm({
      tone: archiving ? 'danger' : 'primary',
      title: `${archiving ? 'Archive' : 'Re-activate'} ${d.name}?`,
      message: 'Academic records are always preserved.',
      confirmText: archiving ? 'Archive' : 'Re-activate',
    });
    if (!yes) return;
    try {
      await api.patch(`/departments/${d._id}/status`, { status });
      load();
    } catch (err) {
      flash('error', errorMessage(err));
    }
  };

  const openHod = async (d) => {
    setHodFor(d);
    setTeacherId('');
    try {
      const { data } = await api.get('/users', { params: { role: 'teacher', department: d._id } });
      setTeachers(data.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      flash('error', errorMessage(err));
    }
  };

  const assign = async () => {
    try {
      await api.post(`/departments/${hodFor._id}/hod`, { userId: teacherId });
      flash('success', 'HOD assigned');
      setHodFor(null);
      load();
    } catch (err) {
      flash('error', errorMessage(err));
    }
  };

  const setC = (k, v) => setForm({ ...form, contact: { ...form.contact, [k]: v } });
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <>
      <div className="row-between">
        <div>
          <h1>Departments</h1>
          <p className="muted" style={{ margin: 0 }}>Click a department to see its semesters, classes, teachers, students and attendance.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openForm(null)}>+ New department</button>
      </div>
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {editing && (
        <form className="card" onSubmit={save} style={{ marginTop: '1rem' }}>
          <h3>{editing === 'new' ? 'New department' : `Edit ${editing.name}`}</h3>
          <div className="form-grid">
            <div><label>Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Code (e.g. CS)</label><input required maxLength={12} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><label>Contact email</label><input type="email" value={form.contact.email} onChange={(e) => setC('email', e.target.value)} /></div>
            <div><label>Contact phone</label><input value={form.contact.phone} onChange={(e) => setC('phone', e.target.value)} /></div>
            <div><label>Office / location</label><input value={form.contact.office} onChange={(e) => setC('office', e.target.value)} /></div>
            <div><label>Office hours</label><input value={form.contact.officeHours} onChange={(e) => setC('officeHours', e.target.value)} /></div>
          </div>
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="actions">
            <button className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {hodFor && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>{hodFor.hod ? 'Transfer HOD' : 'Assign HOD'} — {hodFor.name}</h3>
          <p className="muted">Pick a teacher from this department. The current HOD (if any) becomes a normal teacher; all records stay intact.</p>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">Select teacher...</option>
            {teachers.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.email})</option>)}
          </select>
          <div className="actions">
            <button className="btn btn-primary" disabled={!teacherId} onClick={assign}>Confirm</button>
            <button className="btn btn-ghost" onClick={() => setHodFor(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="dept-grid" style={{ marginTop: '1rem' }}>
        {list.map((d) => (
          <div key={d._id} className="dept-card" role="link" tabIndex={0} style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/departments/${d._id}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/departments/${d._id}`)}>
            <div className="row-between" style={{ gap: '.5rem' }}>
              <span className="code">{d.code}</span>
              <span className={`badge ${d.status}`}>{d.status}</span>
            </div>
            <h3>{d.name}</h3>
            <div className="meta">HOD: {d.hod ? <b>{d.hod.name}</b> : <em>Not assigned</em>}</div>
            <div className="mini">
              <div><b>{counts.semesters[d._id] || 0}</b>Semesters</div>
              <div><b>{counts.students[d._id] || 0}</b>Students</div>
            </div>
            <div className="dept-tools">
              <button className="btn btn-small btn-ghost" onClick={stop(() => openForm(d))}>Edit</button>
              <button className="btn btn-small btn-ghost" disabled={d.status === 'archived'} onClick={stop(() => openHod(d))}>
                {d.hod ? 'Transfer HOD' : 'Assign HOD'}
              </button>
              <button className="btn btn-small btn-danger" onClick={stop(() => toggleStatus(d))}>
                {d.status === 'active' ? 'Archive' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
        {!list.length && <div className="card empty-state" style={{ gridColumn: '1/-1' }}><div className="big">🏛️</div>No departments yet. Create the first one.</div>}
      </div>
    </>
  );
}
