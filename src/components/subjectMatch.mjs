// Which teachers can teach a subject?  (pure code, no React: it is unit tested from server/tests/subject-match.test.js)
//
// Every department teaches the same common subjects (English, Mathematics, Islamiat, Pakistan Studies ...), and each teacher
// has a list of subjects they can teach ("English", "Mathematics", "Data Structures"). When the HOD gives a subject a teacher,
// the picker shows only the teachers whose list fits that subject.
//
// "Fits" is deliberately forgiving about wording, because nobody types subject names the same way:
//   * capital letters, punctuation, plurals and small words ("and", "of", "introduction to", "applied") do not matter
//   * common names for the same thing are one subject: Maths = Mathematics, Islamiyat = Islamic Studies, Pak Studies = Pakistan Studies
//   * the maths family (Calculus, Algebra, Geometry, Statistics, Probability, Numerical ...) belongs to Mathematics
//   * the English family (Composition, Writing, Comprehension, Communication Skills ...) belongs to English
// A teacher fits when every important word of their subject is part of the course name, or the other way round
// ("Database Systems" fits "Database Management Systems"; "Data Structures and Algorithms" fits a teacher of "Data Structures").

const STOP = new Set([
  'and', 'of', 'in', 'to', 'for', 'the', 'on', 'with', 'a', 'an',
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii',
  'introduction', 'intro', 'fundamentals', 'fundamental', 'basic', 'basics', 'principles', 'applied', 'advanced', 'functional',
  'general', 'theory', 'lab', 'labs', 'practical', 'course', 'studies', 'study', 'science', 'sciences',
  'elective', 'option', 'specialization', 'topics', 'special',
]);

// words that mean the same subject
const FAMILIES = {
  english: ['english', 'eng', 'composition', 'writing', 'comprehension', 'expository', 'literature', 'grammar'],
  math: ['math', 'maths', 'mathematics', 'calculus', 'algebra', 'geometry', 'trigonometry', 'statistics', 'probability', 'differential', 'integral', 'numerical', 'discrete'],
  islamic: ['islamic', 'islamiyat', 'islamiat', 'islamyat', 'islam'],
  pakistan: ['pakistan', 'pak'],
  physics: ['physics', 'phy'],
  chemistry: ['chemistry', 'chem'],
  biology: ['biology', 'bio'],
};
const SAME = new Map();
Object.entries(FAMILIES).forEach(([key, words]) => words.forEach((w) => SAME.set(w, key)));

const stem = (w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w); // "structures" -> "structure"

// The important words of a subject name, in one common spelling.
export const subjectKeys = (text) => {
  const clean = String(text || '')
    .toLowerCase()
    .replace(/communication skills?/g, 'english') // an English-department subject, unlike "Data Communication"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const keys = new Set();
  for (const w of clean.split(' ')) {
    if (w.length < 2 || STOP.has(w)) continue;
    keys.add(SAME.get(w) || stem(w));
  }
  return keys;
};

// Does one of the teacher's subjects fit this course name?
export const teacherMatchesSubject = (subjectTitle, teacherSubjects = []) => {
  const wanted = subjectKeys(subjectTitle);
  if (!wanted.size) return false;
  return (teacherSubjects || []).some((tag) => {
    const keys = subjectKeys(tag);
    if (!keys.size) return false;
    return [...keys].every((k) => wanted.has(k)) || [...wanted].every((k) => keys.has(k));
  });
};
