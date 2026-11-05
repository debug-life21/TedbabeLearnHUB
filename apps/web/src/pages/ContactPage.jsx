import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../lib/api";
import { SectionHeading } from "../components/UIComponents";
import { BrandLogo } from "../components/BrandLogo";

export function ContactPage() {
    const { t } = useTranslation();
    const [form, setForm] = useState({
        fullName: "",
        email: "",
        subject: "",
        message: "",
    });
    const [status, setStatus] = useState("idle");
    const [feedback, setFeedback] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus("submitting");
        setFeedback("");
        try {
            const res = await apiRequest("/api/public/contact", {
                method: "POST",
                body: JSON.stringify(form),
            });
            setStatus("success");
            setFeedback(res.message);
            setForm({ fullName: "", email: "", subject: "", message: "" });
        }
        catch (err) {
            setStatus("error");
            setFeedback(err.message || "Failed to submit message. Please try again.");
        }
    };

    return (
        <div className="editorial-page mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-12">
            <SectionHeading badge="WE’RE LISTENING" title={t("contactTitle")} subtitle={t("contactDescription")}/>

            <div className="grid gap-10 lg:grid-cols-2">
                {/* Contact Form */}
                <div className="rounded-3xl bg-white p-8 sm:p-10 shadow-sm ring-1 ring-slate-200/90">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {status === "success" ? (
                            <div className="rounded-2xl bg-sky-50 p-4 text-xs sm:text-sm font-semibold text-blue-900 ring-1 ring-sky-200 flex items-center gap-2">
                                <span className="font-bold text-blue-600">✓</span>
                                <span>{feedback}</span>
                            </div>
                        ) : null}

                        {status === "error" ? (
                            <div className="rounded-2xl bg-rose-50 p-4 text-xs sm:text-sm font-semibold text-rose-800 ring-1 ring-rose-200 flex items-center gap-2">
                                <span>⚠</span>
                                <span>{feedback}</span>
                            </div>
                        ) : null}

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">{t("fullName")}</label>
                            <input
                                required
                                type="text"
                                value={form.fullName}
                                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                                className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                                placeholder="e.g. Samuel Haile"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">{t("email")}</label>
                            <input
                                required
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                                placeholder="samuel@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">{t("subject")}</label>
                            <input
                                required
                                type="text"
                                value={form.subject}
                                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                                className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                                placeholder="How can we help?"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">{t("message")}</label>
                            <textarea
                                required
                                rows={4}
                                value={form.message}
                                onChange={(e) => setForm({ ...form, message: e.target.value })}
                                className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                                placeholder="Tell us a little about what you need…"
                            />
                        </div>

                        <button
                            disabled={status === "submitting"}
                            type="submit"
                            className="golden-btn w-full rounded-full py-3.5 text-xs font-bold text-white shadow-sm hover:shadow-md disabled:opacity-50 transition-all active:scale-95"
                        >
                            {status === "submitting" ? t("loading") : t("submit")}
                        </button>
                    </form>
                </div>

                {/* Contact Info & Office Card — Brand Dark Layout */}
                <div className="space-y-8">
                    <div className="rounded-3xl border border-[var(--tlh-cyan)]/25 bg-gradient-to-br from-[var(--tlh-navy)] via-[var(--tlh-navy-deep)] to-slate-950 p-8 sm:p-10 text-white shadow-xl ring-1 ring-white/10">
                        <div className="flex items-center justify-between gap-4 mb-6">
                            <BrandLogo appearance="dark" />
                            <span className="rounded-full border border-sky-400/30 bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-300">
                                OFFICIAL SUPPORT
                            </span>
                        </div>

                        <h3 className="mt-2 text-2xl font-black text-white">{t("supportCenter")}</h3>
                        <p className="mt-3 text-sm text-slate-300 leading-relaxed font-normal">
                            {t("supportCenterDesc")}
                        </p>

                        <div className="mt-8 space-y-5 text-sm">
                            <div className="flex items-center gap-3.5 text-slate-200">
                                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--tlh-navy)] border border-sky-500/30 text-sky-400 text-lg shadow-sm">
                                    ✉️
                                </span>
                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase">Email our team</p>
                                    <a href="mailto:support@tedbabelearnhub.com" className="font-semibold text-white hover:text-sky-300 transition-colors">
                                        support@tedbabelearnhub.com
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-center gap-3.5 text-slate-200">
                                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--tlh-navy)] border border-sky-500/30 text-sky-400 text-lg shadow-sm">
                                    📍
                                </span>
                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase">Headquarters</p>
                                    <p className="font-semibold text-white">{t("addisAbabaEthiopia")}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3.5 text-slate-200">
                                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--tlh-navy)] border border-sky-500/30 text-sky-400 text-lg shadow-sm">
                                    ⏰
                                </span>
                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase">Support hours</p>
                                    <p className="font-semibold text-white">{t("businessHours")}</p>
                                </div>
                            </div>
                        </div>

                        {/* Social Media Links */}
                        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Follow TLH:
                            </span>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <a
                                    href="https://www.linkedin.com/company/tedbabelearnhub"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 hover:border-sky-400/50 hover:bg-sky-500/15 hover:text-sky-200 transition"
                                >
                                    LinkedIn
                                </a>
                                <a
                                    href="https://wa.me/251900000000"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 hover:border-[#25D366]/50 hover:bg-[#25D366]/15 hover:text-[#6fe09a] transition"
                                >
                                    WhatsApp
                                </a>
                                <a
                                    href="https://web.facebook.com/profile.php?id=61589559661444"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 hover:border-[#1877F2]/50 hover:bg-[#1877F2]/15 hover:text-[#74a8f7] transition"
                                >
                                    Facebook
                                </a>
                                <a
                                    href="https://t.me/learnhub"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 hover:border-[#229ED9]/50 hover:bg-[#229ED9]/15 hover:text-[#58c0f5] transition"
                                >
                                    Telegram
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
