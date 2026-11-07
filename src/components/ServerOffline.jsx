import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { loadMe } from '../store/authSlice.js';

// Shown instead of the login page when the person IS logged in but the server (or its database) cannot be reached.
// They are not logged out: the app keeps trying every few seconds and continues by itself as soon as the server answers.
export default function ServerOffline() {
  const dispatch = useDispatch();

  useEffect(() => {
    const timer = setInterval(() => dispatch(loadMe()), 5000);
    return () => clearInterval(timer);
  }, [dispatch]);

  return (
    <div className="center-screen">
      <div className="card" style={{ maxWidth: 440, textAlign: 'center' }}>
        <h3>Reconnecting to the server…</h3>
        <p className="muted">
          The server is not reachable right now. You are still signed in, and this page will continue automatically when the server is back.
        </p>
        <button className="btn btn-primary" onClick={() => dispatch(loadMe())}>Try again now</button>
      </div>
    </div>
  );
}
