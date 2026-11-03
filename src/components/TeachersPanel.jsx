import { useEffect, useState, useCallback } from 'react';
import api, { errorMessage } from '../api/axios.js';
import { useConfirm } from './ConfirmModal.jsx';

// Teachers (and the HOD) of a department with the classes each one teaches.
// With canDelete, a teacher added by mistake can be deleted (the server refuses if the teacher has courses or records).
export default function TeachersPanel({ department, canDelete = false }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const confirm = useConfirm();

  const load = useCallback(() => {
    const params = department ? { department } : {};
    return Promise.all([api.get('/users', { params }), api.get('/courses', { params: { ...params, status: 'active' } })])
      .then(([u, c]) => {
        const courses = c.data.data;
        const teachers = u.data.data.filter((x) => ['teacher', 'hod'].includes(x.role));
        setRows(teachers.map((t) => ({ ...t, courses: courses.filter((k) => k.teacher?._id === t._id) })));
        setError('');
      })
      .catch((e) => setError(errorMessage(e)));
  }, [department]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const remove = async (t) => {
    const yes = await confirm({
      tone: 'danger',
      title: `Delete teacher "${t.name}"?`,
      message: 'The account will be deleted permanently.\n\nThis is only allowed if the teacher has no courses or teaching records. Otherwise deactivate the account instead.',
      confirmText: 'Delete teacher',
    });
    if (!yes) return;
    try {
      await api.delete(`/users/${t._id}`);
      setNotice('');
      await load();
    } catch (e) {
      setNotice(errorMessage(e));
    }
  };

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!rows) return <p className="muted">Loading teachers...</p>;
  if (!rows.length) return <div className="empty-state"><div className="big">👩‍🏫</div>No teachers in this department yet.</div>;

  return (
    <>
      {notice && <div className="alert alert-error">{notice}</div>}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Teacher</th><th>Department</th><th>Classes taught</th><th>Status</th>{canDelete && <th />}</tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t._id}>
                <td>{t.name}{t.role === 'hod' && <span className="badge upcoming" style={{ marginLeft: '.4rem' }}>HOD</span>}<div className="muted small">{t.email}</div></td>
                <td>{t.department?.code || '—'}</td>
                <td>
                  {t.courses.length
                    ? t.courses.map((k) => <span key={k._id} className="slot-chip"><b>{k.code}</b> {k.semester?.name}{k.section ? ` · ${k.section}` : ''}</span>)
                    : <em className="muted">Not assigned</em>}
                </td>
                <td><span className={`badge ${t.isActive ? 'active' : 'archived'}`}>{t.isActive ? 'active' : 'inactive'}</span></td>
                {canDelete && (
                  <td className="actions">
                    {t.role === 'teacher' && <button className="btn btn-small btn-danger" onClick={() => remove(t)}>Delete</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
