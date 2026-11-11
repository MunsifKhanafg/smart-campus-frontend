import { useState } from 'react';
import api from '../api/axios.js';
import NumberedContents from './NumberedContents.jsx';
import { splitContents } from './contentsUtil.js';

export { splitContents };

// "Course contents" of the subject, taken from the BS curriculum when the HOD assigned the teacher, shown as a numbered list.
// One click turns the numbered contents into topics and the smart scheduler gives every class 2 to 3 of them, on the real
// teaching days of this teacher (weekly schedule, holidays, exams and vacations are skipped) so the course ends inside the semester.
export default function ContentsCard({ outline, courseId, canEdit, topicCount, onCreated, ok, fail }) {
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
    const warn = topicCount > 0 ? `\n\nThis course already has ${topicCount} topic(s). The new ones are added after them and the whole plan is arranged again.` : '';
    if (!window.confirm(`Create ${items.length} numbered topics from the course contents and plan them over your teaching days (2 to 3 topics per class)?${warn}`)) return;
    setBusy(true);
    try {
      const r = await api.post(`/teaching-calendar/course/${courseId}/schedule`, { titles: items });
      ok(r.data.message || `${items.length} topics planned`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
      onCreated();
    }
  };

  return (
    <div className="card">
      <h3>Course contents <span className="muted small">({items.length} items, from the BS curriculum)</span></h3>
      <NumberedContents text={outline} />
      {canEdit && items.length > 0 && (
        <div className="inline-form">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={create}>
            {busy ? 'Planning…' : `Plan ${items.length} topics over the semester`}
          </button>
        </div>
      )}
    </div>
  );
}
