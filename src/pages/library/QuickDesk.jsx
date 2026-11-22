import { useState } from 'react';
import api from '../../api/axios.js';
import ScanButton from '../../components/ScanButton.jsx';
import { Badge } from '../../components/ui.jsx';
import { LoanState, useMoney } from './common.jsx';
import './library-desk.css';

// The fast way to work at the desk, in three steps:
//   1. Scan (camera, USB scanner) or type the student's ID card / Student ID  -> the student's details appear.
//   2. Scan or type the book's barcode / QR code / Book ID                       -> the book's details appear.
//   3. The panel shows what will happen (issue or return) and one button confirms it.
// A code can be given to either side: the server tells what it is (student, copy or title) and the panel puts it in the right place.
// It uses the same library API as the forms below (lookup, issue, return), so every rule and every record stays in one place.
const lookupCode = (code) => api.get('/library/lookup', { params: { code: String(code).trim() } }).then((r) => r.data.data);

export default function QuickDesk({ ok, fail }) {
  const m = useMoney();
  const [student, setStudent] = useState(null);
  const [item, setItem] = useState(null);
  const [studentText, setStudentText] = useState('');
  const [bookText, setBookText] = useState('');
  const [condition, setCondition] = useState('good');
  const [damageFee, setDamageFee] = useState('');
  const [busy, setBusy] = useState(false);

  const take = async (raw) => {
    const value = String(raw ?? '').trim();
    if (!value) return;
    try {
      const r = await lookupCode(value);
      if (r.type === 'student') { setStudent(r); setStudentText(''); } else { setItem(r); setBookText(''); setCondition('good'); setDamageFee(''); }
    } catch (e) { fail(e); }
  };
  const enter = (text) => (e) => { if (e.key === 'Enter') { e.preventDefault(); take(text); } };

  const refreshStudent = async () => {
    if (!student) return;
    try { setStudent(await lookupCode(student.student.rollNumber)); } catch { /* the old details stay */ }
  };

  const copy = item?.type === 'copy' ? item : null;
  const title = item?.book;
  const returning = copy?.copy.status === 'issued' && !!copy.loan;
  const heldForThisStudent = copy?.copy.status === 'reserved' && student && copy.heldFor?.rollNumber === student.student.rollNumber;
  const freeToIssue = item?.type === 'book' ? item.book.copiesAvailable > 0 : copy?.copy.status === 'available' || heldForThisStudent;

  const issue = async () => {
    setBusy(true);
    try {
      const code = copy ? copy.copy.code : item.book.bookId;
      const { data } = await api.post('/library/issue', { student: student.student.rollNumber, code });
      ok(data.message);
      setItem(null);
      await refreshStudent(); // the student keeps their place: the same student often takes several books
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const giveBack = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/library/return', { code: copy.copy.code, condition, damageFee: Number(damageFee) || 0 });
      ok(data.message);
      setItem(null);
      await refreshStudent();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const clear = () => { setStudent(null); setItem(null); setStudentText(''); setBookText(''); };

  let hint = '';
  if (!student && !item) hint = 'Start by scanning the student ID card or the book.';
  else if (item && !student && !returning) hint = 'Now scan the student ID card or type the Student ID.';
  else if (student && !item) hint = 'Now scan the book, or type its barcode, Book ID or ISBN.';
  else if (copy && !returning && !freeToIssue) hint = copy.copy.status === 'reserved' ? 'This copy is held for another student.' : `This copy is ${copy.copy.status} and cannot be issued.`;
  else if (item?.type === 'book' && !freeToIssue) hint = 'Every copy of this book is out. Write the student down in the Reservations tab.';

  return (
    <div className="card qd">
      <div className="row-between">
        <div>
          <h3 style={{ margin: 0 }}>Scan &amp; confirm</h3>
          <p className="muted small" style={{ margin: '.15rem 0 0' }}>Scan the student ID card and the book, check the details, then confirm with one click. Typing works too.</p>
        </div>
        {(student || item) && <button type="button" className="btn btn-small btn-ghost" onClick={clear}>Start over</button>}
      </div>

      <div className="qd-grid">
        <section className={`qd-side ${student ? 'filled' : ''}`}>
          <h4>1 · Student</h4>
          <div className="lib-scan">
            <input value={studentText} placeholder="Student ID, e.g. CS-S1-03" onChange={(e) => setStudentText(e.target.value)} onKeyDown={enter(studentText)} aria-label="Student ID" />
            <button type="button" className="btn btn-primary" onClick={() => take(studentText)}>Find</button>
            <ScanButton onCode={take} text="📷 Scan ID" title="Scan the student ID card" heading="Scan the student ID card" hint="Hold the barcode or QR code of the ID card in front of the camera." />
          </div>
          {student ? (
            <div className="qd-detail">
              <b className="qd-title">{student.student.name}</b>
              <div className="muted">{student.student.rollNumber} · {student.student.department?.name || '—'}{student.student.semester ? ` · ${student.student.semester}` : ''}</div>
              <div className="qd-facts">
                <span><b>{student.totals.active}</b> book{student.totals.active === 1 ? '' : 's'} out</span>
                <span className={student.totals.overdue ? 'lib-state-overdue' : ''}><b>{student.totals.overdue}</b> overdue</span>
                <span>Fine to pay <b>{m(student.totals.pending)}</b></span>
              </div>
              {student.current.map((l) => (
                <div className="qd-loan" key={l._id}><span>{l.book?.title}</span><span className="muted small">due {l.dueDay}</span> <LoanState loan={l} /></div>
              ))}
            </div>
          ) : <p className="muted small">The student's details appear here.</p>}
        </section>

        <section className={`qd-side ${item ? 'filled' : ''}`}>
          <h4>2 · Book</h4>
          <div className="lib-scan">
            <input value={bookText} placeholder="Barcode, Book ID or ISBN" onChange={(e) => setBookText(e.target.value)} onKeyDown={enter(bookText)} aria-label="Book code" />
            <button type="button" className="btn btn-primary" onClick={() => take(bookText)}>Find</button>
            <ScanButton onCode={take} text="📷 Scan Book" title="Scan the book" heading="Scan the book" hint="Hold the barcode or QR code on the book in front of the camera." />
          </div>
          {item ? (
            <div className="qd-detail">
              <b className="qd-title">{title?.title}</b>
              <div className="muted">{(title?.authors || []).join(', ') || 'Unknown author'}</div>
              <div className="qd-facts">
                <span>{title?.bookId}</span>
                {title?.category && <span>{title.category}</span>}
                <span>Shelf {title?.shelf || '—'}</span>
              </div>
              {copy ? (
                <div className="qd-facts"><span>Copy <code>{copy.copy.code}</code></span><Badge value={copy.copy.status} /></div>
              ) : (
                <div className="qd-facts"><span><b>{item.book.copiesAvailable}</b> of {item.book.copiesTotal} copies available</span></div>
              )}
              {returning && (
                <div className="qd-loan">
                  <span>Issued to <b>{copy.loan.student?.name}</b> ({copy.loan.rollNumber})</span>
                  <span className="muted small">issued {copy.loan.issuedDay} · due {copy.loan.dueDay}</span> <LoanState loan={copy.loan} />
                </div>
              )}
            </div>
          ) : <p className="muted small">The book's details appear here.</p>}
        </section>
      </div>

      <div className="qd-confirm">
        {returning ? (
          <>
            <div className="qd-sum">
              <b>Return</b> “{title?.title}” from <b>{copy.loan.student?.name}</b>
              {copy.loan.state === 'overdue' && <span className="lib-state-overdue"> · late fine so far {m(copy.loan.fine)}</span>}
            </div>
            <div className="qd-return-opts">
              <select value={condition} onChange={(e) => setCondition(e.target.value)} aria-label="Condition of the book"><option value="good">In good condition</option><option value="damaged">Damaged</option></select>
              {condition === 'damaged' && <input type="number" min={0} step="any" value={damageFee} onChange={(e) => setDamageFee(e.target.value)} placeholder="Damage charge" aria-label="Damage charge" />}
              <button type="button" className="btn btn-primary" disabled={busy} onClick={giveBack}>{busy ? 'Saving…' : 'Confirm return'}</button>
            </div>
          </>
        ) : student && item && freeToIssue ? (
          <>
            <div className="qd-sum"><b>Issue</b> “{title?.title}” to <b>{student.student.name}</b> ({student.student.rollNumber}). The return date is set by the library rules.</div>
            <div className="qd-return-opts"><button type="button" className="btn btn-primary" disabled={busy} onClick={issue}>{busy ? 'Saving…' : 'Confirm issue'}</button></div>
          </>
        ) : <div className="qd-sum muted">{hint}</div>}
      </div>
    </div>
  );
}
