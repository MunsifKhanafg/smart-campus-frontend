import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import Brand from '../components/Brand.jsx';
import { fmtDate } from '../components/ui.jsx';
import './admission.css';

// Public front page. Name, address, announcements and departments come from the database, so the University Head
// changes them from Settings and this page follows. Nothing here needs a login.

const WORDS = ['learning', 'teaching', 'managing', 'paying fees', 'growing'];

const ROLES = [
  { key: 'student', icon: '🎓', label: 'Student', color: '#4f46e5',
    lead: 'Everything about your studies in one place.',
    items: ['Timetable, calendar and notifications', 'Attendance with percentage and warnings', 'Study material that opens on the teacher\'s schedule', 'Assignments and quizzes with marks and feedback', 'Results, DMC and admit card downloads', 'Pay fees online and keep receipts', 'AI assistant that answers from your course material'] },
  { key: 'teacher', icon: '👩‍🏫', label: 'Teacher', color: '#0d9488',
    lead: 'Teach, track and grade without the paperwork.',
    items: ['Your classes, rooms and weekly timetable', 'Mark attendance in a few clicks', 'Plan daily topics that release on their date', 'Create assignments, quizzes and surprise quizzes', 'Enter exam marks for your own subjects', 'See which students need support'] },
  { key: 'hod', icon: '🏛️', label: 'HOD', color: '#d97706',
    lead: 'Run your department from one dashboard.',
    items: ['Create semesters and classes from the curriculum', 'Assign teachers to subjects', 'Timetables with clash protection', 'Exam sessions and date sheets', 'Review results, documents and complaints', 'Department attendance summaries'] },
  { key: 'finance', icon: '💳', label: 'Finance', color: '#e11d48',
    lead: 'Fee notices, payments and receipts that always add up.',
    items: ['Fee notices with late-fee rules', 'Payments marked paid only after verification', 'Receipts and payment history', 'Outstanding balances and reports', 'Authorised refunds'] },
  { key: 'head', icon: '👑', label: 'University Head', color: '#7c3aed',
    lead: 'The whole university, under your control.',
    items: ['Change university name, logo and policies', 'Create departments and assign HODs', 'Announcements and meeting notices', 'Upload and approve the BS curriculum', 'University-wide reports and audit trail'] },
];

const MARQUEE = ['🗓️ Timetable', '✅ Attendance', '📝 Assignments', '⚡ Surprise quizzes', '📚 Daily topics', '📊 Results & DMC', '🎫 Admit cards', '💰 Online fees', '🧾 Receipts', '🤖 AI assistant', '📣 Announcements', '🔔 Notifications', '📅 Academic calendar', '🛡️ Role-based access'];

const FEATURES = [
  { icon: '🗓️', title: 'Smart timetable', text: 'Weekly schedules per semester with teacher and room clash protection. Changes notify everyone affected.' },
  { icon: '✅', title: 'Attendance', text: 'Present, absent and approved leave with automatic percentages and shortage warnings.' },
  { icon: '📝', title: 'Assignments & quizzes', text: 'Scheduled and surprise quizzes, deadlines, late tracking, marks and feedback.' },
  { icon: '📚', title: 'Daily topics', text: 'Teachers schedule topics; materials unlock for students on the release date.' },
  { icon: '📊', title: 'Exams, results & DMC', text: 'Date sheets, marks entry, grading rules set by the university, downloadable DMCs.' },
  { icon: '💰', title: 'Online fees', text: 'Fee cart, late-fee calculation, secure verification and receipts.' },
  { icon: '🎫', title: 'Exam admission', text: 'Attendance, fee and document checks decide eligibility, with clear reasons.' },
  { icon: '🤖', title: 'AI study assistant', text: 'Answers from your own course material, plus early support alerts. Recommendations only; marks stay with staff.' },
  { icon: '📣', title: 'Announcements', text: 'Notices and meetings to all or selected departments, delivered by role.' },
];

const STEPS = [
  { n: '1', icon: '🏛️', title: 'The university sets it up', text: 'The head adds departments, uploads the BS curriculum and sets grading and fee rules.' },
  { n: '2', icon: '👩‍🏫', title: 'Departments run it', text: 'HODs create semesters, assign teachers, publish timetables and exam date sheets.' },
  { n: '3', icon: '🎓', title: 'Everyone stays connected', text: 'Students, teachers and finance see their own live dashboard, notifications and records.' },
];

