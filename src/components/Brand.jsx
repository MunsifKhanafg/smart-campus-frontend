import { useSelector } from 'react-redux';
import { assetUrl } from '../api/axios.js';

// Shows the university logo + name from the database. Used in header, login page, etc.
export default function Brand({ size = 36, showCampus = false, light = false }) {
  const s = useSelector((st) => st.settings);
  return (
    <div className="brand" style={{ color: light ? '#fff' : 'inherit' }}>
      {s.logoUrl ? (
        <img src={assetUrl(s.logoUrl)} alt="logo" style={{ width: size, height: size }} />
      ) : (
        <div className="brand-fallback" style={{ width: size, height: size }}>{(s.universityName || 'S')[0]}</div>
      )}
      <div>
        <div className="brand-name">{s.universityName}</div>
        {showCampus && s.campusName && <div className="brand-sub">{s.campusName}</div>}
      </div>
    </div>
  );
}
