import { useState } from 'react';
import api from '../api/axios.js';

// Splits the course contents text into topic titles: one per line, or per ";" or per sentence.
// If that gives a single long line of comma separated items, it splits on the commas.
export const splitContents = (text) => {
  const clean = (s) => s.replace(/^[\s\-•*\u2022\d.)]+/, '').replace(/\s+/g, ' ').trim().replace(/[.;,]$/, '');
  let items = String(text || '').split(/\r?\n|;|(?<=\.)\s+(?=[A-Z])/).map(clean).filter((s) => s.length > 2);
  if (items.length === 1 && items[0].includes(',')) items = items[0].split(',').map(clean).filter((s) => s.length > 2);
  return items.slice(0, 60).map((s) => s.slice(0, 200));
};

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// "Course contents" of the subject, taken from the BS curriculum when the HOD assigned the teacher.
// The teacher can turn them into daily topics with one click (dates are spread out; each topic can be edited afterwards).
export default function ContentsCard({ outline, courseId, canEdit, topicCount, onCreated, ok, fail }) {
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [gap, setGap] = useState(3);
  const [busy, setBusy] = useState(false);

  if (!outline) {
    return (
      <div className="card muted">
        {canEdit
          ? 'No course contents have been added for this subject yet. They are copied from the BS curriculum when the HOD assigns the subject. Ask your HOD to add them to the curriculum.'
          : 'The course contents have not been added yet.'}
      </div>
    );
  }
  const items = splitContents(outline);

  const create = async () => {
    const warn = topicCount > 0 ? `\n\nThis course already has ${topicCount} topic(s). The new ones are added after them.` : '';
    if (!window.confirm(`Create ${items.length} topics from the course contents, one every ${gap} day(s) starting ${start}?${warn}`)) return;
    setBusy(true);
    try {
      for (const [i, title] of items.entries()) {
        await api.post('/topics', { course: courseId, title, description: '', scheduledDate: addDays(start, i * gap) });
      }
      ok(`${items.length} topics created. Edit any date or add files below`);
      onCreated();
    } catch (err) {
      fail(err);
      onCreated();
    } finally { setBusy(false); }
  };

  return (
    <div className="card">
      <h3>Course contents <span className="muted small">(from the BS curriculum)</span></h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{outline}</p>
      {canEdit && items.length > 0 && (
        <div className="inline-form">
          <div><label>First teaching date</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label>Days between topics</label><input type="number" min={1} max={30} value={gap} onChange={(e) => setGap(Math.max(1, Number(e.target.value) || 1))} /></div>
          <button type="button" className="btn btn-primary" disabled={busy || !start} onClick={create}>
            {busy ? 'Creating…' : `Create ${items.length} topics from these contents`}
          </button>
        </div>
      )}
    </div>
  );
}
