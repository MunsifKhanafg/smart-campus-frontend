import { useEffect, useState } from 'react';
import api from '../../api/axios.js';
import Barcode from '../../components/Barcode.jsx';
import { clean } from './common.jsx';

// Barcode labels for the copies: one label per copy (Code 128 of the copy code). Print them and stick them in the books.
// The desk reads them with a USB scanner or the camera. Open it from a book ("Print labels") to print only that title.
export default function Labels({ fail, init = {} }) {
  const [labels, setLabels] = useState(null);
  const [q, setQ] = useState('');
  const book = init.book || '';

  useEffect(() => {
    setLabels(null);
    api.get('/library/labels', { params: clean({ book }) }).then((r) => setLabels(r.data.data)).catch(fail);
  }, [book, fail]);

  const term = q.trim().toLowerCase();
  const shown = (labels || []).filter((l) => !term || l.code.toLowerCase().includes(term) || l.title.toLowerCase().includes(term) || l.bookId.toLowerCase().includes(term));

  return (
    <>
      <div className="card filters lib-noprint">
        <input placeholder="Filter by title, Book ID or copy code..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn btn-primary" disabled={!shown.length} onClick={() => window.print()}>🖨 Print {shown.length} label{shown.length === 1 ? '' : 's'}</button>
        {book && <span className="muted small">Showing the copies of one book. Open "Barcode Labels" from the menu tab to see all.</span>}
      </div>
      {labels === null && <div className="card muted">Loading...</div>}
      {labels && !shown.length && <div className="card muted">No labels. Add a book first.</div>}
      <div className="lib-labels">
        {shown.map((l) => (
          <div className="lib-label" key={l.code}>
            <Barcode value={l.code} />
            <code>{l.code}</code>
            <b title={l.title}>{l.title}</b>
            {l.shelf && <small>{l.shelf}</small>}
          </div>
        ))}
      </div>
      {labels?.length >= 600 && <p className="muted small lib-noprint">Only the first 600 labels are shown. Open a single book to print its labels, or use the filter.</p>}
    </>
  );
}
