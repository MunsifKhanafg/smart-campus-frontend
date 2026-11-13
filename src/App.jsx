import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loadMe } from './store/authSlice.js';
import { fetchPublicSettings } from './store/settingsSlice.js';
import { TOKEN_KEY } from './api/axios.js';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Contact from './pages/Contact.jsx';
import PublicResult from './pages/PublicResult.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Settings from './pages/Settings.jsx';
import Departments from './pages/Departments.jsx';
import Users from './pages/Users.jsx';
import Semesters from './pages/Semesters.jsx';
import Courses from './pages/Courses.jsx';
import CourseWorkspace from './pages/CourseWorkspace.jsx';
import Students from './pages/Students.jsx';
import StudentRecord from './pages/StudentRecord.jsx';
import Timetable from './pages/Timetable.jsx';
import MyTimetable from './pages/MyTimetable.jsx';
import Calendar from './pages/Calendar.jsx';
import Notifications from './pages/Notifications.jsx';
import Announcements from './pages/Announcements.jsx';
import Examinations from './pages/Examinations.jsx';
import MyCourses from './pages/MyCourses.jsx';
import MyExams from './pages/MyExams.jsx';
import MyResults from './pages/MyResults.jsx';
import MyFees from './pages/MyFees.jsx';
import MyPerformance from './pages/MyPerformance.jsx';
import PayMock from './pages/PayMock.jsx';
import PayReturn from './pages/PayReturn.jsx';
import FeeNotices from './pages/FeeNotices.jsx';
import PromotionFees from './pages/PromotionFees.jsx';
import FeeReminders from './pages/FeeReminders.jsx';
import FinanceDesk from './pages/FinanceDesk.jsx';
import Documents from './pages/Documents.jsx';
import Admissions from './pages/Admissions.jsx';
import Complaints from './pages/Complaints.jsx';
import Insights from './pages/Insights.jsx';
import DepartmentDetail from './pages/DepartmentDetail.jsx';
import SemesterDetail from './pages/SemesterDetail.jsx';
import Attendance from './pages/Attendance.jsx';
import TeacherAttendance from './pages/TeacherAttendance.jsx';
import StaffAttendance from './pages/StaffAttendance.jsx';
import Teachers from './pages/Teachers.jsx';
import Account from './pages/Account.jsx';
import Curriculum from './pages/Curriculum.jsx';
import TeachingBoard from './pages/TeachingBoard.jsx';
import TeacherDetail from './pages/TeacherDetail.jsx';
import StudentsHub from './pages/StudentsHub.jsx';
import FinanceOverview from './pages/FinanceOverview.jsx';
import Apply from './pages/Apply.jsx';
import TrackApplication from './pages/TrackApplication.jsx';
import MeritList from './pages/MeritList.jsx';
import Applications from './pages/Applications.jsx';
import Assistant from './pages/Assistant.jsx';
import StudentLeave from './pages/StudentLeave.jsx';
import SupportStaff from './pages/SupportStaff.jsx';
import Library from './pages/Library.jsx';
import MyLibrary from './pages/MyLibrary.jsx';

// The University Head browses students by department boxes; an HOD uses the full management page.
function StudentsEntry() {
  const role = useSelector((s) => s.auth.user.role);
  return role === 'university_head' ? <StudentsHub /> : <Students />;
}

// Notification links point to /timetable. Only the HOD edits timetables; everybody else is sent to their own schedule.
function TimetableEntry() {
  const role = useSelector((s) => s.auth.user.role);
  return role === 'hod' ? <Timetable /> : <Navigate to="/my-timetable" replace />;
}

