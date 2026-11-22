import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../api/axios.js';
import { useFlash, Alert, Badge, downloadSafe, fmtDateTime } from '../../components/ui.jsx';
import { ProformaSheet, printProforma } from '../../components/ProformaSheet.jsx';

// Marks proforma of ONE subject. 100 marks = 40 internal (assignment 5, quiz 5, attendance 5, presentation 5, midterm 20) + 60 final term.
//   teacher : enters the marks (or fills them from the records of the system), saves, generates the proforma, and sends it to the office
//   HOD     : looks, downloads, and can unlock a sent proforma for correction
//   head    : looks and downloads
// The server calculates totals, grades and pass/fail. AI is never involved.
export default function ProformaTab({ courseId, role }) {
  const [msg, ok, fail] = useFlash();
  const [sheet, setSheet] = useState(null);
  const [edit, setEdit] = useState({}); // studentId -> { assignment: '3', ... } as typed
  const [busy, setBusy] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [to, setTo] = useState({ principal: true, examination: true });
  const [note, setNote] = useState('');
  const sheetRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/proforma/course/${courseId}`);
      const s = data.data;
      setSheet(s);
      const next = {};
      for (const r of s.rows) {
        next[r.student] = {};
        for (const c of s.components) next[r.student][c.key] = r[c.key] === null || r[c.key] === undefined ? '' : String(r[c.key]);
      }
      setEdit(next);
    } catch (e) { fail(e); }
  }, [courseId, fail]);
  useEffect(() => { load(); }, [load]);

  if (!sheet) return <><Alert msg={msg} /><div className="card muted">Loading...</div></>;

  const editable = sheet.canEdit;
  const setCell = (id, key, v) => setEdit({ ...edit, [id]: { ...edit[id], [key]: v } });
  const num = (v) => (v === '' || v === undefined ? null : Number(v));

  // Typed values for the preview columns (not the final numbers: the server calculates those after "Save").
  const live = (id) => {
    const e = edit[id] || {};
    const internal = sheet.components.filter((c) => c.internal).reduce((s, c) => s + (num(e[c.key]) || 0), 0);
    return { internal: Math.round(internal * 100) / 100, total: Math.round((internal + (num(e.finalTerm) || 0)) * 100) / 100 };
  };

  const invalid = () => {
    for (const r of sheet.rows) {
      for (const c of sheet.components) {
        const v = edit[r.student]?.[c.key];
        if (v === '' || v === undefined) continue;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > c.max) return `${r.name}: ${c.label} must be a number from 0 to ${c.max}`;
      }
    }
    return '';
  };

  const save = async (quiet = false) => {
    const bad = invalid();
    if (bad) { fail(bad); return false; }
    setBusy(true);
    try {
      const rows = sheet.rows.map((r) => ({ student: r.student, ...Object.fromEntries(sheet.components.map((c) => [c.key, num(edit[r.student]?.[c.key])])) }));
      const { data } = await api.put(`/proforma/course/${courseId}`, { rows });
      const s = data.data;
      setSheet({ ...sheet, ...s, canEdit: sheet.canEdit, canSubmit: sheet.canSubmit, canUnlock: sheet.canUnlock });
      if (!quiet) ok('Marks saved');
      return true;
    } catch (e) { fail(e); return false; } finally { setBusy(false); }
  };

  // Suggestions from the attendance, quiz, assignment, presentation and examination records. Only EMPTY boxes are filled; the teacher can change everything.
  const fillFromRecords = async () => {
    setBusy(true);
    try {
      const { data } = await api.get(`/proforma/course/${courseId}/suggest`);
      const sug = new Map(data.data.rows.map((r) => [String(r.student), r]));
      let filled = 0;
      const next = { ...edit };
      for (const r of sheet.rows) {
        const s = sug.get(String(r.student));
        if (!s) continue;
        next[r.student] = { ...next[r.student] };
        for (const c of sheet.components) {
          if (next[r.student][c.key] === '' && s[c.key] !== null && s[c.key] !== undefined) { next[r.student][c.key] = String(s[c.key]); filled += 1; }
        }
      }
      setEdit(next);
      const b = data.data.basis;
      ok(filled
        ? `${filled} empty box(es) were filled from the records (${b.attendanceSessions} attendance sessions, ${b.quizzes} quizzes, ${b.assignments} assignments, ${b.presentations} presentations${b.midtermExam ? `, ${b.midtermExam}` : ''}${b.finalExam ? `, ${b.finalExam}` : ''}). Check them, then press Save.`
        : 'Nothing to fill: the records have no new marks for the empty boxes.');
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const generate = async () => {
    if (editable && !(await save(true))) return;
    setShowSheet(true);
    setTimeout(() => sheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const send = async () => {
    const recipients = Object.entries(to).filter(([, v]) => v).map(([k]) => k);
    if (!recipients.length) return fail('Choose at least one recipient');
    if (editable && !(await save(true))) return;
    if (!window.confirm('Send this proforma to the office? The marks are locked afterwards and only your HOD can unlock them.')) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/proforma/course/${courseId}/submit`, { recipients, note: note.trim() || undefined });
      ok(data.message);
      setNote('');
      load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const unlock = async () => {
    if (!window.confirm('Unlock this proforma so the teacher can correct the marks? The teacher must send it again (a new version).')) return;
    try { await api.post(`/proforma/course/${courseId}/unlock`); ok('Proforma unlocked'); load(); } catch (e) { fail(e); }
  };

  const print = () => { if (!printProforma(sheet)) fail('The print window was blocked. Allow pop-ups for this site and try again.'); };
  const internalComps = sheet.components.filter((c) => c.internal);
  const final = sheet.components.find((c) => !c.internal);

  return (
    <>
      <Alert msg={msg} />
      <div className="card">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Marks proforma</h3>
          {sheet.locked ? <Badge value="closed" text="sent and locked" /> : <Badge value="draft" />}
        </div>
        <p className="muted">
          Every subject carries 100 marks: assignment 5, quiz 5, attendance 5, presentation 5, midterm 20 (internal 40) and final term 60.
          {sheet.lastSubmission && <> Last sent: version {sheet.lastSubmission.version} on {fmtDateTime(sheet.lastSubmission.at)}.</>}
        </p>

        {sheet.rows.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Roll no</th><th>Student</th>
                  {internalComps.map((c) => <th key={c.key}>{c.label}<small> /{c.max}</small></th>)}
                  <th>Internal<small> /40</small></th>
                  <th>{final.label}<small> /{final.max}</small></th>
                  <th>Total<small> /100</small></th>
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((r) => {
                  const l = live(r.student);
                  return (
                    <tr key={r.student}>
                      <td>{r.rollNumber}</td><td>{r.name}</td>
                      {[...internalComps, null].map((c) => c && (
                        <td key={c.key} style={{ width: 84 }}>
                          <input type="number" step="0.5" min={0} max={c.max} disabled={!editable} value={edit[r.student]?.[c.key] ?? ''} onChange={(e) => setCell(r.student, c.key, e.target.value)} />
                        </td>
                      ))}
                      <td><b>{l.internal}</b></td>
                      <td style={{ width: 84 }}>
                        <input type="number" step="0.5" min={0} max={final.max} disabled={!editable} value={edit[r.student]?.finalTerm ?? ''} onChange={(e) => setCell(r.student, 'finalTerm', e.target.value)} />
                      </td>
                      <td><b>{l.total}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!sheet.rows.length && <p className="muted">No student is enrolled in this course yet.</p>}

        <div className="actions mt">
          {editable && <button className="btn" disabled={busy} onClick={fillFromRecords}>Fill empty boxes from the records</button>}
          {editable && <button className="btn" disabled={busy} onClick={() => save(false)}>Save marks</button>}
          <button className="btn btn-primary" disabled={busy || !sheet.rows.length} onClick={generate}>Generate proforma</button>
          {sheet.canUnlock && <button className="btn btn-danger" onClick={unlock}>Unlock for correction</button>}
        </div>
        <p className="muted small">
          Totals, grades and pass/fail are calculated by the server from the university grading rules. "Fill from the records" uses the attendance, quizzes,
          assignments, presentations and published examinations of this course as a suggestion only; you decide what is saved. AI never enters marks.
        </p>
      </div>

      {showSheet && (
        <div className="card" ref={sheetRef}>
          <ProformaSheet sheet={sheet} />
          <div className="actions mt">
            <button className="btn" onClick={() => downloadSafe(`/proforma/course/${courseId}/export/pdf`, 'proforma.pdf', fail)}>Download PDF</button>
            <button className="btn" onClick={() => downloadSafe(`/proforma/course/${courseId}/export/xlsx`, 'proforma.xlsx', fail)}>Download Excel</button>
            <button className="btn" onClick={print}>Print</button>
          </div>

          {sheet.canSubmit && (
            <div className="mt">
              <h4>Send to the office</h4>
              <label className="check"><input type="checkbox" checked={to.principal} onChange={(e) => setTo({ ...to, principal: e.target.checked })} /> Principal</label>
              <label className="check"><input type="checkbox" checked={to.examination} onChange={(e) => setTo({ ...to, examination: e.target.checked })} /> Examination Department (the HOD of this department)</label>
              <label>Note (optional)</label>
              <input maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: final term marks checked twice" />
              <div className="actions"><button className="btn btn-primary" disabled={busy || sheet.summary.pending > 0} onClick={send}>Send proforma</button></div>
              {sheet.summary.pending > 0 && <p className="muted small">{sheet.summary.pending} student(s) still have missing marks. All six marks of every student are needed before sending.</p>}
            </div>
          )}
          {sheet.locked && <p className="muted small">This proforma was sent. It is locked; the office keeps the version that was sent even if marks are corrected later.</p>}
        </div>
      )}
    </>
  );
}
