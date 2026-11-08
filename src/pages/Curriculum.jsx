import { Fragment, useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { useFlash, Alert, Badge, Tabs, fmtDateTime } from '../components/ui.jsx';

// BS curriculum. The principal uploads a curriculum file (PDF or Word). The system reads it (AI when a key is configured,
// otherwise a rule-based reader) and shows a DRAFT. Nothing is saved to the programme catalogue until the principal
// has reviewed, corrected and approved it. Everybody with access can then browse every programme semester by semester.
export default function Curriculum() {
  const role = useSelector((s) => s.auth.user.role);
  const isHead = role === 'university_head';
  const [tab, setTab] = useState('programs');
  const [msg, ok, fail] = useFlash();

  return (
    <>
      <h1>BS Programmes &amp; Curriculum</h1>
      <Alert msg={msg} />
      <Tabs
        tabs={[['programs', 'Programme structure'], ...(isHead ? [['import', 'Upload & review']] : [])]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'programs' && <Programs isHead={isHead} ok={ok} fail={fail} />}
      {tab === 'import' && isHead && <ImportPanel ok={ok} fail={fail} done={() => setTab('programs')} />}
    </>
  );
}

// ---------- Saved programmes ----------
function Programs({ isHead, ok, fail }) {
  const confirm = useConfirm();
  const [programs, setPrograms] = useState([]);
  const [depts, setDepts] = useState([]);
  const [department, setDepartment] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    api.get('/curriculum/programs', { params: department ? { department } : {} }).then((r) => setPrograms(r.data.data)).catch(fail);
  }, [department, fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isHead) api.get('/departments').then((r) => setDepts(r.data.data)).catch(() => {}); }, [isHead]);

  const archive = async (p) => {
    const status = p.status === 'active' ? 'archived' : 'active';
    try { await api.patch(`/curriculum/programs/${p._id}/status`, { status }); ok(`Programme ${status}`); load(); } catch (err) { fail(err); }
  };
  const remove = async (p) => {
    try {
      const { data } = await api.get(`/curriculum/programs/${p._id}/delete-preview`);
      const v = data.data;
      const details = [];
      if (v.removable > 0) details.push(`${v.removable} class(es) with no records will be deleted, with their timetable slots and the enrollment of ${v.students} student(s)`);
      v.kept.forEach((k) => details.push(`${k.code} (${k.semester}) is kept because it has ${k.because}`));
      const yes = await confirm({
        tone: 'danger',
        title: `Delete ${p.name}?`,
        message: v.classes
          ? `${v.classes} class(es) were created from this programme. Students are never deleted, and classes that already have real records (attendance, marks, assignments...) are kept and only unlinked from the programme.`
          : 'No classes were created from this programme. Only its saved subjects are removed.',
        details,
        requireText: v.removable > 0 ? 'DELETE' : undefined,
        confirmText: 'Delete programme',
      });
      if (!yes) return;
      const res = await api.delete(`/curriculum/programs/${p._id}`);
      const r = res.data.data;
      ok(`Programme deleted. ${r.removed} class(es) removed${r.unlinked ? `, ${r.unlinked} kept` : ''}.`);
      load();
    } catch (err) { fail(err); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const resync = async (p) => {
    const yes = await confirm({
      tone: 'danger',
      title: `Correct "${p.name}" from the original file?`,
      message:
        'The file is read again. Every semester gets the subjects of its Scheme of Studies (for example 5 in semesters 7 and 8) and, listed separately as "elective options", the elective courses of that semester. The HOD offers only the electives needed.\n\n'
        + 'Classes already created from this programme are updated too: wrong classes without records are deleted and the missing ones are created, ready for the HOD to assign teachers. Subjects typed in by hand are replaced.',
      confirmText: 'Correct programme',
    });
    if (!yes) return;
    try {
      const { data } = await api.post(`/curriculum/programs/${p._id}/resync`);
      const { semesters, classes } = data.data;
      await confirm({
        tone: 'info',
        title: 'Programme corrected',
        message: 'These are the subjects each semester has now.',
        details: [
          ...semesters.map((s) => `Semester ${s.number}: ${s.subjects} subjects`),
          `${classes.removed} wrong class(es) deleted`,
          `${classes.created} class(es) created, waiting for a teacher`,
          ...classes.kept.map((k) => `${k.code} (${k.semester}) was kept because it has ${k.because}`),
        ],
        confirmText: 'OK',
        cancelText: null,
      });
      load();
    } catch (err) {
      fail(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      {isHead && (
        <div className="card filters">
          <div>
            <label>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
        </div>
      )}
      {!programs.length && <div className="card muted">No programme has been saved yet.{isHead ? ' Use "Upload & review" to add a curriculum.' : ' The principal uploads the curriculum.'}</div>}
      {programs.map((p) => (
        <div className="card" key={p._id}>
          <div className="row-between">
            <div>
              <h3 style={{ margin: 0 }}>{p.name} <Badge value={p.status} /></h3>
              <div className="muted small">{p.department?.name} · {p.semesters.length} semesters · {p.subjectCount} subjects</div>
            </div>
            <div className="actions">
              <button className="btn btn-small" onClick={() => setOpenId(openId === p._id ? null : p._id)}>{openId === p._id ? 'Hide' : 'Show subjects'}</button>
              {isHead && <button className="btn btn-small" onClick={() => resync(p)}>Re-read from file</button>}
              {isHead && <button className="btn btn-small" onClick={() => archive(p)}>{p.status === 'active' ? 'Archive' : 'Activate'}</button>}
              {isHead && <button className="btn btn-small btn-danger" onClick={() => remove(p)}>Delete</button>}
            </div>
          </div>
          {openId === p._id && (
            <div className="cols-2 mt">
              {[...p.semesters].sort((a, b) => a.number - b.number).map((s) => (
                <div className="sub-card" key={s.number}>
                  <h4>Semester {s.number} <span className="muted small">· {s.subjects.filter((x) => !x.elective).reduce((n, x) => n + x.creditHours, 0)} credit hours{s.subjects.some((x) => x.elective) ? ` · ${s.subjects.filter((x) => x.elective).length} elective options` : ''}</span></h4>
                  <table>
                    <tbody>
                      {[...s.subjects.filter((x) => !x.elective), ...s.subjects.filter((x) => x.elective)].map((x) => (
                        <Fragment key={x.code}>
                          <tr><td><b>{x.code}</b></td><td>{x.title}{x.elective && <span className="badge pending" style={{ marginLeft: 6 }}>elective</span>}</td><td className="right">{x.creditHours} cr</td></tr>
                          {x.outline && <tr><td /><td colSpan={2} className="muted small" style={{ whiteSpace: 'pre-wrap' }}>{x.outline}</td></tr>}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// ---------- Upload, review, approve ----------
function ImportPanel({ ok, fail, done }) {
  const confirm = useConfirm();
  const [imports, setImports] = useState([]);
  const [depts, setDepts] = useState([]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null); // the import being reviewed
  const [dirty, setDirty] = useState(false);

  const loadList = useCallback(() => {
    api.get('/curriculum/imports').then((r) => setImports(r.data.data)).catch(fail);
  }, [fail]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { api.get('/departments').then((r) => setDepts(r.data.data.filter((d) => d.status === 'active'))).catch(() => {}); }, []);

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return fail('Please choose a PDF or Word file');
    const fd = new FormData();
    fd.append('files', file);
    setBusy(true);
    try {
      const { data } = await api.post('/curriculum/imports', fd);
      ok('The curriculum was read. Check every programme, semester and subject before saving.');
      setFile(null);
      e.target.reset();
      setDraft(data.data);
      setDirty(false);
      loadList();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const openImport = async (id) => {
    try { setDraft((await api.get(`/curriculum/imports/${id}`)).data.data); setDirty(false); } catch (err) { fail(err); }
  };

  // ----- editing helpers (the draft is plain JSON, so we copy it, change it and put it back) -----
  const edit = (fn) => {
    const next = JSON.parse(JSON.stringify(draft));
    fn(next.programs);
    setDraft(next);
    setDirty(true);
  };

  const payload = () => ({
    programs: draft.programs.map((p) => ({
      name: p.name,
      department: p.department || null,
      semesters: p.semesters
        .map((s) => ({
          number: Number(s.number),
          subjects: s.subjects.filter((x) => x.code?.trim() || x.title?.trim()).map((x) => ({ code: x.code || '', title: x.title || '', creditHours: Number(x.creditHours) || 3, outline: x.outline || '', ...(x.elective ? { elective: true } : {}) })),
        }))
        .filter((s) => s.subjects.length),
    })),
  });

  const saveDraft = async () => {
    try {
      const { data } = await api.put(`/curriculum/imports/${draft._id}`, payload());
      setDraft(data.data);
      setDirty(false);
      ok('Draft saved. It is not in the catalogue until you approve it.');
      return true;
    } catch (err) { fail(err); return false; }
  };

  const approve = async () => {
    const total = draft.programs.reduce((n, p) => n + p.semesters.reduce((m, s) => m + s.subjects.length, 0), 0);
    const yes = await confirm({
      title: 'Approve and save this curriculum?',
      message: `${draft.programs.length} programme(s) and ${total} subjects will be saved. A programme with the same name in the same department is replaced, and the classes already created from the old version are updated to match (classes with real records are always kept).`,
      confirmText: 'Approve and save',
    });
    if (!yes) return;
    if (dirty && !(await saveDraft())) return;
    try {
      const { data } = await api.post(`/curriculum/imports/${draft._id}/approve`);
      const r = data.data;
      ok(`Saved: ${r.programs} programme(s), ${r.subjects} subjects.`);
      if (r.replaced > 0) {
        await confirm({
          tone: 'info',
          title: 'Curriculum replaced',
          message: 'The classes made from the old curriculum were brought in line with the new one.',
          details: [
            `${r.classes.removed} old class(es) deleted`,
            `${r.classes.notOffered || 0} subject(s) without a class are not offered. Each HOD chooses which subjects to offer on the Assign Teachers page`,
            ...r.classes.kept.map((k) => `${k.code} (${k.semester}) was kept because it has ${k.because}`),
          ],
          confirmText: 'OK',
          cancelText: null,
        });
      }
      setDraft(null);
      loadList();
      done();
    } catch (err) { fail(err); }
  };

  const reread = async () => {
    const yes = await confirm({ title: 'Read the file again?', message: 'The subjects below are replaced by a fresh reading of the uploaded file with the latest reader. Your department choices are kept, other edits in this draft are lost.', confirmText: 'Read again' });
    if (!yes) return;
    try {
      const { data } = await api.post(`/curriculum/imports/${draft._id}/reread`);
      setDraft(data.data);
      setDirty(false);
      ok('The file was read again. Check every semester.');
    } catch (err) { fail(err); }
  };

  const discard = async () => {
    const yes = await confirm({ tone: 'danger', title: 'Discard this import?', message: 'The uploaded file and the draft are thrown away.', confirmText: 'Discard' });
    if (!yes) return;
    try { await api.delete(`/curriculum/imports/${draft._id}`); setDraft(null); loadList(); ok('Import discarded'); } catch (err) { fail(err); }
  };

  const reviewing = draft?.status === 'review';

  return (
    <>
      <form className="card" onSubmit={upload}>
        <h3>Upload a curriculum</h3>
        <p className="muted small">A complete BS course outline as PDF or Word (.docx). Scanned (image only) PDFs cannot be read. You will review everything before it is saved.</p>
        <div className="inline-form">
          <div><input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files[0])} /></div>
          <button className="btn btn-primary inline" disabled={busy || !file}>{busy ? 'Reading document…' : 'Upload and analyse'}</button>
        </div>
      </form>

      {!draft && (
        <div className="card table-wrap">
          <h3>Earlier uploads</h3>
          <table>
            <thead><tr><th>File</th><th>Uploaded</th><th>Programmes</th><th>Subjects</th><th>Status</th><th /></tr></thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i._id}>
                  <td>{i.fileName}</td><td>{fmtDateTime(i.createdAt)}</td><td>{i.programs}</td><td>{i.subjects}</td>
                  <td><Badge value={i.status === 'review' ? 'pending' : i.status} text={i.status === 'review' ? 'waiting for review' : i.status} /></td>
                  <td><button className="btn btn-small" onClick={() => openImport(i._id)}>{i.status === 'review' ? 'Review' : 'View'}</button></td>
                </tr>
              ))}
              {!imports.length && <tr><td colSpan={6} className="muted">Nothing uploaded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <>
          <div className="card">
            <div className="row-between">
              <div>
                <h3 style={{ margin: 0 }}>{reviewing ? 'Review the extracted curriculum' : 'Saved curriculum'}: {draft.file?.originalName}</h3>
                <div className="muted small">Read by: {draft.method === 'ai' ? 'AI document analysis' : 'rule-based reader (no AI key configured or AI unavailable)'}</div>
              </div>
              <div className="actions">
                {reviewing && <button className="btn btn-small" onClick={reread}>Read file again</button>}
                <button className="btn btn-ghost" onClick={() => { setDraft(null); loadList(); }}>Close</button>
              </div>
            </div>
            {draft.warnings?.length > 0 && (
              <div className="alert alert-info mt">
                <b>Please check:</b>
                <ul style={{ margin: '.25rem 0 0 1.1rem' }}>{draft.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
          </div>

          {draft.programs.map((p, pi) => (
            <div className="card" key={pi}>
              <div className="form-grid">
                <div>
                  <label>Programme name</label>
                  <input disabled={!reviewing} value={p.name} onChange={(e) => edit((ps) => { ps[pi].name = e.target.value; })} />
                </div>
                <div>
                  <label>Department</label>
                  <select disabled={!reviewing} value={p.department || ''} onChange={(e) => edit((ps) => { ps[pi].department = e.target.value || null; })}>
                    <option value="">Choose a department...</option>
                    {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              {[...p.semesters].map((s, si) => (
                <div className="sub-card" key={si}>
                  <div className="row-between">
                    <h4 style={{ margin: 0 }}>Semester
                      <input type="number" min={1} max={12} disabled={!reviewing} style={{ width: 70, marginLeft: 8 }} value={s.number}
                        onChange={(e) => edit((ps) => { ps[pi].semesters[si].number = e.target.value; })} />
                    </h4>
                    {reviewing && <button className="btn btn-small btn-danger" onClick={() => edit((ps) => { ps[pi].semesters.splice(si, 1); })}>Remove semester</button>}
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th style={{ width: 130 }}>Code</th><th>Subject title</th><th style={{ width: 90 }}>Credits</th><th style={{ width: 80 }}>Elective</th>{reviewing && <th />}</tr></thead>
                      <tbody>
                        {s.subjects.map((x, xi) => (
                          <tr key={xi}>
                            <td><input disabled={!reviewing} value={x.code || ''} onChange={(e) => edit((ps) => { ps[pi].semesters[si].subjects[xi].code = e.target.value; })} /></td>
                            <td>
                              <input disabled={!reviewing} value={x.title || ''} onChange={(e) => edit((ps) => { ps[pi].semesters[si].subjects[xi].title = e.target.value; })} />
                              {(reviewing || x.outline) && (
                                <textarea rows={2} style={{ width: '100%', marginTop: 4 }} disabled={!reviewing} value={x.outline || ''} maxLength={5000}
                                  placeholder="Course contents (optional): the topics this subject covers. The teacher receives this when assigned."
                                  onChange={(e) => edit((ps) => { ps[pi].semesters[si].subjects[xi].outline = e.target.value; })} />
                              )}
                            </td>
                            <td><input type="number" min={1} max={6} disabled={!reviewing} value={x.creditHours ?? 3} onChange={(e) => edit((ps) => { ps[pi].semesters[si].subjects[xi].creditHours = e.target.value; })} /></td>
                            <td><input type="checkbox" title="An elective option: the HOD offers only some of these" disabled={!reviewing} checked={!!x.elective} onChange={(e) => edit((ps) => { ps[pi].semesters[si].subjects[xi].elective = e.target.checked; })} /></td>
                            {reviewing && <td><button className="btn btn-small btn-danger" onClick={() => edit((ps) => { ps[pi].semesters[si].subjects.splice(xi, 1); })}>x</button></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {reviewing && <button className="btn btn-small" onClick={() => edit((ps) => { ps[pi].semesters[si].subjects.push({ code: '', title: '', creditHours: 3 }); })}>+ Add subject</button>}
                </div>
              ))}
              {reviewing && (
                <div className="actions">
                  <button className="btn btn-small" onClick={() => edit((ps) => {
                    const next = Math.max(0, ...ps[pi].semesters.map((x) => Number(x.number) || 0)) + 1;
                    ps[pi].semesters.push({ number: Math.min(next, 12), subjects: [{ code: '', title: '', creditHours: 3 }] });
                  })}>+ Add semester</button>
                  <button className="btn btn-small btn-danger" onClick={() => edit((ps) => { ps.splice(pi, 1); })}>Remove programme</button>
                </div>
              )}
            </div>
          ))}

          {reviewing && (
            <div className="card">
              <div className="actions">
                <button className="btn" onClick={() => edit((ps) => { ps.push({ name: 'BS New Programme', department: null, semesters: [{ number: 1, subjects: [{ code: '', title: '', creditHours: 3 }] }] }); })}>+ Add programme</button>
                <button className="btn" disabled={!dirty} onClick={saveDraft}>Save draft</button>
                <button className="btn btn-primary" onClick={approve}>Approve &amp; save to database</button>
                <button className="btn btn-danger" onClick={discard}>Discard</button>
              </div>
              <p className="muted small">{dirty ? 'You have unsaved changes. ' : ''}Approving saves the programmes. HODs can then pick these subjects when they assign teachers.</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
