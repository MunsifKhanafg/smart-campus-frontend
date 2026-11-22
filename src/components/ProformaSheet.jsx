import { Badge } from './ui.jsx';
import './proforma.css';

// The marks proforma of ONE subject, as a sheet: header details, a row for every student, totals and grades.
// Used on the course page (preview), on the office page (what was received) and by the print button.
// Every number comes from the server (totals, grades and pass/fail are never calculated in the browser).

const shown = (v) => (v === null || v === undefined ? '-' : v);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function ProformaSheet({ sheet }) {
  const s = sheet.summary;
  return (
    <div className="proforma-sheet">
      <div className="proforma-head">
        <h3 style={{ margin: 0 }}>{sheet.university?.name}</h3>
        {sheet.university?.campus && <div className="muted">{sheet.university.campus}</div>}
        <h4 style={{ margin: '.5rem 0 0' }}>MARKS PROFORMA{sheet.locked ? '' : ' (DRAFT)'}{sheet.version ? ` · version ${sheet.version}` : ''}</h4>
      </div>
      <div className="proforma-info">
        <div><span className="muted">Department</span><b>{sheet.department?.name || '-'}</b></div>
        <div><span className="muted">Semester</span><b>{sheet.semester ? `${sheet.semester.name} (${sheet.semester.academicYear})` : '-'}</b></div>
        <div><span className="muted">Subject</span><b>{sheet.course.code} · {sheet.course.title}</b></div>
        <div><span className="muted">Teacher</span><b>{sheet.teacher?.name || '-'}</b></div>
        <div><span className="muted">Section · credit hours</span><b>{sheet.course.section || '-'} · {sheet.course.creditHours}</b></div>
        <div><span className="muted">Passing marks</span><b>{sheet.passingPercentage} / 100</b></div>
      </div>
      <div className="table-wrap">
        <table className="proforma-table">
          <thead>
            <tr>
              <th>#</th><th>Roll no</th><th>Student</th>
              {sheet.components.filter((c) => c.internal).map((c) => <th key={c.key}>{c.label}<small> ({c.max})</small></th>)}
              <th>Internal<small> (40)</small></th><th>Final term<small> (60)</small></th><th>Total<small> (100)</small></th><th>Grade</th><th>Result</th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r, i) => (
              <tr key={r.student}>
                <td>{i + 1}</td><td>{r.rollNumber}</td><td>{r.name}</td>
                <td>{shown(r.assignment)}</td><td>{shown(r.quiz)}</td><td>{shown(r.attendance)}</td><td>{shown(r.presentation)}</td><td>{shown(r.midterm)}</td>
                <td><b>{r.internal}</b></td><td>{shown(r.finalTerm)}</td><td><b>{r.total}</b></td><td>{r.grade}</td>
                <td><Badge value={r.result === 'Pass' ? 'approved' : r.result === 'Fail' ? 'rejected' : 'pending'} text={r.result} /></td>
              </tr>
            ))}
            {!sheet.rows.length && <tr><td colSpan={13} className="muted">No student is enrolled in this course.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted small" style={{ marginBottom: 0 }}>
        {s.students} students · {s.complete} complete · passed {s.passed} · failed {s.failed}
        {s.average !== null && <> · average {s.average} · highest {s.highest} · lowest {s.lowest}</>}
      </p>
    </div>
  );
}

// Opens a clean print window (A4, landscape) with the same sheet and the signature lines, and starts the browser's print dialog.
export function printProforma(sheet) {
  const w = window.open('', '_blank', 'width=1000,height=800');
  if (!w) return false; // pop-ups blocked
  const s = sheet.summary;
  const head = ['#', 'Roll no', 'Student', ...sheet.components.filter((c) => c.internal).map((c) => `${c.label} (${c.max})`), 'Internal (40)', 'Final term (60)', 'Total (100)', 'Grade', 'Result'];
  const body = sheet.rows
    .map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.rollNumber)}</td><td class="l">${esc(r.name)}</td>${[r.assignment, r.quiz, r.attendance, r.presentation, r.midterm].map((x) => `<td>${shown(x)}</td>`).join('')}<td><b>${r.internal}</b></td><td>${shown(r.finalTerm)}</td><td><b>${r.total}</b></td><td>${esc(r.grade)}</td><td>${esc(r.result)}</td></tr>`)
    .join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Proforma ${esc(sheet.course.code)}</title><style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; }
    h2, h3, h4 { margin: 2px 0; text-align: center; }
    .info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 16px; margin: 10px 0; }
    .info span { color: #555; margin-right: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 3px 5px; text-align: center; }
    th { background: #e8edf5; }
    td.l { text-align: left; }
    .sum { margin: 8px 0 28px; }
    .sign { display: flex; justify-content: space-between; margin-top: 46px; }
    .sign div { width: 22%; border-top: 1px solid #333; text-align: center; padding-top: 4px; }
  </style></head><body>
    <h2>${esc(sheet.university?.name)}</h2>
    <h4>${esc(sheet.university?.campus || '')}</h4>
    <h3>MARKS PROFORMA${sheet.locked ? '' : ' (DRAFT)'}${sheet.version ? ` - version ${sheet.version}` : ''}</h3>
    <div class="info">
      <div><span>Department:</span><b>${esc(sheet.department?.name || '-')}</b></div>
      <div><span>Semester:</span><b>${esc(sheet.semester ? `${sheet.semester.name} (${sheet.semester.academicYear})` : '-')}</b></div>
      <div><span>Subject:</span><b>${esc(`${sheet.course.code} - ${sheet.course.title}`)}</b></div>
      <div><span>Teacher:</span><b>${esc(sheet.teacher?.name || '-')}</b></div>
      <div><span>Section / credit hours:</span><b>${esc(`${sheet.course.section || '-'} / ${sheet.course.creditHours}`)}</b></div>
      <div><span>Passing marks:</span><b>${sheet.passingPercentage} / 100</b></div>
    </div>
    <table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
    <div class="sum">Students ${s.students} &nbsp;|&nbsp; Passed ${s.passed} &nbsp;|&nbsp; Failed ${s.failed}${s.average !== null ? ` &nbsp;|&nbsp; Average ${s.average} &nbsp;|&nbsp; Highest ${s.highest} &nbsp;|&nbsp; Lowest ${s.lowest}` : ''}</div>
    <div class="sign"><div>Subject teacher</div><div>HOD / Examination Department</div><div>Principal</div></div>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 300);
  return true;
}
