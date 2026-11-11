import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../api/axios.js';
import { loadMe } from '../store/authSlice.js';
import Avatar from './Avatar.jsx';
import PhotoUpload from './PhotoUpload.jsx';

// One person's photo for a page that is about something else (a student's record, a student list ...).
// It asks the server whether the viewer may change the photo (the student, the principal, the student's HOD) and shows the upload
// buttons only then; everybody else just sees the picture. Nothing is decided here: the server checks again on every upload.
export default function PersonPhoto({ userId, size = 96 }) {
  const dispatch = useDispatch();
  const me = useSelector((s) => s.auth.user);
  const [info, setInfo] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!userId) return;
    api.get(`/profile/${userId}`).then((r) => setInfo(r.data.data)).catch(() => setInfo(null));
  }, [userId]);

  if (!info) return <Avatar user={{ _id: userId, name: '' }} size={size} />;
  if (!info.canChangePhoto) return <Avatar user={info.user} size={size} />;

  return (
    <div>
      <PhotoUpload
        user={info.user}
        size={size}
        onMessage={(type, text) => setNote(`${type === 'error' ? '⚠ ' : ''}${text}`)}
        onChanged={(patch) => {
          setInfo({ ...info, user: { ...info.user, ...patch } });
          if (String(userId) === String(me?._id)) dispatch(loadMe()); // the picture in the menu and the top bar follows
        }}
      />
      {note && <div className="muted small" style={{ marginTop: '.3rem' }}>{note}</div>}
    </div>
  );
}
