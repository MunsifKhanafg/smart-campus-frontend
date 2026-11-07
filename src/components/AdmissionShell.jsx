import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Brand from './Brand.jsx';
import '../pages/admission.css';

// Page frame for the public admission pages (Apply, Track, Merit list). No login is needed for any of them.
export default function AdmissionShell({ title, subtitle, wide = false, children }) {
  const user = useSelector((s) => s.auth.user);
  return (
    <div className="adm">
      <header className="adm-bar">
        <div className={`adm-wrap ${wide ? 'wide' : ''} adm-bar-in`}>
          <Link to="/" className="adm-brand"><Brand size={36} showCampus /></Link>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/apply">Apply</Link>
            <Link to="/track-application">Track application</Link>
            <Link to="/merit-list">Merit list</Link>
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
