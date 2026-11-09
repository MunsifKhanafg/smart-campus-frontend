import { useSelector } from 'react-redux';
import LogoPlate from './LogoPlate.jsx';

// Logo + name from the database. Used in the menu, headers, footers and the public pages.
// The logo is shown about 30% larger than the `size` the caller asks for, on a white plate so it never blends into the background.
// stacked = logo on top, name under it, centred (the side menu uses this so a wide logo never squeezes the name).
export default function Brand({ size = 36, showCampus = false, light = false, stacked = false }) {
  const s = useSelector((st) => st.settings);
  return (
    <div className={`brand ${stacked ? 'brand-stacked' : ''}`} style={{ color: light ? '#fff' : 'inherit' }}>
      <LogoPlate size={Math.round(size * 1.3)} />
      <div>
        <div className="brand-name">{s.universityName}</div>
        {showCampus && s.campusName && <div className="brand-sub">{s.campusName}</div>}
      </div>
    </div>
  );
}
