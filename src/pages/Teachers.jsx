import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import TeachersPanel from '../components/TeachersPanel.jsx';

// Teachers hub. The University Head first sees one box per department (with its teacher count),
// then the teacher boxes, which can be searched. Click a teacher to see all their classes.
export default function Teachers() {
  const { user } = useSelector((s) => s.auth);
  const isHead = user.role === 'university_head';
  const [depts, setDepts] = useState([]);
  const [counts, setCounts] = useState({});
  const [department, setDepartment] = useState('');

  useEffect(() => {
    if (!isHead) return;
    Promise.all([api.get('/departments'), api.get('/users')])
      .then(([d, u]) => {
        setDepts(d.data.data);
        const c = {};
        u.data.data.filter((x) => ['teacher', 'hod'].includes(x.role)).forEach((x) => {
          const k = x.department?._id;
          c[k] = (c[k] || 0) + 1;
        });
        setCounts(c);
      })
      .catch(() => {});
  }, [isHead]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="row-between">
        <div>
          <h1>Teachers</h1>
          <p className="muted" style={{ margin: 0 }}>Choose a department, search by name, and click a teacher to see their classes.</p>
        </div>
        <Link className="btn btn-ghost" to="/users">Add / deactivate teachers</Link>
      </div>

      {isHead && (
        <div className="pick-grid" style={{ marginTop: '1rem' }}>
          <button className={`pick ${department === '' ? 'on' : ''}`} onClick={() => setDepartment('')}>
            <b>{total}</b><span>All departments</span>
          </button>
          {depts.map((d) => (
            <button key={d._id} className={`pick ${department === d._id ? 'on' : ''}`} onClick={() => setDepartment(d._id)}>
              <b>{counts[d._id] || 0}</b><span>{d.name}</span>
            </button>
          ))}
        </div>
      )}
      <TeachersPanel department={department} />
    </>
  );
}
