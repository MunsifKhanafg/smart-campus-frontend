import { useEffect, useMemo, useState, useCallback, Fragment } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate } from '../components/ui.jsx';
import TeacherPicker from '../components/TeacherPicker.jsx';
import { teacherFits } from '../components/teacherFit.js';
import { colorAt, colorFor, initials } from '../components/palette.js';
import { useConfirm } from '../components/ConfirmModal.jsx';

// HOD: pick a semester, then give every subject of the approved BS programme a teacher.
// One saved assignment is a Course document, so the teacher's profile, the department page and the semester page all update at once.
// The principal can open the same board read-only.
export default function TeachingBoard() {
  const role = useSelector((s) => s.auth.user.role);
  const isHod = role === 'hod';
  const [msg, ok, fail, clear] = useFlash();
  const confirm = useConfirm();
  const [semesters, setSemesters] = useState([]);
  const [semester, setSemester] = useState('');
  const [program, setProgram] = useState('');
  const [data, setData] = useState(null);
  const [pick, setPick] = useState(null); // { subject, section, teacher, existing, hasTeacher }
  const [busy, setBusy] = useState(false);
  const [sectionsText, setSectionsText] = useState('A');
  const [chosen, setChosen] = useState([]); // subject codes ticked to be offered
  const [swap, setSwap] = useState(null); // { row, to, keepTeacher } while replacing a subject

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
    setPick({
      subject, section: cls?.section || nextSection(subject), teacher: cls?.teacher?._id || '', existing: !!cls, hasTeacher: !!cls?.teacher,
      currentTeacher: cls?.teacher?._id || '',
      weeklyClasses: cls?.weeklyClasses ? String(cls.weeklyClasses) : '', // empty = as many classes per week as the credit hours
    });
  };

  const save = async (teacherId) => {
    setBusy(true);
    try {
      // Classes per week: the HOD sets it to the real workload (a 3-credit subject may be taught 4, 6 or 8 times a week). Empty = credit hours.
      const body = { semester, program, code: pick.subject.subject.code, section: pick.section, teacher: teacherId };
      if (teacherId) body.weeklyClasses = pick.weeklyClasses === '' ? null : Number(pick.weeklyClasses);
      const { data: res } = await api.post('/teaching/assign', body);
      ok(res.message + (res.data.studentsEnrolled ? ` · ${res.data.studentsEnrolled} students enrolled` : ''));
      setPick(null);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const sectionList = () => [...new Set(sectionsText.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))];

  // Offer ONLY the ticked subjects (for example 5 of the 21 subjects of semester 7). The others get no class at all.
  const offer = async () => {
    const sections = sectionList();
    if (!sections.length) return fail('Enter at least one section, for example A');
    setBusy(true);
    try {
      const { data: res } = await api.post('/teaching/offer', { semester, program, codes: chosen, sections });
      ok(`${res.message}${res.data.studentsEnrolled ? ` · ${res.data.studentsEnrolled} student enrolments` : ''}`);
      setChosen([]);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  // What is inside the class(es) of a subject (attendance, assignments, quizzes ...). This call changes nothing.
  const readRecords = async (code) => {
    const { data: res } = await api.post('/teaching/withdraw', { semester, program, code, preview: true });
    const classes = res.data.classes;
    return { blocked: classes.filter((c) => c.blocked), withData: classes.filter((c) => c.hasRecords && !c.blocked) };
  };
  const recordLines = (list) => list.map((c) => `${c.code} Sec ${c.section}: ${c.items.map((i) => `${i.count} ${i.label}`).join(', ')}`);

  // Stop offering a subject. A subject with attendance, assignments, quizzes ... is only deleted after the HOD confirmed it
  // in the window, together with everything inside it. A subject that is part of saved results is archived instead.
  const withdraw = async (row) => {
    let info;
    try { info = await readRecords(row.subject.code); } catch (err) { return fail(err); }
    const name = `${row.subject.code} ${row.subject.title}`;
    const yes = await confirm(info.withData.length
      ? {
        tone: 'danger',
        title: `${row.subject.code} already has records. Delete everything?`,
        message: `Stopping ${name} deletes its class AND all the data below, permanently. The class also leaves the timetable. This cannot be undone.${info.blocked.length ? '\n\nPart of it is in saved results, so that class is archived instead and its records are kept.' : ''}`,
        details: recordLines(info.withData),
        confirmText: 'Yes, delete everything',
        cancelText: 'No, keep it',
      }
      : {
        tone: 'danger',
        title: `Stop offering ${name}?`,
        message: `Its class leaves Courses and the timetable.${info.blocked.length ? ' It is part of saved results, so it is archived instead of deleted and its records are kept.' : ''}`,
        confirmText: 'Stop offering',
        cancelText: 'No, keep it',
      });
    if (!yes) return;
    setBusy(true);
    try {
      const { data: res } = await api.post('/teaching/withdraw', { semester, program, code: row.subject.code, force: info.withData.length > 0 });
      const kept = res.data.archived.length ? ` · ${res.data.archived.length} class(es) archived because they are part of saved results` : '';
      ok(`${res.message}${kept}`);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const replace = async () => {
    let info;
    try { info = await readRecords(swap.row.subject.code); } catch (err) { return fail(err); }
    if (info.withData.length) {
      const yes = await confirm({
        tone: 'danger',
        title: `${swap.row.subject.code} already has records. Delete everything?`,
        message: 'Replacing it deletes the old class AND all the data below, permanently. This cannot be undone.',
        details: recordLines(info.withData),
        confirmText: 'Yes, replace and delete everything',
        cancelText: 'No, keep it',
      });
      if (!yes) return;
    }
    setBusy(true);
    try {
      const { data: res } = await api.post('/teaching/replace', { semester, program, from: swap.row.subject.code, to: swap.to, keepTeacher: swap.keepTeacher, force: info.withData.length > 0 });
      ok(res.message);
      setSwap(null);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const toggleChosen = (code) => setChosen((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code]));

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
    const notOffered = rows.filter((r) => !r.classes.some((c) => c.status !== 'archived')).length;
    return { subjects: rows.length, classes: classes.length, assigned, notOffered, missing: classes.length - assigned, percent: classes.length ? Math.round((assigned / classes.length) * 100) : 0 };
  }, [data]);

  // Compulsory subjects first, then the elective options the HOD may pick from.
  const sortedRows = useMemo(() => {
    const rows = data?.rows || [];
    return [...rows.filter((r) => !r.subject.elective), ...rows.filter((r) => r.subject.elective)];
  }, [data]);
  const coreCount = sortedRows.filter((r) => !r.subject.elective).length;

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
            <div className="item"><b>{totals.subjects}</b><span>Subjects in curriculum</span></div>
            <div className="item"><b>{totals.subjects - totals.notOffered}</b><span>Offered (have a class)</span></div>
            <div className="item"><b style={{ color: '#64748b' }}>{totals.notOffered}</b><span>Not offered</span></div>
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
                <button className="btn btn-primary inline" disabled={busy || !chosen.length} onClick={offer}>
                  {busy ? 'Working…' : `Offer the ${chosen.length} ticked subject${chosen.length === 1 ? '' : 's'}`}
                </button>
                <button className="btn inline" disabled={busy || !coreCount} onClick={generate}>Offer all {coreCount} compulsory</button>
              </div>
              <p className="muted small" style={{ marginBottom: 0 }}>
                A semester lists the compulsory subjects and then <b>elective options</b> (for example semester 7 has 5 subjects plus about 18 elective options). You offer only some of them. <b>Tick the subjects you will teach</b> and press "Offer the ticked subjects":
                only those become classes, so only they appear under Courses, on the timetable and to students. The others stay in the curriculum and are simply not offered.
                Later you can <b>replace</b> an offered subject by another one, or <b>stop offering</b> it: its class is removed from the timetable too.
                Students already placed in this semester and section are enrolled automatically.
              </p>
            </div>
          )}

          {swap && isHod && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Replace {swap.row.subject.code} {swap.row.subject.title}</h3>
              <div className="form-grid">
                <div>
                  <label>Replace it with</label>
                  <select value={swap.to} onChange={(e) => setSwap({ ...swap, to: e.target.value })}>
                    <option value="">Choose a subject that is not offered...</option>
                    {data.rows.filter((r) => !r.classes.some((c) => c.status !== 'archived')).map((r) => <option key={r.subject.code} value={r.subject.code}>{r.subject.code} · {r.subject.title} ({r.subject.creditHours} cr)</option>)}
                  </select>
                </div>
              </div>
              <label className="check"><input type="checkbox" checked={swap.keepTeacher} onChange={(e) => setSwap({ ...swap, keepTeacher: e.target.checked })} /> Give the new subject to the same teacher</label>
              <p className="muted small">The old class is removed from Courses and from the timetable. You can then schedule the new class on the timetable.</p>
              <div className="actions">
                <button className="btn btn-primary" disabled={busy || !swap.to} onClick={replace}>Replace subject</button>
                <button className="btn btn-ghost" onClick={() => setSwap(null)}>Cancel</button>
              </div>
            </div>
          )}

          {!data.rows.length && <div className="card muted">This programme has no subjects for semester {data.semester.number}. The semester number of {data.semester.name} must match a semester of the curriculum.</div>}

          <div className="cx-subjects">
            {sortedRows.map((row, i) => (
              <Fragment key={row.subject.code}>
              {i === coreCount && coreCount > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <h3 className="cx-title" style={{ marginBottom: 0 }}>Elective options</h3>
                  <p className="muted small" style={{ margin: '.2rem 0 0' }}>Not shown in Courses or on the timetable until you offer them. Use "Replace" on a "Specialization Elective" slot to swap it for one of these.</p>
                </div>
              )}
              <div className="cx-subj" style={colorAt(i + 1)}>
                <div className="cx-subj-head">
                  {isHod && !row.classes.some((c) => c.status !== 'archived') && (
                    <input type="checkbox" title="Tick to offer this subject" checked={chosen.includes(row.subject.code)} onChange={() => toggleChosen(row.subject.code)} style={{ width: 20, height: 20, marginRight: '.5rem' }} />
                  )}
                  <div className="grow">
                    <div className="code">{row.subject.code}{row.subject.elective && <span className="cx-tag" style={{ marginLeft: 8 }}>Elective option</span>}</div>
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
                        <div className="who"><span className="cx-sec" style={colorAt(i + 1)}>Sec {c.section}</span>{c.teacher ? c.teacher.name : <span style={{ color: '#b91c1c' }}>No teacher yet</span>}{c.weeklyClasses ? <span className="muted small"> · {c.weeklyClasses} classes/week</span> : null}</div>
                        {c.status === 'archived' && <Badge value="archived" />}
                      </div>
                      {isHod && c.status === 'active' && (
                        <button className="btn btn-small" onClick={() => choose(row, c)}>{c.teacher ? 'Change' : 'Assign'}</button>
                      )}
                    </div>
                  ))}
                  {!row.classes.length && <div className="cx-class none"><span className="cx-av empty">–</span><div className="grow" style={{ color: '#64748b' }}>Not offered{isHod ? ' (tick it above to offer it)' : ''}</div></div>}

                  {isHod && (
                    <div className="cx-actions">
                      {row.classes.some((c) => c.status !== 'archived') ? (
                        <>
                          <button className="btn btn-small btn-primary" onClick={() => choose(row, null)}>+ Another section</button>
                          <button className="btn btn-small" onClick={() => { setSwap({ row, to: '', keepTeacher: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Replace</button>
                          <button className="btn btn-small btn-danger" onClick={() => withdraw(row)}>Stop offering</button>
                        </>
                      ) : (
                        <button className="btn btn-small" onClick={() => toggleChosen(row.subject.code)}>{chosen.includes(row.subject.code) ? 'Untick' : 'Offer this subject'}</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              </Fragment>
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
          fits={(t) => teacherFits(t, pick.subject.subject)} // opens on the teachers whose subjects fit; "All teachers" tab shows everybody
          value={pick.teacher}
          courseHours={Number(pick.weeklyClasses) || pick.subject.subject.creditHours || 0}
          currentTeacherId={pick.currentTeacher}
          onChange={(id) => setPick({ ...pick, teacher: id })}
          extra={(
            <div className="inline-form" style={{ marginBottom: '.75rem' }}>
              <div style={{ maxWidth: 200 }}>
                <label>Section</label>
                <input maxLength={10} disabled={pick.existing} value={pick.section} onChange={(e) => setPick({ ...pick, section: e.target.value.toUpperCase() })} />
              </div>
              <div style={{ maxWidth: 240 }}>
                <label>Classes per week (1 to 20)</label>
                <input type="number" min={1} max={20} placeholder={`${pick.subject.subject.creditHours} (credit hours)`} value={pick.weeklyClasses} onChange={(e) => setPick({ ...pick, weeklyClasses: e.target.value })} />
              </div>
            </div>
          )}
          note="Classes per week is the real teaching workload of this subject. Leave it empty to use the credit hours. The teacher's weekly limit (set by the principal or the HOD under Users > Edit) is checked against it, and the timetable follows it. A new class is created from the curriculum the first time, and the students of this semester and section are enrolled in it. If the class is already on the timetable, the new teacher must be free at those times."
          canRemove={pick.existing && pick.hasTeacher}
          onRemove={() => save(null)}
          onSave={() => save(pick.teacher)}
          saveDisabled={!pick.teacher || !pick.section || (pick.weeklyClasses !== '' && !(Number(pick.weeklyClasses) >= 1 && Number(pick.weeklyClasses) <= 20))}
          busy={busy}
          error={msg.type === 'error' ? msg.text : ''}
          onClose={() => { setPick(null); clear(); }}
        />
      )}
    </>
  );
}
