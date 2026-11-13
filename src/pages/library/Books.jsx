import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios.js';
import { Badge, label } from '../../components/ui.jsx';
import { useConfirm } from '../../components/ConfirmModal.jsx';
import { Pager, clean, useMoney } from './common.jsx';

const EMPTY = { bookId: '', title: '', authors: '', isbn: '', category: '', publisher: '', edition: '', year: '', language: 'English', pages: '', shelf: '', description: '', price: '', department: '', semesterNumber: '', copies: 1 };

// The catalogue: search, add, edit and remove books, their categories, authors, shelf and price, and every physical copy (barcode, status, who has it).
// The principal sees the same list read-only (run = false).
export default function Books({ run, ok, fail, go }) {
  const confirm = useConfirm();
  const m = useMoney();
  const [f, setF] = useState({ q: '', category: '', available: '', semester: '', status: 'active' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [cats, setCats] = useState([]);
  const [depts, setDepts] = useState([]);
  const [form, setForm] = useState(null); // { id?, ...fields }
  const [detail, setDetail] = useState(null); // { book, copies }
  const [add, setAdd] = useState({ count: 1, note: '' });

  const load = useCallback(() => {
    api.get('/library/books', { params: { ...clean(f), page, limit: 20 } }).then((r) => setData(r.data.data)).catch(fail);
  }, [f, page, fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/library/categories').then((r) => setCats(r.data.data)).catch(() => {});
    api.get('/departments').then((r) => setDepts(r.data.data.filter((d) => d.status === 'active'))).catch(() => {});
  }, []);

  const open = async (id) => {
    try { setDetail((await api.get(`/library/books/${id}`)).data.data); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { fail(e); }
  };
  const refresh = () => { load(); if (detail) open(detail.book._id); };

  const edit = (b) => setForm({
    id: b._id, bookId: b.bookId, title: b.title, authors: (b.authors || []).join(', '), isbn: b.isbn || '', category: b.category, publisher: b.publisher || '', edition: b.edition || '',
    year: b.year ?? '', language: b.language || 'English', pages: b.pages ?? '', shelf: b.shelf || '', description: b.description || '', price: b.price ?? '', department: b.department?._id || '', semesterNumber: b.semesterNumber ?? '',
  });

  const save = async (e) => {
    e.preventDefault();
    const { id, ...body } = form;
    if (!id) { body.copies = Number(body.copies) || 1; } else { delete body.copies; delete body.bookId; }
    try {
      const { data: res } = id ? await api.put(`/library/books/${id}`, body) : await api.post('/library/books', body);
      ok(res.message);
      setForm(null);
      load();
      api.get('/library/categories').then((r) => setCats(r.data.data)).catch(() => {});
    } catch (err) { fail(err); }
  };

  const remove = async (b) => {
    const yes = await confirm({ tone: 'danger', title: `Remove "${b.title}"?`, message: 'The book leaves the catalogue. Its loan history is kept. A book that is still issued cannot be removed.', confirmText: 'Remove book' });
    if (!yes) return;
    try { const { data: res } = await api.delete(`/library/books/${b._id}`); ok(res.message); if (detail?.book._id === b._id) setDetail(null); load(); } catch (err) { fail(err); }
  };

  const addCopies = async (e) => {
    e.preventDefault();
    try { const { data: res } = await api.post(`/library/books/${detail.book._id}/copies`, { count: Number(add.count) || 1, note: add.note }); ok(res.message); setAdd({ count: 1, note: '' }); refresh(); } catch (err) { fail(err); }
  };

  const copyStatus = async (c, status) => {
    const note = ['lost', 'damaged', 'withdrawn'].includes(status) ? window.prompt(`Note for ${c.code} (what happened?)`, c.note || '') : c.note;
    if (note === null) return;
    try { const { data: res } = await api.patch(`/library/copies/${c._id}/status`, { status, note: note || undefined }); ok(res.message); refresh(); } catch (err) { fail(err); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      {run && !form && <div className="row-between"><span /><button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>+ Add book</button></div>}

      {form && (
        <form className="card" onSubmit={save}>
          <h3>{form.id ? `Edit "${form.title}"` : 'Add a book'}</h3>
          <div className="form-grid">
            <div><label>Title</label><input required maxLength={250} value={form.title} onChange={set('title')} /></div>
            <div><label>Author(s), comma separated</label><input value={form.authors} onChange={set('authors')} placeholder="Robert C. Martin" /></div>
            <div>
              <label>Category</label>
              <input required list="lib-cats" maxLength={80} value={form.category} onChange={set('category')} placeholder="Choose or type a new one" />
              <datalist id="lib-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            {!form.id && <div><label>Book ID (empty = automatic)</label><input maxLength={30} value={form.bookId} onChange={set('bookId')} placeholder="LB-000012" /></div>}
            <div><label>ISBN</label><input maxLength={20} value={form.isbn} onChange={set('isbn')} /></div>
            <div><label>Publisher</label><input maxLength={120} value={form.publisher} onChange={set('publisher')} /></div>
            <div><label>Edition</label><input maxLength={40} value={form.edition} onChange={set('edition')} /></div>
            <div><label>Year</label><input type="number" min={1000} max={2200} value={form.year} onChange={set('year')} /></div>
            <div><label>Language</label><input maxLength={40} value={form.language} onChange={set('language')} /></div>
            <div><label>Pages</label><input type="number" min={1} value={form.pages} onChange={set('pages')} /></div>
            <div><label>Shelf / rack</label><input maxLength={60} value={form.shelf} onChange={set('shelf')} placeholder="Rack B-3" /></div>
            <div><label>Price (used if a copy is lost)</label><input type="number" min={0} step="any" value={form.price} onChange={set('price')} /></div>
            <div>
              <label>Department (optional)</label>
              <select value={form.department} onChange={set('department')}><option value="">All / general</option>{depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select>
            </div>
            <div>
              <label>Semester (up to 30 books each)</label>
              <select value={form.semesterNumber} onChange={set('semesterNumber')}><option value="">Not for one semester</option>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>Semester {n}</option>)}</select>
            </div>
            {!form.id && <div><label>Number of copies</label><input type="number" min={1} max={200} required value={form.copies} onChange={set('copies')} /></div>}
          </div>
          <label>Description (optional)</label>
          <textarea rows={2} maxLength={1500} value={form.description} onChange={set('description')} />
          {!form.id && <p className="muted small">Every copy gets its own barcode (for example LB-000012-01). Print the labels from the Barcode Labels tab.</p>}
          <div className="actions"><button className="btn btn-primary">{form.id ? 'Save changes' : 'Add book'}</button><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      {detail && (
        <div className="card lib-result">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>{detail.book.title}</h3>
            <button className="btn btn-small btn-ghost" onClick={() => setDetail(null)}>Close</button>
          </div>
          <p className="muted">{(detail.book.authors || []).join(', ')} · {detail.book.bookId} · {detail.book.category} · shelf {detail.book.shelf || '—'} · price {m(detail.book.price)}</p>
          <p>
            Total <b>{detail.book.copiesTotal}</b> · available <b>{detail.book.copiesAvailable}</b> · issued <b>{detail.book.copiesIssued}</b> · reserved <b>{detail.book.copiesReserved}</b> · lost <b>{detail.book.copiesLost}</b> · damaged <b>{detail.book.copiesDamaged}</b>
          </p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Copy (barcode)</th><th>Status</th><th>Issued to</th><th>Note</th>{run && <th />}</tr></thead>
              <tbody>
                {detail.copies.map((c) => (
                  <tr key={c._id}>
                    <td><code>{c.code}</code></td>
                    <td><Badge value={c.status} /></td>
                    <td>{c.issuedTo ? <>{c.issuedTo.name} · {c.issuedTo.rollNumber}<div className={c.issuedTo.overdue ? 'lib-state-overdue small' : 'muted small'}>due {c.issuedTo.dueDay}{c.issuedTo.overdue ? ' (overdue)' : ''}</div></> : '—'}</td>
                    <td>{c.note}</td>
                    {run && (
                      <td className="actions">
                        {!['issued', 'withdrawn'].includes(c.status) && ['available', 'damaged', 'lost', 'withdrawn'].filter((s) => s !== c.status).map((s) => (
                          <button key={s} className="btn btn-small" onClick={() => copyStatus(c, s)}>{s === 'available' ? 'Mark available' : `Mark ${label(s)}`}</button>
                        ))}
                        {c.status === 'withdrawn' && <button className="btn btn-small" onClick={() => copyStatus(c, 'available')}>Put back</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {run && (
            <form className="inline-form" onSubmit={addCopies} style={{ marginTop: '.75rem' }}>
              <div><label>Add copies</label><input type="number" min={1} max={200} value={add.count} onChange={(e) => setAdd({ ...add, count: e.target.value })} style={{ width: 90 }} /></div>
              <div style={{ flex: 1 }}><label>Note (optional)</label><input maxLength={300} value={add.note} onChange={(e) => setAdd({ ...add, note: e.target.value })} /></div>
              <button className="btn btn-primary">Add</button>
              <button type="button" className="btn" onClick={() => go('labels', { book: detail.book._id })}>Print labels</button>
            </form>
          )}
        </div>
      )}

      <div className="card filters">
        <input placeholder="Search title, author, ISBN, Book ID or category..." value={f.q} onChange={(e) => { setPage(1); setF({ ...f, q: e.target.value }); }} />
        <select value={f.category} onChange={(e) => { setPage(1); setF({ ...f, category: e.target.value }); }}><option value="">All categories</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select value={f.available} onChange={(e) => { setPage(1); setF({ ...f, available: e.target.value }); }}><option value="">All books</option><option value="true">Available now</option></select>
        <select value={f.semester} onChange={(e) => { setPage(1); setF({ ...f, semester: e.target.value }); }}><option value="">All semesters</option>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>Semester {n}</option>)}</select>
        {run && <select value={f.status} onChange={(e) => { setPage(1); setF({ ...f, status: e.target.value }); }}><option value="active">In the library</option><option value="removed">Removed</option><option value="all">All</option></select>}
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Book ID</th><th>Title</th><th>Category</th><th>Semester</th><th>Shelf</th><th>Copies</th><th>Available</th><th>Issued</th><th>Lost / damaged</th><th /></tr></thead>
          <tbody>
            {data.items.map((b) => (
              <tr key={b._id}>
                <td>{b.bookId}</td>
                <td><b>{b.title}</b><div className="muted small">{(b.authors || []).join(', ')}{b.isbn ? ` · ISBN ${b.isbn}` : ''}</div>{b.status === 'removed' && <span className="badge archived">removed</span>}</td>
                <td>{b.category}</td><td>{b.semesterNumber || '—'}</td><td>{b.shelf || '—'}</td><td>{b.copiesTotal}</td>
                <td className={b.copiesAvailable ? '' : 'lib-state-overdue'}>{b.copiesAvailable}</td>
                <td>{b.copiesIssued}</td><td>{b.copiesLost} / {b.copiesDamaged}</td>
                <td className="actions">
                  <button className="btn btn-small" onClick={() => open(b._id)}>Copies</button>
                  {run && b.status === 'active' && <button className="btn btn-small" onClick={() => edit(b)}>Edit</button>}
                  {run && b.status === 'active' && <button className="btn btn-small btn-danger" onClick={() => remove(b)}>Remove</button>}
                </td>
              </tr>
            ))}
            {!data.items.length && <tr><td colSpan={10} className="muted">No books found.</td></tr>}
          </tbody>
        </table>
        <Pager page={page} pages={data.pages} total={data.total} onPage={setPage} />
      </div>
    </>
  );
}
