import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Brand from './Brand.jsx';
import '../pages/admission.css';

// Common frame of the public admission pages (Apply, Track application, Merit list). No login is needed for them.
export default function AdmissionShell({ title, subtitle, wide = false, children }) {
  const user = useSelector((s) => s.auth.user);
  const ap = useSelector((s) => s.settings.admissionPortal);
  return (
    <div className="adm">
      <header className="adm-bar">
        <div className="adm-wrap adm-bar-in">
          <Link to="/" className="adm-brand"><Brand showCampus /></Link>
          <nav>
            <Link to="/">Home</Link>
            {ap?.externalUrl ? <a href={ap.externalUrl} target="_blank" rel="noreferrer">Apply</a> : <Link to="/apply">Apply</Link>}
            <Link to="/track-application">Track application</Link>
            {ap?.meritListPublished && <Link to="/merit-list">Merit list</Link>}
            <Link className="adm-signin" to={user ? '/dashboard' : '/login'}>{user ? 'Dashboard' : 'Sign in'}</Link>
          </nav>
        </div>
      </header>
      <main className={`adm-wrap ${wide ? 'wide' : ''}`}>
        <h1>{title}</h1>
        {subtitle && <p className="adm-sub">{subtitle}</p>}
        {children}
      </main>
    </div>
  );
}
