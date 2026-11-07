import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import Brand from '../components/Brand.jsx';
import { fmtDate } from '../components/ui.jsx';

// Public page (no login). Everything shown here comes from MongoDB, so the University Head can change it from Settings.
export default function Contact() {
  const user = useSelector((s) => s.auth.user);
  const portal = useSelector((s) => s.settings.admissionPortal);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/public/contact').then((r) => setData(r.data.data)).catch(() => setError('Contact details could not be loaded.'));
  }, []);

  const u = data?.university;
  return (
    <div className="public-page">
      <header className="row-between">
        <Brand showCampus />
        <div className="actions">
          {portal?.externalUrl
            ? <a className="btn btn-primary" href={portal.externalUrl} target="_blank" rel="noreferrer">Apply for admission</a>
            : <Link className="btn btn-primary" to="/apply">Apply for admission</Link>}
          <Link className="btn btn-ghost" to={user ? '/dashboard' : '/login'}>{user ? 'Dashboard' : 'Login'}</Link>
        </div>
      </header>
      <h1>Contact us</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {u && (
        <div className="card">
          <h3>{u.name}{u.campus ? ` — ${u.campus}` : ''}</h3>
          <p>{u.address || <span className="muted">Address not set</span>}</p>
          <p>
            {u.contactNumber && <>Phone: {u.contactNumber}<br /></>}
            {u.email && <>Email: <a href={`mailto:${u.email}`}>{u.email}</a><br /></>}
            {u.website && <>Website: {u.website}<br /></>}
            {u.officeHours && <>Office hours: {u.officeHours}</>}
          </p>
        </div>
      )}

      {data?.announcements?.length > 0 && (
        <>
          <h3>Important announcements</h3>
          {data.announcements.map((a) => (
            <div className="sub-card" key={a._id}>
              <h4>{a.title}</h4>
              <div className="muted small">{fmtDate(a.publishDate)}</div>
              <p>{a.message}</p>
              {a.meeting?.date && (
                <div className="small">Meeting: {fmtDate(a.meeting.date)} {a.meeting.time || ''} {a.meeting.location ? `· ${a.meeting.location}` : ''}</div>
              )}
            </div>
          ))}
        </>
      )}

      {data?.departments?.length > 0 && (
        <>
          <h3>Departments</h3>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Department</th><th>Email</th><th>Phone</th><th>Office</th><th>Office hours</th></tr></thead>
              <tbody>
                {data.departments.map((d) => (
                  <tr key={d._id}>
                    <td>{d.name} <span className="muted small">({d.code})</span></td>
                    <td>{d.contact?.email || '—'}</td>
                    <td>{d.contact?.phone || '—'}</td>
                    <td>{d.contact?.office || '—'}</td>
                    <td>{d.contact?.officeHours || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
