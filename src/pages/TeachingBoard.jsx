import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate } from '../components/ui.jsx';
import TeacherPicker from '../components/TeacherPicker.jsx';
import { colorAt, colorFor, initials } from '../components/palette.js';

// HOD: pick a semester, then give every subject of the approved BS programme a teacher.
// One saved assignment is a Course document, so the teacher's profile, the department page and the semester page all update at once.
// The principal can open the same board read-only.
export default function TeachingBoard() {
  const role = useSelector((s) => s.auth.user.role);
  const isHod = role === 'hod';
  const [msg, ok, fail, clear] = useFlash();
  const [semesters, setSemesters] = useState([]);
  const [semester, setSemester] = useState('');
  const [program, setProgram] = useState('');
  const [data, setData] = useState(null);
  const [pick, setPick] = useState(null); // { subject, section, teacher, existing, hasTeacher }
  const [busy, setBusy] = useState(false);
  const [sectionsText, setSectionsText] = useState('A');

  useEffect(() => {
    api.get('/semesters').then((r) => {
      const open = r.data.data.filter((s) => !['completed', 'archived'].includes(s.status));
      setSemesters(open);
      if (open[0]) setSemester(open[0]._id);
    }).catch(fail);
  }, [fail]);

  const load = useCallback(() => {
    if (!semester) return;
    api.get('/teaching/board', { params: { semester, ...(program ? { program } : {}) } })
      .then((r) => {
        setData(r.data.data);
        if (!program && r.data.data.program) setProgram(r.data.data.program._id);
      })
      .catch((e) => { setData(null); fail(e); });
  }, [semester, program, fail]);
  useEffect(() => { load(); }, [load]);

  const nextSection = (row) => {
    const used = new Set(row.classes.map((c) => c.section));
    return ['A', 'B', 'C', 'D', 'E', 'F'].find((x) => !used.has(x)) || 'A';
  };
  const choose = (subject, cls) => {
    clear();
    setPick({ subject, section: cls?.section || nextSection(subject), teacher: cls?.teacher?._id || '', existing: !!cls, hasTeacher: !!cls?.teacher });
  };

  const save = async (teacherId) => {
    setBusy(true);
    try {
      const { data: res } = await api.post('/teaching/assign', {
        semester, program, code: pick.subject.subject.code, section: pick.section, teacher: teacherId,
      });
      ok(res.message + (res.data.studentsEnrolled ? ` · ${res.data.studentsEnrolled} students enrolled` : ''));
      setPick(null);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  // Stores every subject of this semester as a class in one step. Teachers are chosen afterwards.
  const generate = async () => {
    const sections = [...new Set(sectionsText.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))];
    if (!sections.length) return fail('Enter at least one section, for example A');
    setBusy(true);
    try {
      const { data: res } = await api.post('/teaching/generate', { semester, program, sections });
      const d = res.data;
      ok(`${res.message}${d.created ? ` · ${d.studentsEnrolled} student enrolments` : ''}${d.alreadyExisted ? ` · ${d.alreadyExisted} already existed` : ''}`);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const sem = semesters.find((s) => s._id === semester);

  // Totals for the progress strip: how far along is the semester?
  const totals = useMemo(() => {
    const rows = data?.rows || [];
    const classes = rows.flatMap((r) => r.classes.filter((c) => c.status !== 'archived'));
    const assigned = classes.filter((c) => c.teacher).length;
    return { subjects: rows.length, classes: classes.length, assigned, missing: classes.length - assigned, percent: classes.length ? Math.round((assigned / classes.length) * 100) : 0 };
  }, [data]);

  const pickedSubjectIndex = pick && data ? Math.max(0, data.rows.findIndex((r) => r.subject.code === pick.subject.subject.code)) : 0;

  return (
    <>
      <h1>Assign Teachers to Subjects</h1>
      <p className="muted">{isHod ? 'Choose a semester, then give each subject a teacher.' : 'Read-only view of how teachers are assigned.'}</p>
      <Alert msg={pick ? null : msg} />

      <h3 className="cx-title"><span className="num">1</span> Choose a semester</h3>
      <div className="cx-sems">
        {semesters.map((s, i) => (
          <button key={s._id} type="button" style={colorAt(i)} className={`cx-sem ${s._id === semester ? 'on' : ''}`}
            onClick={() => { setSemester(s._id); setProgram(''); setData(null); setPick(null); clear(); }}>
            <b>{s.name}</b>
            <small>{s.department?.code ? `${s.department.code} · ` : ''}{s.academicYear} · Semester {s.number}</small>
            <small>{fmtDate(s.startDate)} to {fmtDate(s.endDate)}</small>
            <div className="cx-tags"><span className="cx-tag">{s.status}</span></div>
          </button>
        ))}
        {!semesters.length && <div className="card muted">No open semester. Create one on the Semesters page first.</div>}
      </div>

      {data && data.programs.length > 1 && (
        <div className="card filters mt">
          <div>
            <label>BS programme</label>
            <select value={program} onChange={(e) => { setProgram(e.target.value); setPick(null); }}>
              <option value="">Choose a programme...</option>
              {data.programs.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {data && !data.programs.length && (
        <div className="card muted mt">No approved BS programme exists for this department yet. The principal uploads and approves the curriculum under "BS Curriculum".</div>
      )}
      {data && data.programs.length > 0 && !data.program && <div className="card muted mt">Choose a programme to see the subjects of {sem?.name}.</div>}

      {data?.program && (
        <>
          <h3 className="cx-title"><span className="num">2</span> {data.program.name} · Semester {data.semester.number}</h3>

          <div className="cx-strip">
            <div className="item"><b>{totals.subjects}</b><span>Subjects</span></div>
            <div className="item"><b>{totals.classes}</b><span>Classes created</span></div>
            <div className="item"><b style={{ color: '#16a34a' }}>{totals.assigned}</b><span>With a teacher</span></div>
            <div className="item"><b style={{ color: totals.missing ? '#dc2626' : '#16a34a' }}>{totals.missing}</b><span>Without a teacher</span></div>
            <div className="bar">
              <div className="cx-muted" style={{ marginBottom: 4 }}>{totals.percent}% of classes have a teacher</div>
              <div className="cx-bar"><i className={totals.percent < 50 ? 'low' : totals.percent < 100 ? 'mid' : ''} style={{ width: `${totals.percent}%` }} /></div>
            </div>
          </div>

          {isHod && data.rows.length > 0 && (
            <div className="card">
              <div className="inline-form">
                <div>
                  <label>Sections</label>
                  <input value={sectionsText} placeholder="A, B" onChange={(e) => setSectionsText(e.target.value.toUpperCase())} />
                </div>
                <button className="btn btn-primary inline" disabled={busy} onClick={generate}>
                  {busy ? 'Creating…' : `Create all ${data.rows.length} classes of semester ${data.semester.number}`}
                </button>
              </div>
              <p className="muted small" style={{ marginBottom: 0 }}>
                Step 1: one click stores every subject below as a class (code, name and credit hours come from the curriculum). Step 2: choose a teacher on each subject card.
                Classes that already exist are not changed, and students already placed in this semester and section are enrolled automatically.
              </p>
            </div>
          )}

          {!data.rows.length && <div className="card muted">This programme has no subjects for semester {data.semester.number}. The semester number of {data.semester.name} must match a semester of the curriculum.</div>}

          <div className="cx-subjects">
            {data.rows.map((row, i) => (
              <div key={row.subject.code} className="cx-subj" style={colorAt(i + 1)}>
                <div className="cx-subj-head">
                  <div className="grow">
                    <div className="code">{row.subject.code}</div>
                    <h4>{row.subject.title}</h4>
                  </div>
                  <span className="cx-credit">{row.subject.creditHours} cr</span>
                </div>
                <div className="cx-subj-body">
                  {row.subject.outline && <div className="cx-outline">{row.subject.outline}</div>}

                  {row.classes.map((c) => (
                    <div key={c._id} className={`cx-class ${c.teacher ? '' : 'none'}`} style={c.teacher ? colorFor(c.teacher.name) : undefined}>
                      <span className={`cx-av ${c.teacher ? '' : 'empty'}`}>{c.teacher ? initials(c.teacher.name) : '?'}</span>
                      <div className="grow">
                        <div className="who"><span className="cx-sec" style={colorAt(i + 1)}>Sec {c.section}</span>{c.teacher ? c.teacher.name : <span style={{ color: '#b91c1c' }}>No teacher yet</span>}</div>
                        {c.status === 'archived' && <Badge value="archived" />}
                      </div>
                      {isHod && c.status === 'active' && (
                        <button className="btn btn-small" onClick={() => choose(row, c)}>{c.teacher ? 'Change' : 'Assign'}</button>
                      )}
                    </div>
                  ))}
                  {!row.classes.length && <div className="cx-class none"><span className="cx-av empty">–</span><div className="grow" style={{ color: '#b91c1c' }}>No class created yet</div></div>}

                  {isHod && (
                    <div className="cx-actions">
                      <button className="btn btn-small btn-primary" onClick={() => choose(row, null)}>{row.classes.length ? '+ Another section' : 'Select teacher'}</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {data.otherClasses > 0 && <p className="muted small">{data.otherClasses} other class(es) in this semester were created manually and are not part of the curriculum. Manage them under Courses.</p>}
        </>
      )}

      {pick && isHod && data && (
        <TeacherPicker
          color={colorAt(pickedSubjectIndex + 1)}
          title={`${pick.subject.subject.code} — ${pick.subject.subject.title}`}
          subtitle={`${sem?.name || ''} · ${pick.subject.subject.creditHours} credit hours`}
          teachers={data.teachers}
          value={pick.teacher}
          onChange={(id) => setPick({ ...pick, teacher: id })}
          extra={(
            <div className="inline-form" style={{ marginBottom: '.75rem' }}>
              <div style={{ maxWidth: 200 }}>
                <label>Section</label>
                <input maxLength={10} disabled={pick.existing} value={pick.section} onChange={(e) => setPick({ ...pick, section: e.target.value.toUpperCase() })} />
              </div>
            </div>
          )}
          note="A new class is created from the curriculum the first time, and the students of this semester and section are enrolled in it. If the class is already on the timetable, the new teacher must be free at those times."
          canRemove={pick.existing && pick.hasTeacher}
          onRemove={() => save(null)}
          onSave={() => save(pick.teacher)}
          saveDisabled={!pick.teacher || !pick.section}
          busy={busy}
          error={msg.type === 'error' ? msg.text : ''}
          onClose={() => { setPick(null); clear(); }}
        />
      )}
    </>
  );
}
