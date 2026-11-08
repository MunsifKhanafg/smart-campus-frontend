import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Tabs, fmtDate } from '../components/ui.jsx';
import Topics from './course/Topics.jsx';
import Assignments from './course/Assignments.jsx';
import Quizzes from './course/Quizzes.jsx';
import AttendanceTab from './course/AttendanceTab.jsx';
import MarksTab from './course/MarksTab.jsx';
import AssistantTab from './course/AssistantTab.jsx';
import PerformanceTab from './course/PerformanceTab.jsx';
import ClassList from './course/ClassList.jsx';

// One workspace per course. Notification links point here (/my-courses/:id for students, /courses/:id for staff).
export default function CourseWorkspace() {
  const { courseId } = useParams();
  const role = useSelector((s) => s.auth.user.role);
  const isStudent = role === 'student';
  const [msg, , fail] = useFlash();
  const [course, setCourse] = useState(null);
  const [tab, setTab] = useState('topics');

  useEffect(() => {
    if (isStudent) {
      api.get('/enrollments/my-courses', { params: { all: 'true' } })
        .then((r) => {
          const e = r.data.data.find((x) => x.course._id === courseId);
          if (!e) return fail('You are not enrolled in this course');
          setCourse({ ...e.course, semester: e.semester });
        })
        .catch(fail);
    } else {
      api.get(`/courses/${courseId}`).then((r) => setCourse(r.data.data)).catch(fail);
    }
  }, [courseId, isStudent, fail]);

  const tabs = [['topics', 'Topics'], ['assignments', 'Assignments'], ['quizzes', 'Quizzes'], ['attendance', 'Attendance']];
  if (!isStudent) tabs.push(['students', 'Class list']);
  if (!isStudent) tabs.push(['marks', 'Exam marks']);
  if (role === 'student' || role === 'teacher') tabs.push(['assistant', 'AI Assistant']);
  if (!isStudent) tabs.push(['performance', 'Student support']);
  tabs.push(['about', 'Course contents']);

  return (
    <>
      <p><Link to={isStudent ? '/my-courses' : '/courses'}>← Back to courses</Link></p>
      <Alert msg={msg} />
      {course && (
        <>
          <h1>{course.code} — {course.title}</h1>
          <p className="muted">
            {course.semester?.name} · Section {course.section} · {course.creditHours} credit hours
            {course.teacher?.name ? ` · ${course.teacher.name}` : ''}
          </p>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
          {tab === 'topics' && <Topics courseId={courseId} canEdit={role === 'teacher'} outline={course.outline} />}
          {tab === 'assignments' && <Assignments courseId={courseId} role={role} />}
          {tab === 'quizzes' && <Quizzes courseId={courseId} role={role} />}
          {tab === 'attendance' && <AttendanceTab courseId={courseId} role={role} />}
          {tab === 'students' && !isStudent && <ClassList course={course} role={role} />}
          {tab === 'marks' && !isStudent && <MarksTab courseId={courseId} role={role} />}
          {tab === 'assistant' && <AssistantTab courseId={courseId} />}
          {tab === 'performance' && !isStudent && <PerformanceTab courseId={courseId} />}
          {tab === 'about' && (
            <div className="card">
              <table className="mb">
                <tbody>
                  <tr><td className="muted">Subject</td><td><b>{course.title}</b> ({course.code})</td></tr>
                  <tr><td className="muted">Credit hours</td><td>{course.creditHours}</td></tr>
                  <tr><td className="muted">Semester</td><td>{course.semester?.name} · Section {course.section}</td></tr>
                  {course.teacher?.name && <tr><td className="muted">Teacher</td><td>{course.teacher.name}</td></tr>}
                </tbody>
              </table>
              {course.description && <p>{course.description}</p>}
              <h4>Course contents</h4>
              <p style={{ whiteSpace: 'pre-wrap' }}>{course.outline || <span className="muted">{isStudent ? 'No course contents have been added yet.' : 'The curriculum has no contents for this subject. Ask your HOD to add them.'}</span>}</p>
              <p className="muted small">{fmtDate(course.startDate)} to {fmtDate(course.endDate)}</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