const FAQ = [
  ['How do I get a login?', 'Your department or the university office creates your account. Use the email they registered, then change your password at first sign-in.'],
  ['Can I check my result without logging in?', 'Yes. Use "Check result" and verify yourself. Only a verified student sees results, never the full record from a roll number alone.'],
  ['Does the AI decide my marks or admission?', 'No. Marks, grades, admission and promotion follow university rules and staff review. The AI only gives study support and recommendations.'],
  ['Is my payment safe?', 'Fees are marked paid only after the payment is verified on the server. Card details are never stored.'],
];

// Counts up to `to` when the element scrolls into view.
function Counter({ to, suffix = '' }) {
  const ref = useRef(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min((t - t0) / 1100, 1);
        setN(Math.round(to * (1 - (1 - p) ** 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{n}{suffix}</span>;
}

// Fades a block in when it scrolls into view.
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${on ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

// Try-it widget: the same percentage rule the system uses for attendance.
function AttendanceTry() {
  const [held, setHeld] = useState(40);
  const [att, setAtt] = useState(34);
  const [need, setNeed] = useState(75);
  const a = Math.min(att, held);
  const pct = held ? Math.round((a / held) * 1000) / 10 : 0;
  const ok = pct >= need;
  // how many more classes in a row must be attended to reach the requirement (or can still be missed)
  const mustAttend = Math.max(0, Math.ceil((need / 100 * held - a) / (1 - need / 100)));
  const canMiss = Math.max(0, Math.floor((a * 100 / need) - held));
  return (
    <div className="hm-try">
      <div className="hm-try-controls">
        <label>Classes held so far <b>{held}</b><input type="range" min="5" max="80" value={held} onChange={(e) => { const v = Number(e.target.value); setHeld(v); if (att > v) setAtt(v); }} /></label>
        <label>Classes you attended <b>{a}</b><input type="range" min="0" max={held} value={a} onChange={(e) => setAtt(Number(e.target.value))} /></label>
        <label>Required attendance <b>{need}%</b><input type="range" min="50" max="90" step="5" value={need} onChange={(e) => setNeed(Number(e.target.value))} /></label>
      </div>
      <div className={`hm-try-out ${ok ? 'good' : 'low'}`}>
        <div className="hm-ring big" style={{ '--p': Math.min(pct, 100) }}><span>{pct}%</span></div>
        <div>
          <b>{ok ? 'You are eligible ✓' : 'Below the requirement'}</b>
          <p>{ok
            ? (canMiss > 0 ? `You can still miss ${canMiss} class${canMiss === 1 ? '' : 'es'} and stay above ${need}%.` : 'Keep attending every class to stay above the line.')
            : (mustAttend < 200 ? `Attend the next ${mustAttend} class${mustAttend === 1 ? '' : 'es'} in a row to reach ${need}%.` : 'Attendance is too low to recover by attending alone. Speak to your teacher or HOD.')}</p>
          <small>Your dashboard shows this for every subject automatically.</small>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const user = useSelector((s) => s.auth.user);
  const settings = useSelector((s) => s.settings);
  const [data, setData] = useState(null);
  const [menu, setMenu] = useState(false);
  const [role, setRole] = useState('student');
  const [faq, setFaq] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [word, setWord] = useState(0);
  const visual = useRef(null);

  useEffect(() => { api.get('/public/contact').then((r) => setData(r.data.data)).catch(() => {}); }, []);
  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(window.scrollY > 12);
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);

  // The hero preview leans towards the mouse.
  const tilt = (e) => {
    const el = visual.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${x * 14}deg`);
    el.style.setProperty('--rx', `${-y * 12}deg`);
  };
  const untilt = () => { visual.current?.style.setProperty('--ry', '0deg'); visual.current?.style.setProperty('--rx', '0deg'); };

  const u = data?.university;
  const active = ROLES.find((r) => r.key === role);
  const go = user ? '/dashboard' : '/login';
  const goLabel = user ? 'Open dashboard' : 'Sign in';

  // Admission button: goes to the built-in Apply page, or to the external admission website if the Head set one.
  const ap = settings.admissionPortal;
  const applyLabel = ap?.open ? '🎓 Apply for admission' : '🎓 Admissions';
  const applyLink = (className, label = applyLabel, onClick) => (ap?.externalUrl
    ? <a className={className} href={ap.externalUrl} target="_blank" rel="noreferrer" onClick={onClick}>{label}</a>
    : <Link className={className} to="/apply" onClick={onClick}>{label}</Link>);
  const admissionText = {
    open: 'Applications are open',
    upcoming: ap?.closedReason,
    closed: ap?.closedReason,
    off: 'Admissions are not open at the moment',
  }[ap?.status || 'off'];
  const close = () => setMenu(false);
  const dc = ['#4f46e5', '#0d9488', '#d97706', '#e11d48', '#0284c7', '#7c3aed'];

  return (
    <div className="hm">
      <div className="hm-progress" style={{ width: `${progress}%` }} />

      {/* ---------- navigation ---------- */}
      <header className={`hm-nav ${scrolled ? 'solid' : ''}`}>
        <div className="hm-wrap hm-nav-in">
          <Link to="/" className="hm-brand"><Brand size={40} light={!scrolled} showCampus /></Link>
          <nav className={`hm-links ${menu ? 'open' : ''}`}>
            <a href="#features" onClick={close}>Features</a>
            <a href="#roles" onClick={close}>Who it is for</a>
            <a href="#try" onClick={close}>Try it</a>
            <a href="#news" onClick={close}>Announcements</a>
            <a href="#contact" onClick={close}>Contact</a>
            <a href="#admissions" onClick={close}>Admissions</a>
            <Link to="/check-result" onClick={close}>Check result</Link>
            <Link className="hm-btn hm-btn-solid" to={go} onClick={close}>{goLabel}</Link>
          </nav>
          <button className="hm-burger" aria-label="Menu" onClick={() => setMenu(!menu)}><span /><span /><span /></button>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="hm-hero">
        <div className="hm-blob b1" /><div className="hm-blob b2" /><div className="hm-blob b3" />
        <div className="hm-dots">{Array.from({ length: 14 }).map((_, i) => <i key={i} style={{ '--i': i }} />)}</div>
        <div className="hm-wrap hm-hero-in">
          <div className="hm-hero-text">
            <span className="hm-pill"><b className="hm-pulse" /> Smart Campus{settings.currentAcademicYear ? ` · Academic year ${settings.currentAcademicYear}` : ''}</span>
            <h1>
              One smart campus for<br />
              <span className="hm-rotor"><span key={word} className="hm-grad hm-word">{WORDS[word]}</span></span>
            </h1>
            <p>{settings.universityName}{settings.campusName ? `, ${settings.campusName}` : ''}. Timetables, attendance, assignments, exams, fees and an AI study assistant, connected in one secure platform for students, teachers, departments and administration.</p>
            <div className="hm-cta">
              <Link className="hm-btn hm-btn-solid big glow" to={go}>{goLabel} →</Link>
              <Link className="hm-btn hm-btn-ghost big" to="/check-result">🔍 Check your result</Link>
              {applyLink('hm-btn hm-btn-ghost big')}
            </div>
            <div className="hm-mini">
              <span>🔒 Role-based security</span><span>📱 Phone and desktop</span><span>🤖 AI study help</span>
            </div>
          </div>

          <div className="hm-visual" ref={visual} onMouseMove={tilt} onMouseLeave={untilt} aria-hidden="true">
            <div className="hm-card hm-card-main">
              <div className="hm-card-top"><b>Today</b><span>Preview</span></div>
              <div className="hm-row" style={{ '--c': '#6366f1' }}><i>09:00</i><div><b>Data Structures</b><small>Room 4 · Sec A</small></div><em>Live</em></div>
              <div className="hm-row" style={{ '--c': '#0d9488' }}><i>11:00</i><div><b>Database Systems</b><small>Room 7 · Sec A</small></div></div>
              <div className="hm-row" style={{ '--c': '#d97706' }}><i>01:00</i><div><b>Software Engineering</b><small>Lab 2 · Sec A</small></div></div>
              <div className="hm-bars"><span style={{ '--h': '55%' }} /><span style={{ '--h': '80%' }} /><span style={{ '--h': '65%' }} /><span style={{ '--h': '92%' }} /><span style={{ '--h': '74%' }} /><span style={{ '--h': '88%' }} /></div>
            </div>
            <div className="hm-card hm-float f1"><div className="hm-ring" style={{ '--p': 92 }}><span>92%</span></div><div><b>Attendance</b><small>Above the requirement</small></div></div>
            <div className="hm-card hm-float f2"><span className="hm-ok">✓</span><div><b>Fee paid</b><small>Receipt ready</small></div></div>
            <div className="hm-card hm-float f3"><span className="hm-bot">🤖</span><div><b>AI assistant</b><small>Ask about your course</small></div></div>
            <div className="hm-card hm-float f4"><span className="hm-bot" style={{ background: '#fff4de' }}>🏆</span><div><b>Result published</b><small>DMC ready</small></div></div>
          </div>
        </div>
        <a href="#features" className="hm-scroll" aria-label="Scroll down"><span /></a>
      </section>

      {/* ---------- moving strip ---------- */}
      <div className="hm-marquee" aria-hidden="true">
        <div className="hm-marquee-in">{[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m}</span>)}</div>
      </div>

      {/* ---------- numbers ---------- */}
      <section className="hm-stats">
        <div className="hm-wrap hm-stats-in">
          <div><b><Counter to={data?.departments?.length || 0} /></b><span>Departments</span></div>
          <div><b><Counter to={5} /></b><span>User roles</span></div>
          <div><b><Counter to={9} /></b><span>Core modules</span></div>
          <div><b>24/7</b><span>Online access</span></div>
        </div>
      </section>

      {/* ---------- features ---------- */}
      <section id="features" className="hm-sec">
        <div className="hm-wrap">
          <Reveal className="hm-head"><span className="hm-kicker">Features</span><h2>Everything a university runs on</h2><p>Real workflows, not just screens. Each part is connected to the same records.</p></Reveal>
          <div className="hm-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80}>
                <div className="hm-feat" style={{ '--c': dc[i % 6] }}>
                  <div className="hm-ico">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="hm-sec hm-alt">
        <div className="hm-wrap">
          <Reveal className="hm-head"><span className="hm-kicker">How it works</span><h2>From the principal's desk to every student</h2></Reveal>
          <div className="hm-steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 120}>
                <div className="hm-step" style={{ '--c': dc[i] }}>
                  <div className="hm-step-n">{s.n}</div>
                  <div className="hm-step-ico">{s.icon}</div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- roles (interactive) ---------- */}
      <section id="roles" className="hm-sec">
        <div className="hm-wrap">
          <Reveal className="hm-head"><span className="hm-kicker">Who it is for</span><h2>Pick a role to see what you can do</h2></Reveal>
          <div className="hm-tabs" role="tablist">
            {ROLES.map((r) => (
              <button key={r.key} role="tab" aria-selected={role === r.key} className={role === r.key ? 'on' : ''} style={{ '--c': r.color }} onClick={() => setRole(r.key)}>
                <span>{r.icon}</span>{r.label}
              </button>
            ))}
          </div>
          <div className="hm-role" key={active.key} style={{ '--c': active.color }}>
            <div className="hm-role-side">
              <div className="hm-role-ico">{active.icon}</div>
              <h3>{active.label}</h3>
              <p>{active.lead}</p>
              <Link className="hm-btn hm-btn-solid" to={go}>{user ? 'Open dashboard' : `Sign in as ${active.label}`}</Link>
            </div>
            <ul className="hm-role-list">
              {active.items.map((t, i) => <li key={t} style={{ animationDelay: `${i * 50}ms` }}><span>✓</span>{t}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- try it ---------- */}
      <section id="try" className="hm-sec hm-alt">
        <div className="hm-wrap hm-narrow">
          <Reveal className="hm-head"><span className="hm-kicker">Try it</span><h2>Am I eligible for the exam?</h2><p>Move the sliders. This is the same percentage rule your dashboard uses for attendance.</p></Reveal>
          <Reveal><AttendanceTry /></Reveal>
        </div>
      </section>

      {/* ---------- admissions: status, opening and closing dates, apply / track / merit list ---------- */}
      <section id="admissions" className="hm-sec hm-alt">
        <div className="hm-wrap">
          <Reveal className="hm-head">
            <span className="hm-kicker">Admissions</span>
            <h2>{ap?.intakeName ? `Admissions ${ap.intakeName}` : 'New student admissions'}</h2>
            <p>Apply online, upload your documents and follow your application. No account is needed.</p>
          </Reveal>
          <Reveal>
            <div className="ad-band">
              <div className={`ad-status ${ap?.status || 'off'}`}>{admissionText}</div>
              <div className="ad-dates">
                <div><small>Applications open</small><b>{ap?.startDate ? fmtDate(ap.startDate) : '—'}</b></div>
                <div><small>Last day to apply</small><b>{ap?.deadline ? fmtDate(ap.deadline) : '—'}</b></div>
              </div>
              {ap?.instructions && <p className="ad-note">{ap.instructions}</p>}
              <div className="hm-cta">
                {applyLink('hm-btn hm-btn-solid big')}
                <Link className="hm-btn hm-btn-ghost big" to="/track-application">📄 Track my application</Link>
                {ap?.meritListPublished && <Link className="hm-btn hm-btn-ghost big" to="/merit-list">🏅 Merit list</Link>}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- announcements ---------- */}
      <section id="news" className="hm-sec">
        <div className="hm-wrap">
          <Reveal className="hm-head"><span className="hm-kicker">Latest</span><h2>Announcements</h2></Reveal>
          {data?.announcements?.length ? (
            <div className="hm-grid">
              {data.announcements.slice(0, 6).map((a, i) => (
                <Reveal key={a._id} delay={(i % 3) * 80}>
                  <article className="hm-news">
                    <small>{fmtDate(a.publishDate)}</small>
                    <h3>{a.title}</h3>
                    <p>{a.message}</p>
                    {a.meeting?.date && <div className="hm-meet">📅 {fmtDate(a.meeting.date)} {a.meeting.time || ''} {a.meeting.location ? `· ${a.meeting.location}` : ''}</div>}
                  </article>
                </Reveal>
              ))}
            </div>
          ) : <div className="hm-empty">No public announcements right now. Sign in to see the notices for your role.</div>}
        </div>
      </section>

      {/* ---------- departments ---------- */}
      {data?.departments?.length > 0 && (
        <section className="hm-sec hm-alt">
          <div className="hm-wrap">
            <Reveal className="hm-head"><span className="hm-kicker">Academics</span><h2>Our departments</h2></Reveal>
            <div className="hm-depts">
              {data.departments.map((d, i) => (
                <div key={d._id} className="hm-dept" style={{ '--c': dc[i % 6] }}>
                  <span>{d.code}</span><b>{d.name}</b>{d.contact?.email && <small>{d.contact.email}</small>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- FAQ ---------- */}
      <section className="hm-sec">
        <div className="hm-wrap hm-narrow">
          <Reveal className="hm-head"><span className="hm-kicker">Questions</span><h2>Quick answers</h2></Reveal>
          {FAQ.map(([q, a], i) => (
            <div key={q} className={`hm-faq ${faq === i ? 'open' : ''}`}>
              <button onClick={() => setFaq(faq === i ? -1 : i)}><span>{q}</span><i>{faq === i ? '−' : '+'}</i></button>
              <div className="hm-faq-a"><p>{a}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- call to action ---------- */}
      <section className="hm-cta-band">
        <div className="hm-blob b1" style={{ opacity: .25 }} />
        <div className="hm-wrap">
          <h2>Ready to get started?</h2>
          <p>Sign in with the account your department created for you.</p>
          <div className="hm-cta center">
            <Link className="hm-btn hm-btn-light big" to={go}>{goLabel} →</Link>
            <Link className="hm-btn hm-btn-outline big" to="/check-result">Check result</Link>
          </div>
        </div>
      </section>

      {/* ---------- contact + footer ---------- */}
      <footer id="contact" className="hm-foot">
        <div className="hm-wrap hm-foot-in">
          <div>
            <Brand size={44} showCampus light />
            <p className="hm-foot-note">Smart Campus management system.</p>
          </div>
          <div>
            <h4>Contact</h4>
            <ul>
              {u?.address && <li>📍 {u.address}</li>}
              {u?.contactNumber && <li>📞 {u.contactNumber}</li>}
              {u?.email && <li>✉️ <a href={`mailto:${u.email}`}>{u.email}</a></li>}
              {u?.website && <li>🌐 {u.website}</li>}
              {u?.officeHours && <li>🕘 {u.officeHours}</li>}
              {!u && <li>Loading contact details…</li>}
            </ul>
          </div>
          <div>
            <h4>Quick links</h4>
            <ul>
              <li><Link to={go}>{goLabel}</Link></li>
              <li><Link to="/check-result">Check result</Link></li>
              <li>{applyLink('', 'Apply for admission')}</li>
              <li><Link to="/track-application">Track application</Link></li>
              <li><Link to="/contact">All department contacts</Link></li>
            </ul>
          </div>
        </div>
        <div className="hm-copy">© {new Date().getFullYear()} {settings.universityName}. All rights reserved.</div>
      </footer>

      <button className={`hm-top ${scrolled ? 'show' : ''}`} aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>
    </div>
  );
}