// A rule of thumb for the route table below: the browser only hides pages that a role should not see.
// Every API call is checked again by the server, so this is a convenience, not the security.
const HEAD = 'university_head';
const HOD = 'hod';
const FIN = 'finance_officer';
const LIB = 'library_controller';
const TEA = 'teacher';
const STU = 'student';

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchPublicSettings());
    if (localStorage.getItem(TOKEN_KEY)) dispatch(loadMe());
  }, [dispatch]);

  // A changed project name or logo shows in every open tab: the public settings are read again whenever the tab becomes active.
  useEffect(() => {
    const again = () => { if (document.visibilityState === 'visible') dispatch(fetchPublicSettings()); };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('online', again);
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('online', again); };
  }, [dispatch]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/check-result" element={<PublicResult />} />
      {/* New-student admission portal: no login needed */}
      <Route path="/apply" element={<Apply />} />
      <Route path="/track-application" element={<TrackApplication />} />
      <Route path="/merit-list" element={<MeritList />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/change-password" element={<ChangePassword />} />

        {/* Payment gateway pages use the whole screen, so they sit outside the dashboard layout */}
        <Route element={<ProtectedRoute roles={[STU]} />}>
          <Route path="/pay/mock/:id" element={<PayMock />} />
          <Route path="/pay/return" element={<PayReturn />} />
        </Route>

        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/account" element={<Account />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/timetable" element={<TimetableEntry />} />

          {/* AI assistant: the principal, HODs and the finance office (it searches records). Students and the library controller get the
              library assistant (the server gives each role only its own option and a student only their own library data). Not for teachers. */}
          <Route element={<ProtectedRoute roles={[HEAD, HOD, FIN, STU, LIB]} />}>
            <Route path="/assistant" element={<Assistant />} />
          </Route>

          {/* The staff's own attendance (check-in, leave): teachers, HODs, the finance officer and the library controller. The principal / HOD also see the staff of the day */}
          <Route element={<ProtectedRoute roles={[HEAD, HOD, TEA, FIN, LIB]} />}>
            <Route path="/staff-attendance" element={<StaffAttendance />} />
          </Route>

          {/* Library: only the library controller. The principal has no library screens. Students have their own read-only page. */}
          <Route element={<ProtectedRoute roles={[LIB]} />}>
            <Route path="/library" element={<Library />} />
          </Route>

          {/* Student leave: the student asks, the HOD decides, the principal sees everything */}
          <Route element={<ProtectedRoute roles={[STU, HOD, HEAD]} />}>
            <Route path="/student-leave" element={<StudentLeave />} />
          </Route>

          {/* University head and HOD */}
          <Route element={<ProtectedRoute roles={[HEAD, HOD]} />}>
            <Route path="/support-staff" element={<SupportStaff />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/departments/:deptId" element={<DepartmentDetail />} />
            <Route path="/departments/:deptId/semesters/:semId" element={<SemesterDetail />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/teachers/:teacherId" element={<TeacherDetail />} />
            <Route path="/curriculum" element={<Curriculum />} />
            <Route path="/assign-teachers" element={<TeachingBoard />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/users" element={<Users />} />
            <Route path="/semesters" element={<Semesters />} />
            <Route path="/students" element={<StudentsEntry />} />
            <Route path="/students/:id/record" element={<StudentRecord />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/insights" element={<Insights />} />
          </Route>

          {/* Teaching staff */}
          <Route element={<ProtectedRoute roles={[HEAD, HOD, TEA]} />}>
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:courseId" element={<CourseWorkspace />} />
            <Route path="/examinations" element={<Examinations />} />
          </Route>
          <Route element={<ProtectedRoute roles={[STU, TEA, HOD]} />}>
            <Route path="/my-timetable" element={<MyTimetable />} />
          </Route>
          <Route element={<ProtectedRoute roles={[TEA]} />}>
            <Route path="/my-attendance" element={<TeacherAttendance />} />
          </Route>

          {/* Student pages */}
          <Route element={<ProtectedRoute roles={[STU]} />}>
            <Route path="/my-courses" element={<MyCourses />} />
            <Route path="/my-courses/:courseId" element={<CourseWorkspace />} />
            <Route path="/my-record" element={<StudentRecord />} />
            <Route path="/my-performance" element={<MyPerformance />} />
            <Route path="/exams" element={<MyExams />} />
            <Route path="/results" element={<MyResults />} />
            <Route path="/fees" element={<MyFees />} />
            <Route path="/my-library" element={<MyLibrary />} />
          </Route>

          {/* Fees, documents, admissions and complaints */}
          <Route element={<ProtectedRoute roles={[HEAD, HOD, FIN]} />}>
            <Route path="/fee-notices" element={<FeeNotices />} />
            <Route path="/promotion-fees" element={<PromotionFees />} />
            <Route path="/fee-reminders" element={<FeeReminders />} />
            <Route path="/admissions" element={<Admissions />} />
          </Route>
          <Route element={<ProtectedRoute roles={[HEAD, FIN]} />}>
            <Route path="/finance" element={<FinanceDesk />} />
            <Route path="/finance-overview" element={<FinanceOverview />} />
          </Route>
          <Route element={<ProtectedRoute roles={[STU, HEAD, HOD]} />}>
            <Route path="/documents" element={<Documents />} />
          </Route>
          <Route element={<ProtectedRoute roles={[STU, HEAD, HOD, FIN]} />}>
            <Route path="/complaints" element={<Complaints />} />
          </Route>

          <Route element={<ProtectedRoute roles={[HEAD]} />}>
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
