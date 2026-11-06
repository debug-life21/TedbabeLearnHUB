import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// Role-based caps matching the backend NOTIFICATION_CAPS
const NOTIFICATION_CAPS = { hub_admin: 20, admin: 20, teacher: 10, student: 10 };
const getCapForRole = (role) => NOTIFICATION_CAPS[role] ?? 10;

// Play a subtle, non-intrusive notification chime using Web Audio API
function playAlertChime() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch {
        // AudioContext may be restricted by autoplay policy until user gesture
    }
}

const ALLOWED_ROLES = new Set(["student", "teacher", "hub_admin", "admin"]);

export function NotificationCenter() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const [activeToast, setActiveToast] = useState(null);
    const knownIdsRef = useRef(new Set());
    const dropdownRef = useRef(null);

    const cap = user ? getCapForRole(user.role) : 10;
    const isAdmin = user?.role === "hub_admin" || user?.role === "admin";

    const fetchNotifications = useCallback(async () => {
        if (!user || !ALLOWED_ROLES.has(user.role)) return;
        try {
            let merged = [];

            if (isAdmin) {
                // Admins get their own notification feed from the dedicated endpoint
                const adminRes = await apiRequest("/api/admin/notifications").catch(() => ({ notifications: [] }));
                merged = adminRes?.notifications || [];
            } else {
                const apiPrefix = user.role === "teacher" ? "/api/teacher" : "/api/student";
                const [dashRes, annRes] = await Promise.all([
                    apiRequest(`${apiPrefix}/dashboard`).catch(() => ({})),
                    apiRequest(`${apiPrefix}/announcements`).catch(() => ({ announcements: [] })),
                ]);

                const notifs = dashRes?.notifications || [];
                const anns = (annRes?.announcements || []).map((ann) => ({
                    _id: ann._id,
                    title: `📢 ${ann.title}`,
                    message: ann.content,
                    createdAt: ann.createdAt,
                    kind: "announcement",
                    link: ann.classroom ? `/workspace/${ann.classroom}` : "/dashboard",
                    priority: ann.priority,
                }));

                // Merge and sort, then enforce cap
                merged = [...anns, ...notifs];
                merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            }

            // Enforce the role-based cap on the frontend too
            const capped = merged.slice(0, cap);

            // Keep knownIds bounded to avoid memory growth
            if (knownIdsRef.current.size > cap * 3) {
                knownIdsRef.current = new Set([...knownIdsRef.current].slice(-cap));
            }

            // Check for new items to alert
            const isInitial = knownIdsRef.current.size === 0;
            const newHighPriority = [];

            capped.forEach((item) => {
                if (!knownIdsRef.current.has(item._id)) {
                    knownIdsRef.current.add(item._id);
                    if (!isInitial) {
                        newHighPriority.push(item);
                    }
                }
            });

            setNotifications(capped);
            setUnreadCount(capped.filter((n) => !n.isRead && !n.read).length || Math.min(capped.length, 3));

            // Trigger toast alert for newest notification
            if (newHighPriority.length > 0) {
                const latest = newHighPriority[0];
                setActiveToast(latest);
                playAlertChime();
            }
        } catch {
            // Non-blocking background fetch
        }
    }, [user, cap, isAdmin]);

    // Poll every 25 seconds for prompt alerts
    useEffect(() => {
        if (!user) return undefined;
        fetchNotifications();
        const interval = window.setInterval(fetchNotifications, 25000);
        return () => window.clearInterval(interval);
    }, [user, fetchNotifications]);

    // Auto-dismiss toast after 7s
    useEffect(() => {
        if (!activeToast) return undefined;
        const timer = window.setTimeout(() => setActiveToast(null), 7000);
        return () => window.clearTimeout(timer);
    }, [activeToast]);

    // Close on outside click
    useEffect(() => {
        if (!open) return undefined;
        function handleClick(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    if (!user || !ALLOWED_ROLES.has(user.role)) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Notification Bell Button */}
            <button
                type="button"
                onClick={() => {
                    setOpen(!open);
                    if (!open) setUnreadCount(0);
                }}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none shadow-xs"
                aria-label="View notifications and cohort alerts"
            >
                <span className="text-lg">🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Floating Dropdown Panel */}
            {open && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1322] p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 text-slate-900 dark:text-white">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-2">
                            <span className="text-base">📢</span>
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                {isAdmin ? "Admin Alerts" : "Class Alerts & Notices"}
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                {notifications.length}/{cap} max
                            </span>
                            <button
                                type="button"
                                onClick={() => setUnreadCount(0)}
                                className="text-[11px] font-semibold text-blue-600 dark:text-amber-400 hover:underline"
                            >
                                Mark all read
                            </button>
                        </div>
                    </div>

                    <div className="mt-3 max-h-80 overflow-y-auto space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                                No new notifications or class alerts.
                            </div>
                        ) : (
                            notifications.map((item) => (
                                <Link
                                    key={item._id}
                                    to={item.link || "/dashboard"}
                                    onClick={() => setOpen(false)}
                                    className="block pt-2.5 first:pt-0 group hover:bg-slate-50 dark:hover:bg-slate-800/70 p-2 rounded-xl transition"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-amber-400 leading-snug">
                                            {item.title}
                                        </h4>
                                        {item.priority === "urgent" && (
                                            <span className="shrink-0 rounded bg-rose-100 dark:bg-rose-950/80 px-1.5 py-0.5 text-[9px] font-black text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                                                URGENT
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                        {item.message}
                                    </p>
                                    <span className="mt-1 block text-[10px] text-slate-400 dark:text-slate-500">
                                        {new Date(item.createdAt || Date.now()).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </Link>
                            ))
                        )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-center">
                        <Link
                            to="/dashboard"
                            onClick={() => setOpen(false)}
                            className="text-xs font-bold text-[var(--tlh-blue-primary)] dark:text-amber-400 hover:underline"
                        >
                            Go to Dashboard →
                        </Link>
                    </div>
                </div>
            )}

            {/* Prompt Toast Alert Banner (Appears immediately when a notice arrives) */}
            {activeToast && (
                <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-emerald-500/80 dark:border-emerald-600/60 bg-slate-950 p-4 text-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-sm">
                                🔔
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                                New Class Notice
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveToast(null)}
                            className="text-slate-400 hover:text-white text-xs font-bold"
                        >
                            ✕
                        </button>
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-white">{activeToast.title}</h4>
                    <p className="mt-1 text-xs text-slate-300 line-clamp-2">{activeToast.message}</p>
                    <div className="mt-3 flex items-center justify-end gap-2">
                        <Link
                            to={activeToast.link || "/dashboard"}
                            onClick={() => setActiveToast(null)}
                            className="golden-btn rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                        >
                            Open Alert →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
