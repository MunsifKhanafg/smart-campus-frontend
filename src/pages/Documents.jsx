import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, FileLink, fmtDateTime } from '../components/ui.jsx';

// Student: upload the documents required for examination admission and see their review status.
// HOD (own department) / University Head: review the uploaded documents.
export default function Documents() {
  const role = useSelector((s) => s.auth.user.role);
  const isStudent = role === 'student';
  const isHod = role === 'hod';
  const [msg, ok, fail] = useFlash();
  const [docs, setDocs] = useState([]);
  const [required, setRequired] = useState([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({ type: '', note: '' });
  const [files, setFiles] = useState(null);
  const [review, setReview] = useState(null); // { doc, status, remarks }

  const load = useCallback(() => {
    const req = isStudent ? api.get('/documents/mine') : api.get('/documents', { params: filter ? { status: filter } : {} });
    req.then((r) => setDocs(r.data.data)).catch(fail);
  }, [isStudent, filter, fail]);
  useEffect(() => { load(); }, [load]);

  // Document names that fee notices ask for, shown as suggestions.
  useEffect(() => {
    if (!isStudent) return;
    api.get('/fees/mine').then((r) => {
      setRequired([...new Set(r.data.data.flatMap((f) => f.requiredDocuments || []))]);
    }).catch(() => {});
  }, [isStudent]);

  const upload = async (e) => {
    e.preventDefault();
    if (!files?.length) return fail('Please choose at least one file');
    const fd = new FormData();
    fd.append('type', form.type);
    if (form.note) fd.append('note', form.note);
    [...files].forEach((f) => fd.append('files', f));
    try {
      await api.post('/documents', fd);
      ok('Document uploaded. Staff will review it.');
      setForm({ type: '', note: '' });
      setFiles(null);
      e.target.reset();
      load();
    } catch (err) { fail(err); }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/documents/${review.doc._id}/review`, { status: review.status, remarks: review.remarks || undefined });
      ok('Review saved. The student has been notified.');
      setReview(null);
      load();
    } catch (err) { fail(err); }
  };

  return (
    <>
      <h1>{isStudent ? 'My Documents' : 'Student Documents'}</h1>
      <Alert msg={msg} />

      {isStudent && (
        <form className="card" onSubmit={upload}>
          <h3>Upload a document</h3>
          <div className="form-grid">
            <div>
              <label>Document type</label>
              <input required list="doc-types" placeholder="e.g. transcript" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
              <datalist id="doc-types">{required.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div><label>Note (optional)</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            <div><label>Files (PDF, DOCX, image; max 8 MB each)</label><input type="file" multiple required onChange={(e) => setFiles(e.target.files)} /></div>
          </div>
          <button className="btn btn-primary">Upload</button>
          {required.length > 0 && <p className="muted small">Documents requested by your fee notices: {required.join(', ')}</p>}
        </form>
      )}

      {!isStudent && (
        <div className="card filters">
          <div>
            <label>Status</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="requires_correction">Requires correction</option>
            </select>
          </div>
        </div>
      )}

      {review && isHod && (
        <form className="card" onSubmit={submitReview}>
          <h3>Review: {review.doc.type} ({review.doc.studentName})</h3>
          <div className="form-grid">
            <div>
              <label>Decision</label>
              <select value={review.status} onChange={(e) => setReview({ ...review, status: e.target.value })}>
                <option value="approved">Approve</option>
                <option value="requires_correction">Requires correction</option>
                <option value="rejected">Reject</option>
              </select>
            </div>
          </div>
          <label>Remarks {review.status !== 'approved' && '(required, the student will read this)'}</label>
          <textarea rows={2} value={review.remarks} onChange={(e) => setReview({ ...review, remarks: e.target.value })} />
          <div className="actions">
            <button className="btn btn-primary">Save review</button>
            <button type="button" className="btn btn-ghost mt" onClick={() => setReview(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr>{!isStudent && <th>Student</th>}<th>Type</th><th>Files</th><th>Uploaded</th><th>Status</th><th>Remarks</th>{isHod && <th />}</tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d._id}>
                {!isStudent && <td>{d.studentName}<div className="muted small">{d.rollNumber}</div></td>}
                <td>{d.type}{d.note && <div className="muted small">{d.note}</div>}</td>
                <td>{d.files.map((f) => <FileLink key={f.storedName} path={`/documents/${d._id}/files/${f.storedName}`} name={f.originalName} onError={fail} />)}</td>
                <td>{fmtDateTime(d.createdAt)}</td>
                <td><Badge value={d.status} /></td>
                <td className="small">{d.remarks || '—'}</td>
                {isHod && <td><button className="btn btn-small" onClick={() => setReview({ doc: d, status: 'approved', remarks: '' })}>Review</button></td>}
              </tr>
            ))}
            {!docs.length && <tr><td colSpan={7} className="muted">No documents.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
