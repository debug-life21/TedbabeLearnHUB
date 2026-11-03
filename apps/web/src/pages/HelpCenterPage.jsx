import { useState } from "react";
import { apiRequest } from "../lib/api";

export function HelpCenterPage() {
  const [faqSearch, setFaqSearch] = useState("");
  const [activeSection, setActiveSection] = useState("students");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  const helpArticles = {
    students: [
      {
        q: "How does cohort assignment work after I register?",
        a: "Once you sign up and choose your learning preferences, a Hub Administrator reviews your skill level and schedule. You will be placed into an active class cohort led by an approved instructor. You will see your assigned cohort and upcoming classes in your Student Dashboard.",
      },
      {
        q: "How do I join scheduled live classes with Google Meet?",
        a: "In your Student Dashboard, upcoming lessons display with their start time and an active 'Join Meeting' button. Simply click this button at class time to enter your instructor's Google Meet room.",
      },
      {
        q: "When can I see my grades and progress report?",
        a: "Your teacher reviews assignments and assessments, then publishes your progress report. Grades, self-assessment, and progress details are visible only after publication. You can claim a certificate after your teacher publishes an overall score of at least 70%.",
      },
      {
        q: "Can I download class resources and slides for offline study?",
        a: "Yes. In the 'Learning Resources' tab of your dashboard, you can view PDF worksheets, presentations, and audio files in-browser or download them securely.",
      },
    ],
    teachers: [
      {
        q: "How do I become an approved TedbabeLearnHUB educator?",
        a: "Submit a teaching application at /apply/teacher with your academic qualifications and teaching expertise. After verification, an administrator will review and activate your teacher portal.",
      },
      {
        q: "How do I record student attendance and schedule classes?",
        a: "From your Teacher Dashboard, select your assigned cohort. You can launch Google Meet sessions, record attendance (Present, Late, Absent, Excused) for each student, and assign homework.",
      },
      {
        q: "Can I create custom multiple-choice assessments?",
        a: "Yes. Teachers can create timed quizzes with custom questions and answer options. TedbabeLearnHUB automatically grades student attempts server-side and provides instant score reporting.",
      },
    ],
    technical: [
      {
        q: "What if I didn't receive my 6-digit email verification code?",
        a: "Check your spam or junk folder. You can request a new verification code after 60 seconds from the verification screen by clicking 'Resend code'.",
      },
      {
        q: "How do I reset my password if I forgot it?",
        a: "Visit the Forgot Password page (/forgot-password), enter your account email, and click 'Send Reset Instructions'. You will receive a time-limited reset link and recovery code.",
      },
      {
        q: "Can I switch the platform language between Amharic and English?",
        a: "Yes! Use the language switcher in the header navigation or the profile preferences in your account settings at any time.",
      },
    ],
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback("");
    try {
      await apiRequest("/api/public/contact", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setFeedback(
        "Your inquiry has been submitted. Our support team will get back to you shortly.",
      );
      setForm({ fullName: "", email: "", subject: "", message: "" });
    } catch (err) {
      setFeedback(err.message || "Failed to submit inquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentArticles = helpArticles[activeSection] || [];
  const filteredArticles = faqSearch.trim()
    ? Object.values(helpArticles)
        .flat()
        .filter(
          (art) =>
            art.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
            art.a.toLowerCase().includes(faqSearch.toLowerCase()),
        )
    : currentArticles;

  return (
    <div className="editorial-page min-h-screen pb-24">
      {/* Header Hero */}
      <div className="editorial-hero border-b border-slate-200/80 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <span className="editorial-kicker text-blue-600 font-extrabold tracking-widest">
            TEDBABELEARNHUB (TLH) SUPPORT & KNOWLEDGE BASE
          </span>
          <h1 className="editorial-display mt-3 text-4xl font-extrabold text-slate-900 sm:text-5xl">
            Help & Support Center
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
            Guides, answers, and direct assistance for students, educators, and
            administrators.
          </p>

          {/* Quick Search */}
          <div className="mt-8 max-w-md mx-auto">
            <input
              type="text"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder="Search help topics (e.g. Google Meet, placement, grading)…"
              className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 lg:px-8">
        {!faqSearch && (
          <div className="flex justify-center gap-3 border-b border-slate-200 pb-4">
            {[
              { id: "students", label: "For Students", icon: "🎓" },
              { id: "teachers", label: "For Teachers", icon: "👩‍🏫" },
              { id: "technical", label: "Account & Technical", icon: "⚙️" },
            ].map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeSection === sec.id
                    ? "bg-gradient-to-r from-[#0066ff] to-[#0099ff] text-white shadow-md shadow-blue-500/25"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {sec.icon} {sec.label}
              </button>
            ))}
          </div>
        )}

        {/* Articles List */}
        <div className="mt-8 space-y-4">
          {filteredArticles.map((art, idx) => (
            <div
              key={idx}
              className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200/80 transition hover:shadow-md"
            >
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-start gap-3">
                <span className="text-blue-600 font-black">Q:</span>
                <span>{art.q}</span>
              </h3>
              <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed pl-6">
                {art.a}
              </p>
            </div>
          ))}
        </div>

        {/* Contact Support Ticket Form */}
        <div className="mt-16 rounded-3xl bg-white p-8 sm:p-12 shadow-sm ring-1 ring-slate-200">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <span className="text-xs font-black uppercase tracking-wider text-blue-600">
              DIRECT ASSISTANCE
            </span>
            <h2 className="editorial-display mt-2 text-2xl font-bold text-slate-900">
              Still have questions? Contact Support
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Our academic administrators and support specialists respond to
              inquiries promptly.
            </p>
          </div>

          {feedback && (
            <div className="mb-6 rounded-2xl bg-sky-50 p-4 text-xs font-bold text-blue-900 ring-1 ring-sky-200 text-center">
              {feedback}
            </div>
          )}

          <form
            onSubmit={handleContactSubmit}
            className="max-w-xl mx-auto space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Your Full Name
                <input
                  required
                  type="text"
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  placeholder="John Doe"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Email Address
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  placeholder="name@example.com"
                />
              </label>
            </div>

            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Subject
              <input
                required
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                placeholder="E.g. Placement question for Grade 10 Math"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Detailed Message
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                placeholder="Describe your issue or inquiry in detail…"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 hover:from-[#0052cc] hover:to-[#0088e6] disabled:opacity-50 transition-all hover:scale-[1.01]"
            >
              {submitting ? "Sending Inquiry…" : "Submit Support Inquiry"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
