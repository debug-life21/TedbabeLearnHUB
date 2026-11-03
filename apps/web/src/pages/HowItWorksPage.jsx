import { Link } from "react-router-dom";

export function HowItWorksPage() {
  const studentSteps = [
    {
      number: "01",
      title: "Register & Share Learning Goals",
      description:
        "Sign up with email or Google. Choose your subject of interest (Languages, Grades 1–12, Computing, Business), your starting skill level, and your preferred learning schedule.",
      tag: "GETTING STARTED",
    },
    {
      number: "02",
      title: "Hub Administrator Placement",
      description:
        "To prevent overcrowded classrooms and ensure balanced groups, a TedbabeLearnHUB Administrator reviews your profile and matches you to an active cohort led by an approved, specialized instructor.",
      tag: "CURATED COHORTS",
    },
    {
      number: "03",
      title: "Interactive Live Classes via Google Meet",
      description:
        "Join scheduled live sessions directly from your student dashboard. Participate in real-time discussions, ask questions, and download lesson presentations and PDF worksheets.",
      tag: "LIVE INSTRUCTION",
    },
    {
      number: "04",
      title: "Teacher-Reviewed Assessments",
      description:
        "Teachers create quizzes, midterms, finals, comprehensive assessments, written tasks, and self-assessments. They review submissions and release results when ready.",
      tag: "HANDS-ON PRACTICE",
    },
    {
      number: "05",
      title: "Continuous Progress & Verified Certificate",
      description:
        "Your teacher prepares and publishes your progress report, including assessment results and feedback. A published overall score of 70% or higher is required to claim an official certificate.",
      tag: "CREDENTIAL",
    },
  ];

  const teacherSteps = [
    {
      number: "01",
      title: "Submit Teaching Application",
      description:
        "Educators apply with their background, experience, and subjects of expertise. Verification codes guarantee authentic contact info.",
    },
    {
      number: "02",
      title: "Administrative Review & Approval",
      description:
        "TedbabeLearnHUB administrators thoroughly review qualifications before approving accounts, guaranteeing exceptional instruction.",
    },
    {
      number: "03",
      title: "Cohort Management & Teaching",
      description:
        "Conduct lessons, create assignments, grade student work, record attendance, and share learning resources from a dedicated portal.",
    },
  ];

  return (
    <div className="editorial-page min-h-screen pb-24">
      {/* Header Hero */}
      <div className="editorial-hero border-b border-slate-200/80 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <span className="editorial-kicker text-blue-600 font-extrabold tracking-widest">
            LEARNING ARCHITECTURE
          </span>
          <h1 className="editorial-display mt-3 text-4xl font-extrabold text-slate-900 sm:text-5xl">
            How TedbabeLearnHUB Works
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base text-slate-600 sm:text-lg leading-relaxed">
            TedbabeLearnHUB (TLH) bridges self-paced online materials with real
            teacher accountability, structured cohort placement, live
            interactive classes, and verified credentials.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              to="/register/student"
              className="editorial-button text-xs font-black"
            >
              Join as a Student →
            </Link>
            <Link
              to="/apply/teacher"
              className="editorial-button-secondary text-xs font-bold"
            >
              Teach with TedbabeLearnHUB
            </Link>
          </div>
        </div>
      </div>

      {/* Student Journey Steps */}
      <div className="mx-auto max-w-5xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-xs font-black uppercase tracking-wider text-blue-600">
            THE LEARNER JOURNEY
          </span>
          <h2 className="editorial-display mt-2 text-3xl font-bold text-slate-900">
            From Registration to Certified Mastery
          </h2>
        </div>

        <div className="space-y-6">
          {studentSteps.map((step, idx) => (
            <div
              key={idx}
              className="flex flex-col sm:flex-row items-start gap-6 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200/80 transition hover:shadow-md"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#001b44] font-mono text-xl font-black text-sky-400 border border-sky-500/30 shadow-md">
                {step.number}
              </div>
              <div className="space-y-1.5 flex-1">
                <span className="rounded-md bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-sky-200/60">
                  {step.tag}
                </span>
                <h3 className="editorial-display text-xl font-bold text-slate-900">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Educator Quality Section — Brand Dark Layout */}
      <div className="mx-auto max-w-5xl px-4 pt-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-sky-500/25 bg-gradient-to-br from-[#0c234b] via-[#091b3b] to-[#061124] p-8 sm:p-12 text-white shadow-xl ring-1 ring-white/10">
          <div className="max-w-3xl">
            <span className="text-xs font-black uppercase tracking-wider text-sky-300">
              TEACHER RECRUITMENT & EXCELLENCE
            </span>
            <h2 className="editorial-display mt-2 text-3xl font-bold text-white">
              Vetted, Dedicated Educators
            </h2>
            <p className="mt-3 text-xs text-slate-300 leading-relaxed">
              Unlike open marketplace platforms where anyone can post courses,
              TedbabeLearnHUB instructors are vetted and approved by our
              academic administrators. Every class is actively guided by a
              passionate educator.
            </p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {teacherSteps.map((tStep, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10"
              >
                <div className="font-mono text-lg font-black text-sky-400 mb-2">
                  {tStep.number}
                </div>
                <h4 className="text-sm font-bold text-white mb-2">
                  {tStep.title}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tStep.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center pt-4 border-t border-white/10">
            <Link
              to="/apply/teacher"
              className="inline-flex rounded-xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:from-[#0052cc] hover:to-[#0088e6] hover:-translate-y-0.5"
            >
              Apply to Teach on TedbabeLearnHUB →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
