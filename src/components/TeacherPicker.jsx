import { useMemo, useState } from 'react';
import { colorFor, initials } from './palette.js';

// How busy a teacher is, from the credit hours they already teach.
const loadLevel = (credits) => (credits >= 15 ? 'high' : credits >= 9 ? 'mid' : 'low');
const LOAD_TEXT = { low: 'Light load', mid: 'Busy', high: 'Heavy load' };

// A dialog for choosing a teacher. Each teacher is a coloured card with their qualification, contact details
// and current workload, so the HOD can choose with the full picture.
//   teachers: [{ _id, name, email, phone, qualification, role, assignments: [{ _id, code, section, semester }], creditHours }]
export default function TeacherPicker({
  title, subtitle, color, teachers, value, onChange, extra, note,
  canRemove, onRemove, onSave, saveLabel = 'Assign teacher', saveDisabled, busy, error, onClose,
}) {
  const [search, setSearch] = useState('');
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => !q || t.name.toLowerCase().includes(q) || (t.email || '').toLowerCase().includes(q) || (t.qualification || '').toLowerCase().includes(q));
  }, [teachers, search]);
  const chosen = teachers.find((t) => t._id === value);

  return (
    <div className="cx-back" onClick={onClose}>
      <div className="cx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cx-modal-head" style={color}>
          <div className="cx-eyebrow">Choose a teacher</div>
          <h3>{title}</h3>
          {subtitle && <div className="cx-sub">{subtitle}</div>}
          <button type="button" className="cx-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="cx-modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          {extra}
          <input placeholder="Search by name, email or qualification..." value={search} onChange={(e) => setSearch(e.target.value)} />

          <div className="cx-pick-grid">
            {shown.map((t) => {
              const credits = t.creditHours || 0;
              const level = loadLevel(credits);
              return (
                <button key={t._id} type="button" style={colorFor(t.name)} className={`cx-pick ${value === t._id ? 'on' : ''}`} onClick={() => onChange(t._id)}>
                  <div className="cx-pick-top">
                    <span className="cx-av">{initials(t.name)}</span>
                    <div className="grow">
                      <div className="cx-pick-name">{t.name}{t.role === 'hod' && <span className="cx-hod">HOD</span>}</div>
                      <div className="cx-muted">{t.qualification || 'Qualification not added'}</div>
                    </div>
                  </div>
                  <div className="cx-muted cx-contact">{t.email}{t.phone ? ` · ${t.phone}` : ''}</div>
                  <div className="cx-load"><i className={level} style={{ width: `${Math.min(100, (credits / 18) * 100)}%` }} /></div>
                  <div className="cx-load-text">
                    <span className={`cx-pill ${level}`}>{LOAD_TEXT[level]}</span>
                    <span>{(t.assignments || []).length} class{(t.assignments || []).length === 1 ? '' : 'es'} · {credits} credit hrs</span>
                  </div>
                  {(t.assignments || []).length > 0 && (
                    <div className="cx-teaching">
                      {t.assignments.slice(0, 4).map((a) => <span key={a._id}>{a.code} · {a.section}</span>)}
                      {t.assignments.length > 4 && <span>+{t.assignments.length - 4} more</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {!shown.length && <p className="cx-muted" style={{ marginTop: '1rem' }}>{teachers.length ? 'No teacher matches your search.' : 'No active teachers in this department. Add teachers first.'}</p>}
          {note && <p className="cx-muted" style={{ marginTop: '1rem' }}>{note}</p>}
        </div>

        <div className="cx-modal-foot">
          <div className="grow">{chosen ? <>Selected: <b>{chosen.name}</b></> : <span className="cx-muted">Nobody selected yet</span>}</div>
          {canRemove && <button type="button" className="btn btn-danger inline" disabled={busy} onClick={onRemove}>Remove teacher</button>}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary inline" disabled={busy || saveDisabled} onClick={onSave}>{busy ? 'Saving…' : saveLabel}</button>
        </div>
      </div>
    </div>
  );
}
