import { useRef, useState } from 'react';
import api from '../../api/axios.js';
import ScanButton from '../../components/ScanButton.jsx';
import { Badge, label } from '../../components/ui.jsx';
import { LoanActions, LoanState, Charges, useMoney } from './common.jsx';

// The desk: one scan box for everything (a book copy barcode, a book ID / ISBN, or a student roll number), plus the issue and return forms.
// A USB scanner types the code and presses Enter, so it works in every box. The camera button reads barcodes and QR codes on a phone.
export default function Desk({ ok, fail }) {
  const m = useMoney();
  const [code, setCode] = useState('');
  const [found, setFound] = useState(null);
  const [issue, setIssue] = useState({ student: '', code: '', days: '' });
  const [ret, setRet] = useState({ code: '', condition: 'good', damageFee: '', note: '' });
  const [busy, setBusy] = useState(false);
  const scanBox = useRef(null);
  const lastCode = useRef('');

  const lookup = async (raw) => {
    const value = String(raw ?? code).trim();
    if (!value) return;
    lastCode.current = value;
    try {
      const { data } = await api.get('/library/lookup', { params: { code: value } });
      const r = data.data;
      setFound(r);
      // The result fills the forms below, so the next step is one click.
      if (r.type === 'student') setIssue((s) => ({ ...s, student: r.student.rollNumber }));
      if (r.type === 'copy') {
        if (r.copy.status === 'issued') setRet((s) => ({ ...s, code: r.copy.code }));
        else setIssue((s) => ({ ...s, code: r.copy.code }));
      }
      if (r.type === 'book') setIssue((s) => ({ ...s, code: r.book.bookId }));
      setCode('');
      scanBox.current?.focus();
    } catch (e) { setFound(null); fail(e); }
  };
  const refresh = () => (lastCode.current ? lookup(lastCode.current) : setFound(null));

  const doIssue = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { student: issue.student, code: issue.code, ...(issue.days ? { days: Number(issue.days) } : {}) };
      const { data } = await api.post('/library/issue', body);
      ok(data.message);
      setIssue({ student: issue.student, code: '', days: '' }); // the same student often takes several books: keep the roll number
      refresh();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const doReturn = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/library/return', { code: ret.code, condition: ret.condition, damageFee: Number(ret.damageFee) || 0, note: ret.note });
      ok(data.message);
      setRet({ code: '', condition: 'good', damageFee: '', note: '' });
      refresh();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const enter = (fn) => (e) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } };

  return (
    <>
      <div className="card lib-result">
        <h3>Scan or search</h3>
        <p className="muted small">Scan a book barcode, or type a Book ID, ISBN or student roll number. The result shows what it is and fills the forms below.</p>
        <div className="lib-scan">
          <input ref={scanBox} autoFocus value={code} placeholder="Scan or type here, then press Enter" onChange={(e) => setCode(e.target.value)} onKeyDown={enter(() => lookup())} aria-label="Scan or type a code" />
          <button type="button" className="btn btn-primary" onClick={() => lookup()}>Find</button>
          <ScanButton onCode={(c) => lookup(c)} />
        </div>

        {found?.type === 'copy' && (
          <div style={{ marginTop: '.75rem' }}>
            <h4 style={{ margin: 0 }}>{found.book?.title}</h4>
            <dl className="lib-kv">
              <dt>Copy</dt><dd><code>{found.copy.code}</code> · <Badge value={found.copy.status} /></dd>
              <dt>Book</dt><dd>{found.book?.bookId} · {found.book?.category} · shelf {found.book?.shelf || '—'}</dd>
              {found.copy.note && <><dt>Note</dt><dd>{found.copy.note}</dd></>}
              {found.heldFor && <><dt>Held for</dt><dd>{found.heldFor.name} · {found.heldFor.rollNumber} until {found.heldFor.holdUntilDay}</dd></>}
            </dl>
            {found.loan && (
              <div className="sub-card">
                <div><b>{found.loan.student?.name}</b> · {found.loan.rollNumber} — issued {found.loan.issuedDay}, due <b>{found.loan.dueDay}</b> <LoanState loan={found.loan} /></div>
                <Charges loan={found.loan} />
                <LoanActions loan={found.loan} run onDone={refresh} ok={ok} fail={fail} />
              </div>
            )}
          </div>
        )}

        {found?.type === 'book' && (
          <div style={{ marginTop: '.75rem' }}>
            <h4 style={{ margin: 0 }}>{found.book.title}</h4>
            <p>{(found.book.authors || []).join(', ')} · {found.book.bookId} · shelf {found.book.shelf || '—'}</p>
            <p><b>{found.book.copiesAvailable}</b> of {found.book.copiesTotal} copies available</p>
          </div>
        )}

        {found?.type === 'student' && (
          <div style={{ marginTop: '.75rem' }}>
            <h4 style={{ margin: 0 }}>{found.student.name} · {found.student.rollNumber}</h4>
            <p className="muted">{found.student.department?.name} · {found.student.semester} · phone {found.student.hasPhone ? found.student.phone : 'not registered (no SMS can be sent)'}</p>
            <p>Books out <b>{found.totals.active}</b> · overdue <b className={found.totals.overdue ? 'lib-state-overdue' : ''}>{found.totals.overdue}</b> · fine to pay <b>{m(found.totals.pending)}</b></p>
            {found.current.map((l) => (
              <div className="sub-card" key={l._id}>
                <div><b>{l.book?.title}</b> <code>{l.copyCode}</code> — due {l.dueDay} <LoanState loan={l} /></div>
                <Charges loan={l} />
                <LoanActions loan={l} run onDone={refresh} ok={ok} fail={fail} />
              </div>
            ))}
            {!found.current.length && <p className="muted">This student has no book at the moment.</p>}
          </div>
        )}
      </div>

      <div className="lib-panels">
        <form className="card" onSubmit={doIssue}>
          <h3>Issue a book</h3>
          <label>Student roll number</label>
          <div className="lib-scan">
            <input required value={issue.student} onChange={(e) => setIssue({ ...issue, student: e.target.value })} placeholder="e.g. CS-S1-03" />
            <ScanButton onCode={(c) => setIssue((s) => ({ ...s, student: c }))} />
          </div>
          <label>Book copy barcode (or Book ID / ISBN)</label>
          <div className="lib-scan">
            <input required value={issue.code} onChange={(e) => setIssue({ ...issue, code: e.target.value })} placeholder="e.g. LB-000012-01" />
            <ScanButton onCode={(c) => setIssue((s) => ({ ...s, code: c }))} />
          </div>
          <label>Loan days (empty = the library rule)</label>
          <input type="number" min={1} max={120} value={issue.days} onChange={(e) => setIssue({ ...issue, days: e.target.value })} />
          <p className="muted small">The return date is calculated from the day of issue. The student gets an SMS with the date, using the phone number in the student record.</p>
          <div className="actions"><button className="btn btn-primary" disabled={busy}>Issue book</button></div>
        </form>

        <form className="card" onSubmit={doReturn}>
          <h3>Receive a returned book</h3>
          <label>Book copy barcode</label>
          <div className="lib-scan">
            <input required value={ret.code} onChange={(e) => setRet({ ...ret, code: e.target.value })} placeholder="e.g. LB-000012-01" />
            <ScanButton onCode={(c) => setRet((s) => ({ ...s, code: c }))} />
          </div>
          <div className="form-grid">
            <div><label>Condition</label><select value={ret.condition} onChange={(e) => setRet({ ...ret, condition: e.target.value })}><option value="good">{label('good')}</option><option value="damaged">{label('damaged')}</option></select></div>
            {ret.condition === 'damaged' && <div><label>Damage charge</label><input type="number" min={0} step="any" value={ret.damageFee} onChange={(e) => setRet({ ...ret, damageFee: e.target.value })} /></div>}
          </div>
          <label>Note (optional)</label>
          <input maxLength={300} value={ret.note} onChange={(e) => setRet({ ...ret, note: e.target.value })} />
          <p className="muted small">The late fine is calculated automatically. Reminders for this book stop at once, and a student waiting for it is told that it is ready.</p>
          <div className="actions"><button className="btn btn-primary" disabled={busy}>Receive book</button></div>
        </form>
      </div>
    </>
  );
}
