import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { TIME_ZONES } from "../lib/timezones";
import { DashboardCard } from "./UIComponents";

export function DashboardSettings({ user, sessions = [], onSaved, onNavigateTab }) {
    const { t, i18n } = useTranslation();
    const { refreshUser, logout } = useAuth();

    // ─── 1. Language & Locale ──────────────────────────────────────────────
    const [language, setLanguage] = useState(user.languagePreference || localStorage.getItem("i18nextLng") || i18n.language || "en");
    const [timeZone, setTimeZone] = useState(
        localStorage.getItem("learnhub_timezone") ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        "Africa/Addis_Ababa",
    );
    const [clockFormat, setClockFormat] = useState(
        localStorage.getItem("learnhub_clock_format") || "12h",
    );
    const [savingLang, setSavingLang] = useState(false);
    const [langFeedback, setLangFeedback] = useState("");

    // ─── 2. Notification Preferences & Live Test ──────────────────────────
    const [notifPermission, setNotifPermission] = useState(
        typeof window !== "undefined" && "Notification" in window
            ? Notification.permission
            : "unsupported",
    );
    const [notifSettings, setNotifSettings] = useState(() => {
        try {
            const saved = localStorage.getItem("learnhub_notifications_config");
            if (saved) return JSON.parse(saved);
        } catch {
            // fallback
        }
        return {
            classReminders: true,
            announcements: true,
            soundAlerts: true,
            emailDigest: true,
        };
    });
    const [testAlertFeedback, setTestAlertFeedback] = useState("");

    // ─── 3. Role-Specific Settings ─────────────────────────────────────────
    const [studentPace, setStudentPace] = useState(
        localStorage.getItem("learnhub_student_pace") || "evening",
    );
    const [teacherStatus, setTeacherStatus] = useState(
        localStorage.getItem("learnhub_teacher_availability") || "available",
    );
    const [adminAutoRefresh, setAdminAutoRefresh] = useState(
        localStorage.getItem("learnhub_admin_autorefresh") === "true",
    );

    // ─── 4. Promo Video (hub_admin only) ──────────────────────────────────
    const [promoVideoTitle, setPromoVideoTitle] = useState("");
    const [promoVideoLabel, setPromoVideoLabel] = useState("");
    const [promoVideoInput, setPromoVideoInput] = useState("");
    const [promoVideoSaved, setPromoVideoSaved] = useState(null);
    const [promoVideoFeedback, setPromoVideoFeedback] = useState("");
    const [savingPromoVideo, setSavingPromoVideo] = useState(false);

    // Load existing promo video from backend (admin only)
    const loadPromoSettings = async () => {
        if (!["admin", "hub_admin"].includes(user?.role)) return;
        try {
            const res = await apiRequest("/api/public/settings");
            const raw = res?.settings?.promo_video;
            const normalized = typeof raw === "string"
                ? { title: "", label: "", url: raw }
                : raw && typeof raw === "object"
                    ? { title: raw.title || "", label: raw.label || "", url: raw.url || "" }
                    : { title: "", label: "", url: "" };
            setPromoVideoTitle(normalized.title);
            setPromoVideoLabel(normalized.label);
            setPromoVideoInput(normalized.url);
            setPromoVideoSaved(normalized.url ? normalized : null);
        } catch (err) {
            console.error("Error loading promo settings:", err);
        }
    };

    useEffect(() => {
        void loadPromoSettings();
    }, [user?.role]);

    // Save notification settings to localStorage whenever changed
    useEffect(() => {
        try {
            localStorage.setItem("learnhub_notifications_config", JSON.stringify(notifSettings));
        } catch {
            // ignore
        }
    }, [notifSettings]);

    // Handle Language change and persistence
    const handleSaveLanguage = async (newLang) => {
        setLanguage(newLang);
        setSavingLang(true);
        setLangFeedback("");
        try {
            await apiRequest("/api/auth/profile", {
                method: "PATCH",
                body: JSON.stringify({ languagePreference: newLang }),
            });
            await i18n.changeLanguage(newLang);
            localStorage.setItem("learnhub_user_language", newLang);
            localStorage.setItem("i18nextLng", newLang);
            if (typeof document !== "undefined") {
                document.documentElement.lang = newLang;
            }
            await refreshUser();
            setLangFeedback(newLang === "am" ? "ቋንቋው በተሳካ ሁኔታ ተቀምጧል!" : "Language updated successfully!");
            onSaved?.();
        } catch (error) {
            setLangFeedback(error instanceof Error ? error.message : "Could not save language.");
        } finally {
            setSavingLang(false);
        }
    };

    // Handle Timezone change
    const handleTimeZoneChange = (newTz) => {
        setTimeZone(newTz);
        localStorage.setItem("learnhub_timezone", newTz);
        setLangFeedback(language === "am" ? "የሰዓት ቀጣና ተቀምጧል!" : "Time zone preference saved!");
    };

    // Handle Clock Format change
    const handleClockFormatChange = (format) => {
        setClockFormat(format);
        localStorage.setItem("learnhub_clock_format", format);
    };

    // Play subtle audio chime for notification test
    const playChime = () => {
        if (!notifSettings.soundAlerts) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.32);
        } catch {
            // AudioContext not allowed or not supported
        }
    };

    // Request & Test Browser Notification
    const handleTestNotification = async () => {
        setTestAlertFeedback("");
        if (typeof window === "undefined" || !("Notification" in window)) {
            setTestAlertFeedback("❌ This browser does not support desktop notifications.");
            return;
        }

        let perm = Notification.permission;
        if (perm === "default") {
            perm = await Notification.requestPermission();
            setNotifPermission(perm);
        }

        if (perm === "granted") {
            playChime();
            try {
                const notice = new Notification("TedbabeLearnHUB (TLH)", {
                    body: language === "am"
                        ? "🔔 ማሳወቂያዎች በትክክል እየሰሩ ነው! የክፍል መጀመሪያ እና ማስታወቂያዎች እዚህ ይደርሷችኋል።"
                        : "🔔 Notifications are working properly! Live classes and cohort alerts will show here.",
                    icon: "/tedbabelearnhub-logo.png",
                    tag: "learnhub-test-alert",
                });
                notice.onclick = () => {
                    window.focus();
                    notice.close();
                };
            } catch {
                // notification error on mobile browsers
            }
            setTestAlertFeedback(
                language === "am"
                    ? "✅ የሙከራ ማሳወቂያ በተሳካ ሁኔታ ተልኳል! ማሳወቂያዎች በትክክል ይሰራሉ።"
                    : "✅ Test notification sent! Browser alerts are active and working.",
            );
        } else if (perm === "denied") {
            setTestAlertFeedback(
                language === "am"
                    ? "⚠️ ማሳወቂያዎች በብራውዘርዎ ተዘግተዋል። እባክዎ በብራውዘር ቅንብር (Site Settings) ማሳወቂያዎችን ይፍቀዱ።"
                    : "⚠️ Notifications are blocked in your browser. Please click the padlock icon in the address bar and set Notifications to Allow.",
            );
        }
    };

    // ─── Promo Video CRUD helpers ──────────────────────────────────────────
    const extractYouTubeIdSettings = (url) => {
        if (!url) return null;
        try {
            const u = new URL(url);
            if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
            const v = u.searchParams.get("v");
            if (v) return v;
            const parts = u.pathname.split("/");
            const idx = parts.indexOf("embed");
            if (idx !== -1) return parts[idx + 1];
        } catch {
            const match = url.match(/[\w-]{11}/);
            if (match) return match[0];
        }
        return null;
    };

    const handleSavePromoVideo = async () => {
        const url = promoVideoInput.trim();
        if (!url) return;
        setSavingPromoVideo(true);
        setPromoVideoFeedback("");
        const value = {
            title: promoVideoTitle.trim(),
            label: promoVideoLabel.trim(),
            url,
        };
        try {
            await apiRequest("/api/admin/settings", {
                method: "POST",
                body: JSON.stringify({
                    key: "promo_video",
                    value,
                    description: "Homepage promo / platform overview video (title, label, YouTube URL)",
                }),
            });
            await loadPromoSettings();
            setPromoVideoFeedback("✅ Video updated! It will now appear on the public homepage, before the learning tracks.");
            onSaved?.();
        } catch (err) {
            setPromoVideoFeedback("❌ " + (err?.message || "Could not save the video."));
        } finally {
            setSavingPromoVideo(false);
        }
    };

    const handleRemovePromoVideo = async () => {
        setSavingPromoVideo(true);
        setPromoVideoFeedback("");
        try {
            await apiRequest("/api/admin/settings", {
                method: "POST",
                body: JSON.stringify({ key: "promo_video", value: "", description: "Homepage promo video" }),
            });
            await loadPromoSettings();
            setPromoVideoFeedback("🗑️ Video removed. The section will no longer appear on the homepage.");
            onSaved?.();
        } catch (err) {
            setPromoVideoFeedback("❌ " + (err?.message || "Could not remove the video."));
        } finally {
            setSavingPromoVideo(false);
        }
    };

    return (
        <div className="grid max-w-4xl gap-6">
            {/* Promo Video Management — admin only */}
            {["admin", "hub_admin"].includes(user?.role) && (
                <DashboardCard
                    title="🎬 Permanent Homepage Video"
                    subtitle="Manage the permanent public video shown on the homepage before “Find your next skill”. Once added, it remains permanently displayed on the homepage until you change or remove it."
                >
                    <div className="space-y-4">
                        {/* Title + Label */}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Video Title
                                </label>
                                <input
                                    type="text"
                                    value={promoVideoTitle}
                                    onChange={(e) => setPromoVideoTitle(e.target.value)}
                                    placeholder="e.g. How to register on TedbabeLearnHUB"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Small Label
                                </label>
                                <input
                                    type="text"
                                    value={promoVideoLabel}
                                    onChange={(e) => setPromoVideoLabel(e.target.value)}
                                    placeholder="e.g. HOW TO REGISTER"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                        </div>

                        {/* URL input */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                YouTube Video URL
                            </label>
                            <div className="flex gap-2">
                                <input
                                    id="promo-video-url"
                                    type="url"
                                    value={promoVideoInput}
                                    onChange={(e) => setPromoVideoInput(e.target.value)}
                                    placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                                <button
                                    type="button"
                                    onClick={handleSavePromoVideo}
                                    disabled={savingPromoVideo || !promoVideoInput.trim()}
                                    className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 transition-all"
                                >
                                    {savingPromoVideo ? "Saving…" : "Save"}
                                </button>
                                {promoVideoSaved && (
                                    <button
                                        type="button"
                                        onClick={handleRemovePromoVideo}
                                        disabled={savingPromoVideo}
                                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-all"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                            <p className="mt-1.5 text-[11px] text-slate-500">
                                Accepts: <code className="font-mono">youtube.com/watch?v=…</code> · <code className="font-mono">youtu.be/…</code> · <code className="font-mono">youtube.com/embed/…</code>
                            </p>
                        </div>

                        {/* Live preview */}
                        {(() => {
                            const vid = extractYouTubeIdSettings(promoVideoInput);
                            if (!vid) return null;
                            return (
                                <div className="rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-sm" style={{ aspectRatio: "16/9" }}>
                                    <iframe
                                        title="Promo video preview"
                                        src={`https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&controls=1&fs=1`}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                        allowFullScreen
                                        loading="lazy"
                                    />
                                </div>
                            );
                        })()}

                        {/* Status feedback */}
                        {promoVideoFeedback && (
                            <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                                promoVideoFeedback.startsWith("✅") || promoVideoFeedback.startsWith("🗑")
                                    ? "bg-[var(--primary-light)] text-[var(--tlh-blue-primary)] ring-1 ring-[var(--tlh-blue-primary)]/20"
                                    : "bg-red-50 text-red-800 ring-1 ring-red-200"
                            }`}>
                                {promoVideoFeedback}
                            </div>
                        )}

                        {/* Current live status */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                            {promoVideoSaved ? (
                                <>
                                    <span className="h-2 w-2 rounded-full bg-[var(--tlh-cyan)] animate-pulse" />
                                    <span>Video is <strong className="text-slate-700">live</strong> on the homepage</span>
                                </>
                            ) : (
                                <>
                                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                                    <span>No promo video set — the section is hidden from visitors</span>
                                </>
                            )}
                        </div>
                    </div>
                </DashboardCard>
            )}

            <DashboardCard
                title={language === "am" ? "የቋንቋ እና የሰዓት አቀማመጥ" : "Language & Regional Settings"}
                subtitle={language === "am" ? "የፕላትፎርሙን ቋንቋ እና የሰዓት አቀማመጥ ይምረጡ" : "Customize interface language, timezone, and time format."}
            >
                <div className="space-y-5">
                    {/* Language Selector */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700">
                            {language === "am" ? "የስርዓቱ ቋንቋ (Interface Language)" : "Interface Language"}
                        </label>
                        <div className="mt-2 grid grid-cols-2 gap-3 sm:max-w-md">
                            <button
                                type="button"
                                onClick={() => handleSaveLanguage("am")}
                                disabled={savingLang}
                                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition ${
                                    language === "am"
                                        ? "border-[var(--tlh-blue-primary)] bg-[var(--primary-light)] text-[var(--tlh-blue-primary)] shadow-xs ring-2 ring-[var(--tlh-blue-primary)]/20"
                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                <span className="text-lg" aria-hidden="true">🇪🇹</span>
                                <span>አማርኛ (Amharic)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSaveLanguage("en")}
                                disabled={savingLang}
                                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition ${
                                    language === "en"
                                        ? "border-[var(--tlh-blue-primary)] bg-[var(--primary-light)] text-[var(--tlh-blue-primary)] shadow-xs ring-2 ring-[var(--tlh-blue-primary)]/20"
                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                <span className="text-lg" aria-hidden="true">🇬🇧</span>
                                <span>English</span>
                            </button>
                        </div>
                    </div>

                    {/* Timezone Selector */}
                    <div className="border-t border-slate-100 pt-4">
                        <label className="block text-xs font-bold text-slate-700">
                            {language === "am" ? "የሰዓት ቀጣና (Time Zone)" : "Preferred Time Zone"}
                            <span className="ml-1 text-[11px] font-normal text-slate-500">
                                ({language === "am" ? "የክፍል ሰዓቶች በዚህ ሰዓት ይሰላሉ" : "Session schedules adapt to this timezone"})
                            </span>
                        </label>
                        <select
                            value={timeZone}
                            onChange={(e) => handleTimeZoneChange(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 font-medium focus:border-[var(--tlh-blue-primary)] focus:outline-none sm:max-w-md"
                        >
                            {TIME_ZONES.map((tz) => (
                                <option key={tz.value} value={tz.value}>
                                    {tz.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Clock format */}
                    <div className="border-t border-slate-100 pt-4">
                        <label className="block text-xs font-bold text-slate-700">
                            {language === "am" ? "የሰዓት አቀራረብ (Time Format)" : "Time Format"}
                        </label>
                        <div className="mt-2 flex gap-3">
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                                <input
                                    type="radio"
                                    name="clockFormat"
                                    checked={clockFormat === "12h"}
                                    onChange={() => handleClockFormatChange("12h")}
                                    className="accent-[var(--tlh-blue-primary)]"
                                />
                                12-hour (e.g. 2:30 PM / 8:30)
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                                <input
                                    type="radio"
                                    name="clockFormat"
                                    checked={clockFormat === "24h"}
                                    onChange={() => handleClockFormatChange("24h")}
                                    className="accent-[var(--tlh-blue-primary)]"
                                />
                                24-hour (e.g. 14:30)
                            </label>
                        </div>
                    </div>

                    {langFeedback && (
                        <p role="status" className="rounded-lg bg-[var(--primary-light)] p-2.5 text-xs font-bold text-[var(--tlh-blue-primary)]">
                            {langFeedback}
                        </p>
                    )}
                </div>
            </DashboardCard>

            {/* 2. Notification Center & Live Verification */}
            <DashboardCard
                title={language === "am" ? "የማሳወቂያ ማዕከል እና ማረጋገጫ" : "Notifications & Class Alerts"}
                subtitle={language === "am" ? "ማሳወቂያዎች በትክክል መስራታቸውን ይፈትሹ እና ያቀናብሩ" : "Verify notifications and customize alert preferences."}
            >
                <div className="space-y-4">
                    {/* Live Test Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-base" aria-hidden="true">🔔</span>
                                <h4 className="text-sm font-bold text-cyan-950">
                                    {language === "am" ? "የማሳወቂያ ሁኔታ (Notification Status)" : "Desktop Notifications Status"}
                                </h4>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    notifPermission === "granted"
                                        ? "bg-[var(--primary-light)] text-[var(--tlh-blue-primary)]"
                                        : notifPermission === "denied"
                                            ? "bg-rose-100 text-rose-800"
                                            : "bg-amber-100 text-amber-800"
                                }`}>
                                    {notifPermission === "granted"
                                        ? (language === "am" ? "ተፈቅዷል (Active)" : "Enabled")
                                        : notifPermission === "denied"
                                            ? (language === "am" ? "ተዘግቷል (Blocked)" : "Blocked")
                                            : (language === "am" ? "ተጠባባቂ (Needs Permission)" : "Default")}
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-cyan-900 leading-relaxed">
                                {notifPermission === "granted"
                                    ? (language === "am" ? "ማሳወቂያዎች ንቁ ናቸው። የክፍለ-ጊዜ መጀመሪያዎች ከመድረሳቸው 15 ደቂቃ በፊት ይደርሶዎታል።" : "Notifications are active. You will receive alerts before upcoming live classes.")
                                    : notifPermission === "denied"
                                        ? (language === "am" ? "ማሳወቂያዎች በብራውዘር ተዘግተዋል። በብራውዘር መቆጣጠሪያ ላይ ይፍቀዱላቸው።" : "Notifications are blocked. Please allow notifications in your browser's site settings.")
                                        : (language === "am" ? "የቀጥታ ስርጭት ትምህርት እንዳያመልጥዎ ማሳወቂያዎችን ያንቁ።" : "Enable browser notifications so you never miss a scheduled live lesson.")}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleTestNotification}
                            className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-cyan-800 active:scale-95"
                        >
                            <span>🔔</span>
                            <span>{language === "am" ? "የሙከራ ማሳወቂያ ላክ (Test Alert)" : "Send Test Notification"}</span>
                        </button>
                    </div>

                    {testAlertFeedback && (
                        <p role="status" className="rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-800 shadow-xs">
                            {testAlertFeedback}
                        </p>
                    )}

                    {/* Notification Toggles */}
                    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white">
                        <label className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-50/50">
                            <div className="pr-4">
                                <p className="text-xs font-bold text-slate-900">
                                    {language === "am" ? "የክፍለ-ጊዜ 15 ደቂቃ ማሳሰቢያ" : "15-minute live class reminders"}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    {language === "am" ? "ክፍል ከመጀመሩ በፊት በብራውዘርዎ ማንቂያ ይሰጣል" : "Trigger alerts 15 minutes before your scheduled live class"}
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notifSettings.classReminders}
                                onChange={(e) => setNotifSettings({ ...notifSettings, classReminders: e.target.checked })}
                                className="h-4 w-4 rounded accent-[var(--tlh-blue-primary)]"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-50/50">
                            <div className="pr-4">
                                <p className="text-xs font-bold text-slate-900">
                                    {language === "am" ? "የክፍል ማስታወቂያዎች እና ዝመናዎች" : "Cohort announcements & updates"}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    {language === "am" ? "አስተማሪዎ ወይም አድሚኑ አዲስ መልእክት ሲለጥፉ ያሳውቃል" : "Receive instant notices when instructors post assignments or cohort announcements"}
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notifSettings.announcements}
                                onChange={(e) => setNotifSettings({ ...notifSettings, announcements: e.target.checked })}
                                className="h-4 w-4 rounded accent-[var(--tlh-blue-primary)]"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-50/50">
                            <div className="pr-4">
                                <p className="text-xs font-bold text-slate-900">
                                    {language === "am" ? "የድምፅ ማንቂያ (Sound Chime)" : "Audio chime on alert"}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    {language === "am" ? "ማሳወቂያ ሲመጣ ረጋ ያለ የድምፅ ምልክት ያሰማል" : "Play a gentle chime when class reminder alerts trigger"}
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notifSettings.soundAlerts}
                                onChange={(e) => setNotifSettings({ ...notifSettings, soundAlerts: e.target.checked })}
                                className="h-4 w-4 rounded accent-[var(--tlh-blue-primary)]"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-50/50">
                            <div className="pr-4">
                                <p className="text-xs font-bold text-slate-900">
                                    {language === "am" ? "የኢሜይል ማሳወቂያዎች (Email notifications)" : "Email summaries & security notices"}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    {language === "am" ? "አስፈላጊ ዝመናዎች እና የይለፍ ቃል ለውጦች በኢሜይል ይላካሉ" : "Deliver account security alerts and cohort summaries to your email"}
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notifSettings.emailDigest}
                                onChange={(e) => setNotifSettings({ ...notifSettings, emailDigest: e.target.checked })}
                                className="h-4 w-4 rounded accent-[var(--tlh-blue-primary)]"
                            />
                        </label>
                    </div>
                </div>
            </DashboardCard>

            {/* 3. Role-Specific Essential Controls */}
            {user.role === "student" && (
                <DashboardCard
                    title={language === "am" ? "የትምህርት ምርጫዎች (Learning Preferences)" : "Learning Preferences"}
                    subtitle={language === "am" ? "የትምህርት ሰዓት እና የጥናት ፍጥነት ምርጫዎን ይቆጣጠሩ" : "Set your study pacing and cohort availability preferences."}
                >
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700">
                                {language === "am" ? "ተመራጭ የትምህርት ሰዓት" : "Preferred Study Window"}
                            </label>
                            <select
                                value={studentPace}
                                onChange={(e) => {
                                    setStudentPace(e.target.value);
                                    localStorage.setItem("learnhub_student_pace", e.target.value);
                                }}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 sm:max-w-md"
                            >
                                <option value="morning">{language === "am" ? "የጠዋት ክፍለ-ጊዜዎች (Morning)" : "Morning sessions"}</option>
                                <option value="evening">{language === "am" ? "የምሽት ክፍለ-ጊዜዎች (Evening)" : "Evening sessions (after work/school)"}</option>
                                <option value="weekend">{language === "am" ? "የቅዳሜ እና እሁድ ክፍለ-ጊዜዎች (Weekends)" : "Weekends only"}</option>
                                <option value="flexible">{language === "am" ? "ተለዋዋጭ (Any time)" : "Flexible / Any schedule"}</option>
                            </select>
                        </div>
                    </div>
                </DashboardCard>
            )}

            {user.role === "teacher" && (
                <DashboardCard
                    title={language === "am" ? "የአስተማሪ የስራ ዝግጁነት ሁኔታ" : "Teaching & Availability Status"}
                    subtitle={language === "am" ? "ለተማሪዎች ጥያቄ እና ለክፍል ዝግጁ መሆንዎን ያመልክቱ" : "Let learners know your current availability for questions and review."}
                >
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700">
                                {language === "am" ? "የአሁኑ ሁኔታ (Current Status)" : "Availability Status"}
                            </label>
                            <select
                                value={teacherStatus}
                                onChange={(e) => {
                                    setTeacherStatus(e.target.value);
                                    localStorage.setItem("learnhub_teacher_availability", e.target.value);
                                }}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 sm:max-w-md"
                            >
                                <option value="available">🟢 {language === "am" ? "ጥያቄዎችን ለመቀበል ዝግጁ ነኝ (Available for inquiries)" : "Available for inquiries"}</option>
                                <option value="teaching">🟡 {language === "am" ? "ክፍል እያስተማርኩ ነው (In session)" : "In session / Teaching"}</option>
                                <option value="busy">🔴 {language === "am" ? "ስራ ላይ ነኝ (Away / Grading)" : "Away / Grading"}</option>
                            </select>
                        </div>
                    </div>
                </DashboardCard>
            )}

            {(user.role === "admin" || user.role === "hub_admin") && (
                <DashboardCard
                    title={language === "am" ? "የአድሚን ስርዓት ምርጫዎች" : "Admin Operations & System Controls"}
                    subtitle={language === "am" ? "የማስተዳደሪያ ስርዓት ፈጣን ማደሻ እና የቁጥጥር ዝርዝሮች" : "Configure administrator platform tools and refresh settings."}
                >
                    <div className="space-y-3">
                        <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
                            <div>
                                <p className="text-xs font-bold text-slate-900">
                                    {language === "am" ? "የአስተማሪ ማመልከቻ ማንቂያዎች" : "Instant Teacher Application Alerts"}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    {language === "am" ? "አዲስ አስተማሪ ሲያመለክት በዳሽቦርዱ ላይ የማንቂያ ባጅ ያሳያል" : "Show immediate badge and notification when a new instructor applies"}
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={adminAutoRefresh}
                                onChange={(e) => {
                                    setAdminAutoRefresh(e.target.checked);
                                    localStorage.setItem("learnhub_admin_autorefresh", String(e.target.checked));
                                }}
                                className="h-4 w-4 rounded accent-[var(--tlh-blue-primary)]"
                            />
                        </label>
                    </div>
                </DashboardCard>
            )}

            {/* 4. Account Profile & Security Quick Actions */}
            <DashboardCard
                title={language === "am" ? "የመለያ ደህንነት እና መረጃ" : "Account & Security Overview"}
                subtitle={language === "am" ? "የመለያዎን መረጃ እና የይለፍ ቃል ደህንነት ይከታተሉ" : "Your active account details and security status."}
            >
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-[var(--tlh-blue-primary)]/20" />
                        ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--tlh-navy)] to-[var(--tlh-blue-primary)] text-sm font-bold text-white">
                                {(user.fullName || user.email || "U").charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <p className="text-sm font-bold text-slate-900">{user.fullName || user.name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[var(--primary-light)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--tlh-blue-primary)] border border-[var(--tlh-blue-primary)]/20">
                            {user.role}
                        </span>
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-800">
                            {user.isVerified ? "✓ Verified" : "Unverified"}
                        </span>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-600">
                        {language === "am"
                            ? "የይለፍ ቃል ለመቀየር በዳሽቦርዱ በግራ በኩል ያለውን 'የመለያ ደህንነት' (Security) ክፍል ይጠቀሙ።"
                            : "To update your password or view security activity, visit the Account security tab."}
                    </p>
                    {onNavigateTab && (
                        <button
                            type="button"
                            onClick={() => onNavigateTab("security")}
                            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                            🔒 {language === "am" ? "ወደ ደህንነት ሂድ" : "Go to Security"}
                        </button>
                    )}
                </div>
            </DashboardCard>
        </div>
    );
}
