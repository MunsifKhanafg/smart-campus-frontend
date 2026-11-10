// Which teachers are RELEVANT for a subject?
// A teacher lists the subjects they can teach ("English, Mathematics, Islamiat"). When an HOD chooses a teacher for "Applied Mathematics II",
// the list should start with the teachers who teach mathematics, not with all 60 teachers of the department.
// A teacher fits a subject when:
//   1. one of their subjects equals / contains / is contained in the subject's name or code ("Mathematics" fits "Applied Mathematics II")
//   2. ALL words of one of their subjects appear in the subject's name, or the other way round
//      ("Data Structures" fits "Data Structures and Algorithms", but "Computer Science" does NOT fit "Computer Networks")
//   3. they already teach this same subject (same code or name) somewhere, for example English in another department
// Nothing is hidden for good: the picker always has an "All teachers" tab.

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['and', 'of', 'the', 'in', 'to', 'for', 'a', 'i', 'ii', 'iii', 'iv', 'v', 'vi']);
const words = (s) => norm(s).split(' ').filter((w) => w && !STOP.has(w));

export const teacherFits = (teacher, subject) => {
  const title = norm(subject.title);
  const code = norm(subject.code);
  const titleWords = new Set(words(subject.title));

  const mine = (teacher.subjects || []).map(norm).filter(Boolean);
  for (const m of mine) {
    if (m === code || (title && (title.includes(m) || m.includes(title)))) return true;
    const mw = words(m);
    if (mw.length && mw.every((w) => titleWords.has(w))) return true;
    if (titleWords.size && [...titleWords].every((w) => mw.includes(w))) return true;
  }
  return (teacher.assignments || []).some((a) => (code && norm(a.code) === code) || (title && norm(a.title) === title));
};
