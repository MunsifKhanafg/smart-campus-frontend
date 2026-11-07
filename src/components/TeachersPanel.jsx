import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';

// Teachers as boxes, grouped by department, with a search bar. Click a box to see all of that teacher's classes.
export default function TeachersPanel({ department }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(null);
    const params = department ? { department } : {};
    Promise.all([api.get('/users', { params }), api.get('/courses', { params: { ...params, status: 'active' } })])
      .then(([u, c]) => {
        const courses = c.data.data;
        const teachers = u.data.data.filter((x) => ['teacher', 'hod'].includes(x.role));
        setRows(teachers.map((t) => ({ ...t, classes: courses.filter((k) => k.teacher?._id === t._id).length })));
        setError('');
      })
      .catch((e) => setError(errorMessage(e)));
  }, [department]);

  const groups = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    const shown = q ? rows.filter((t) => `${t.name} ${t.email}`.toLowerCase().includes(q)) : rows;
    const map = new Map();
    shown.forEach((t) => {
      const key = t.department?.name || 'No department';
      (map.get(key) || map.set(key, []).get(key)).push(t);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, search]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!rows) return <p className="muted">Loading teachers...</p>;

  const total = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <>
      <div className="search-bar">
        <span>🔍</span>
        <input placeholder={`Search ${rows.length} teachers by name or email...`} value={search} onChange={(e) => setSearch(e.target.value)} />
        <small className="muted">{total} shown</small>
      </div>

      {!groups.length && <div className="card empty-state"><div className="big">👩‍🏫</div>No teachers found.</div>}

      {groups.map(([deptName, list]) => (
        <section key={deptName} className="group">
          <h3 className="group-title">{deptName} <span>{list.length}</span></h3>
          <div className="person-grid">
            {list.map((t) => (
              <div key={t._id} className="person-card" role="link" tabIndex={0}
                onClick={() => navigate(`/teachers/${t._id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/teachers/${t._id}`)}>
                <div className="avatar">{(t.name || '?')[0]}</div>
                <div className="info">
                  <b>{t.name}</b>
                  <small>{t.email}</small>
                  <div className="chips">
                    {t.role === 'hod' && <span className="badge upcoming">HOD</span>}
                    <span className="badge completed">{t.classes} class{t.classes === 1 ? '' : 'es'}</span>
                    {!t.isActive && <span className="badge archived">inactive</span>}
                  </div>
                </div>
                <span className="go">›</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
