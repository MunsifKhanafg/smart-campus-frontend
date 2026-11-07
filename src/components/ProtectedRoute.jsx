import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ServerOffline from './ServerOffline.jsx';

// Wraps routes. `roles` (optional) limits which roles may see them.
// NOTE: this is only for a nice UX. The real security is enforced by the backend on every request.
export default function ProtectedRoute({ roles }) {
  const { user, status } = useSelector((s) => s.auth);

  if (status === 'loading') return <div className="center-screen">Loading...</div>;
  if (status === 'offline') return <ServerOffline />; // logged in, but the server cannot be reached: wait, do not log out
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
