import { useState } from 'react';
import api from '../api/axios.js';
import NumberedContents from './NumberedContents.jsx';
import { splitContents } from './contentsUtil.js';

export { splitContents };

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// "Course contents" of the subject, taken from the BS curriculum when the HOD assigned the teacher, shown as a numbered list.
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
      <h3>Course contents <span className="muted small">({items.length} items, from the BS curriculum)</span></h3>
      <NumberedContents text={outline} />
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
