import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../lib/api";

export function HelpCenterPage() {
  const { t } = useTranslation();
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
        q: t("helpStudentQuestion1"),
        a: t("helpStudentAnswer1"),
      },
      {
        q: t("helpStudentQuestion2"),
        a: t("helpStudentAnswer2"),
      },
      {
        q: t("helpStudentQuestion3"),
        a: t("helpStudentAnswer3"),
      },
      {
        q: t("helpStudentQuestion4"),
        a: t("helpStudentAnswer4"),
      },
    ],
    teachers: [
      {
        q: t("helpTeacherQuestion1"),
        a: t("helpTeacherAnswer1"),
      },
      {
        q: t("helpTeacherQuestion2"),
        a: t("helpTeacherAnswer2"),
      },
      {
        q: t("helpTeacherQuestion3"),
        a: t("helpTeacherAnswer3"),
      },
    ],
    technical: [
      {
        q: t("helpTechnicalQuestion1"),
        a: t("helpTechnicalAnswer1"),
      },
      {
        q: t("helpTechnicalQuestion2"),
        a: t("helpTechnicalAnswer2"),
      },
      {
        q: t("helpTechnicalQuestion3"),
        a: t("helpTechnicalAnswer3"),
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
      setFeedback(t("helpContactSuccess"));
      setForm({ fullName: "", email: "", subject: "", message: "" });
    } catch (err) {
      setFeedback(err.message || t("helpContactFailure"));
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
            {t("helpCenterKicker")}
          </span>
          <h1 className="editorial-display mt-3 text-4xl font-extrabold text-slate-900 sm:text-5xl">
            {t("helpCenterTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
            {t("helpCenterDescription")}
          </p>

          {/* Quick Search */}
          <div className="mt-8 max-w-md mx-auto">
            <input
              type="text"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder={t("helpSearchPlaceholder")}
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
              { id: "students", label: t("helpStudentsTab"), icon: "🎓" },
              { id: "teachers", label: t("helpTeachersTab"), icon: "👩‍🏫" },
              { id: "technical", label: t("helpTechnicalTab"), icon: "⚙️" },
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
              {t("helpContactKicker")}
            </span>
            <h2 className="editorial-display mt-2 text-2xl font-bold text-slate-900">
              {t("helpContactTitle")}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t("helpContactDescription")}
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
                {t("fullName")}
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
                {t("email")}
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
              {t("subject")}
              <input
                required
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                placeholder={t("helpContactSubjectPlaceholder")}
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              {t("message")}
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                placeholder={t("helpContactMessagePlaceholder")}
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 hover:from-[#0052cc] hover:to-[#0088e6] disabled:opacity-50 transition-all hover:scale-[1.01]"
            >
              {submitting ? t("helpContactSending") : t("helpContactSubmit")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
