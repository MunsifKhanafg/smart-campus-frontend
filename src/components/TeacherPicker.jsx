import { useMemo, useState } from 'react';
import { colorFor, initials } from './palette.js';

// A teacher's weekly teaching hours, and how that compares with the limit the administrator set for them.
// There is no fixed number: no limit set = nothing is flagged, a limit set = it is shown and enforced by the server.
const hoursOf = (t) => t.weeklyHours ?? t.creditHours ?? 0;
const levelOf = (hours, limit) => {
  if (!limit) return 'free';
  const r = hours / limit;
  return r >= 1 ? 'high' : r >= 0.75 ? 'mid' : 'low';
};
const LOAD_TEXT = { free: 'No limit set', low: 'Within limit', mid: 'Near the limit', high: 'At the limit' };

// A dialog for choosing a teacher. Each teacher is a coloured card with qualification, subjects, department, contact details and
// current weekly workload, so the HOD can choose with the full picture.
//   teachers: [{ _id, name, email, phone, qualification, role, subjects, home, department, maxWeeklyHours,
//                weeklyHours, assignments: [{ _id, code, section }] }]
//   fits(t): does this teacher fit the subject? When given, the dialog opens on "For this subject" and has an "All teachers" tab.
//   courseHours: classes per week this class takes, used to warn when a teacher's weekly limit would be exceeded.
//   currentTeacherId: the teacher the class has now (their hours already include this class).
export default function TeacherPicker({
  title, subtitle, color, teachers, value, onChange, extra, note, fits, courseHours = 0, currentTeacherId = '',
  canRemove, onRemove, onSave, saveLabel = 'Assign teacher', saveDisabled, busy, error, onClose,
}) {
  const [search, setSearch] = useState('');
  // Only teachers permitted to teach in this department can be chosen. eligible === false means "shown greyed out under All teachers".
  const allowed = (t) => t.eligible !== false;
  const fitting = useMemo(() => (fits ? teachers.filter((t) => allowed(t) && fits(t)) : teachers), [teachers, fits]);
  const [mode, setMode] = useState(() => (fits && teachers.some((t) => allowed(t) && fits(t)) ? 'fit' : 'all'));
  const pool = fits && mode === 'fit' ? fitting : teachers;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pool.filter((t) => !q || t.name.toLowerCase().includes(q) || (t.email || '').toLowerCase().includes(q)
      || (t.qualification || '').toLowerCase().includes(q) || (t.subjects || []).some((s) => s.toLowerCase().includes(q))
      || `${t.department?.code || ''} ${t.department?.name || ''}`.toLowerCase().includes(q)
      || (t.permitted?.list || []).some((d) => `${d.code} ${d.name}`.toLowerCase().includes(q)));
  }, [pool, search]);
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

          {fits && (
            <div className="cx-tabs">
              <button type="button" className={mode === 'fit' ? 'on' : ''} onClick={() => setMode('fit')}>For this subject ({fitting.length})</button>
              <button type="button" className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>All teachers ({teachers.length})</button>
            </div>
          )}
          <input placeholder="Search by name, subject (English, Maths, Arts...), department or qualification..." value={search} onChange={(e) => setSearch(e.target.value)} />

          {fits && mode === 'fit' && !fitting.length && (
            <p className="cx-muted" style={{ marginTop: '.8rem' }}>
              No teacher has this subject in their list yet. Open the "All teachers" tab, or add the subject to a teacher under Users &gt; Edit so they show up here next time.
            </p>
          )}

          <div className="cx-pick-grid">
            {shown.map((t) => {
              const hours = hoursOf(t);
              const limit = t.maxWeeklyHours || 0;
              const level = levelOf(hours, limit);
              const over = !!limit && hours + (t._id === currentTeacherId ? 0 : courseHours) > limit;
              const n = (t.assignments || []).length;
              return (
                <button key={t._id} type="button" style={allowed(t) ? colorFor(t.name) : { ...colorFor(t.name), opacity: 0.5, cursor: 'not-allowed' }} className={`cx-pick ${value === t._id ? 'on' : ''}`} onClick={() => allowed(t) && onChange(t._id)}>
                  <div className="cx-pick-top">
                    <span className="cx-av">{initials(t.name)}</span>
                    <div className="grow">
                      <div className="cx-pick-name">
                        {t.name}
                        {t.role === 'hod' && <span className="cx-hod">HOD</span>}
                        {t.home === false && t.department && <span className="cx-hod" style={{ background: '#fef3c7', color: '#92400e' }}>from {t.department.code}</span>}
                      </div>
                      <div className="cx-muted">{t.qualification || 'Qualification not added'}</div>
                    </div>
                  </div>
                  <div className="cx-muted cx-contact">{t.email}{t.phone ? ` · ${t.phone}` : ''}</div>
                  <div className="cx-muted cx-contact">Permitted to teach in: <b>{t.permitted?.all ? 'All departments' : ((t.permitted?.list || []).map((d) => d.code).join(', ') || '—')}</b></div>
                  {!allowed(t) && <div className="cx-over">Not permitted in this department. The principal can allow it under Users &gt; Edit.</div>}
                  {(t.subjects || []).length > 0 && (
                    <div className="cx-teaching">
                      {t.subjects.slice(0, 5).map((s) => <span key={s} style={{ background: '#eef2ff', borderColor: '#c7d2fe' }}>{s}</span>)}
                      {t.subjects.length > 5 && <span>+{t.subjects.length - 5}</span>}
                    </div>
                  )}
                  <div className="cx-load"><i className={level === 'free' ? 'low' : level} style={{ width: `${limit ? Math.min(100, (hours / limit) * 100) : Math.min(100, hours * 5)}%` }} /></div>
                  <div className="cx-load-text">
                    <span className={`cx-pill ${level === 'free' ? 'low' : level}`}>{LOAD_TEXT[level]}</span>
                    <span>{hours} h/week{limit ? ` of ${limit} · ${t.freeHours ?? Math.max(0, limit - hours)} h free` : ' · no limit set'} · {t.creditHours || 0} credit hrs · {n} class{n === 1 ? '' : 'es'}</span>
                  </div>
                  {over && <div className="cx-over">Would go over the weekly limit of {limit} hours</div>}
                  {n > 0 && (
                    <div className="cx-teaching">
                      {t.assignments.slice(0, 4).map((a) => <span key={a._id}>{a.code} · {a.section}</span>)}
                      {n > 4 && <span>+{n - 4} more</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {!shown.length && !(fits && mode === 'fit' && !fitting.length) && <p className="cx-muted" style={{ marginTop: '1rem' }}>{teachers.length ? 'No teacher matches your search.' : 'No active teacher can teach in this department yet. Add teachers first.'}</p>}
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
