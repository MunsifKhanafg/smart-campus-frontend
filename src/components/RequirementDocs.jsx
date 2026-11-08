import { useState } from 'react';
import api from '../api/axios.js';

const TEXT = {
  approved: 'approved',
  pending: 'uploaded, waiting for review',
  requires_correction: 'needs correction, upload again',
  rejected: 'rejected, upload again',
  received_at_office: 'received at the office',
  missing: 'not uploaded yet',
};
const BAD = ['missing', 'rejected', 'requires_correction'];

// The required documents of the fees in the cart, with the upload right here. The student fills the requirements (mobile number
// and documents) and pays on the same page, without leaving to the Documents page.
export default function RequirementDocs({ documents, onUploaded, ok, fail }) {
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState('');

  const upload = async (type) => {
    const file = files[type];
    if (!file) return fail('Choose a photo or PDF first');
    const fd = new FormData();
    fd.append('type', type);
    fd.append('files', file);
    setBusy(type);
    try {
      await api.post('/documents', fd);
      ok(`${type} uploaded`);
      setFiles((f) => ({ ...f, [type]: null }));
      await onUploaded();
    } catch (err) {
      fail(err);
    } finally {
      setBusy('');
    }
  };

  return documents.map((d) => (
    <div key={d.type} style={{ padding: '.4rem 0', borderBottom: '1px solid var(--border)' }}>
      <div className="row-between">
        <span>📄 {d.type}</span>
        <span className={`badge ${d.status === 'approved' ? 'approved' : BAD.includes(d.status) ? 'rejected' : 'pending'}`}>{TEXT[d.status] || d.status}</span>
      </div>
      {BAD.includes(d.status) && (
        <div className="inline-form" style={{ marginTop: '.3rem' }}>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFiles({ ...files, [d.type]: e.target.files[0] || null })} />
          <button type="button" className="btn btn-small btn-primary" disabled={busy === d.type || !files[d.type]} onClick={() => upload(d.type)}>
            {busy === d.type ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      )}
    </div>
  ));
}
