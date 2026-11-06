import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationCenter } from "./NotificationCenter";

function LanguageToggle({ compact = false }) {
    const { i18n } = useTranslation();
    const isAmharic = i18n.language === "am";

    const toggle = () => {
        const next = isAmharic ? "en" : "am";
        i18n.changeLanguage(next);
        localStorage.setItem("learnhub_user_language", next);
        localStorage.setItem("i18nextLng", next);
        if (typeof document !== "undefined") {
            document.documentElement.lang = next;
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            title={isAmharic ? "Switch to English" : "ወደ አማርኛ ቀይር"}
            aria-label={isAmharic ? "Switch to English" : "Switch to Amharic"}
            className={`flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-card)] font-bold text-[var(--text-main)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--tlh-blue-primary)]/40 hover:bg-[var(--primary-light)] hover:text-[var(--tlh-blue-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tlh-blue-primary)] ${compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-[13px]"
                }`}
        >
            <span className="text-base leading-none" aria-hidden="true">{isAmharic ? "🇺🇸" : "🇪🇹"}</span>
            <span>{isAmharic ? "EN" : "አማ"}</span>
        </button>
    );
}

const navigationItems = [
    { to: "/courses", label: "Courses", i18nKey: "courses" },
    { to: "/how-it-works", label: "How it works", i18nKey: "navHowItWorks" },
    { to: "/instructors", label: "Instructors", i18nKey: "navInstructors" },
    { to: "/faq", label: "FAQ", i18nKey: "faq" },
    { to: "/contact", label: "Contact", i18nKey: "contact" },
];

function navLinkClass({ isActive }) {
    return `rounded-[var(--radius-md)] px-4 py-2.5 text-sm sm:text-[15px] font-bold transition-all whitespace-nowrap tracking-wide ${isActive
        ? "bg-[var(--surface-card)] text-[var(--tlh-blue-primary)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--tlh-blue-primary)]/15 font-extrabold"
        : "text-[var(--text-secondary)] hover:bg-[var(--surface-card)]/80 hover:text-[var(--text-main)] hover:shadow-[var(--shadow-sm)]"
        }`;
}

function NavigationLinks({ onNavigate, mobile = false }) {
    const { t } = useTranslation();
    const location = useLocation();

    return navigationItems.map(({ to, label, i18nKey, end }) => {
        const translated = i18nKey ? t(i18nKey) : label;
        const displayText = translated && translated !== i18nKey ? translated : label;
        return (
            <NavLink
                key={to}
                to={to}
                end={end}
                onClick={(e) => {
                    if (to === "/faq" && (location.pathname === "/" || location.pathname === "/home")) {
                        const faqEl = document.getElementById("faq");
                        if (faqEl) {
                            e.preventDefault();
                            faqEl.scrollIntoView({ behavior: "smooth" });
                        }
                    }
                    onNavigate?.();
                }}
                className={({ isActive }) => mobile
                    ? `flex items-center justify-between rounded-xl px-4 py-3.5 text-base font-bold transition-colors ${isActive ? "bg-sky-50 text-blue-700 font-extrabold" : "text-slate-700 hover:bg-slate-50"
                    }`
                    : navLinkClass({ isActive })}
            >
                {displayText}
                {mobile ? <span aria-hidden="true" className="text-slate-400">→</span> : null}
            </NavLink>
        );
    });
}

export function Navbar() {
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuState, setMobileMenuState] = useState({ pathname: location.pathname, open: false });
    const [logoutError, setLogoutError] = useState("");
    const [loggingOut, setLoggingOut] = useState(false);
    const mobileMenuOpen = mobileMenuState.pathname === location.pathname && mobileMenuState.open;
    const closeMobileMenu = useCallback(
        () => setMobileMenuState({ pathname: location.pathname, open: false }),
        [location.pathname],
    );

    useEffect(() => {
        if (!mobileMenuOpen) return undefined;

        function handleKeyDown(event) {
            if (event.key === "Escape") closeMobileMenu();
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [closeMobileMenu, mobileMenuOpen]);

    const handleLogout = async () => {
        setLoggingOut(true);
        setLogoutError("");
        try {
            await logout();
            closeMobileMenu();
            navigate("/");
        } catch (error) {
            setLogoutError(error instanceof Error ? error.message : "Could not sign out. Please try again.");
        } finally {
            setLoggingOut(false);
        }
    };

    const roleLabel = user?.role === "hub_admin" || user?.role === "admin"
        ? "Admin"
        : user?.role === "teacher"
            ? "Teacher"
            : "Student";
    return (
        <header className="editorial-nav sticky top-0 z-40 border-b border-[var(--surface-border)] shadow-[var(--shadow-sm)] backdrop-blur-xl">
            <div className="mx-auto flex min-h-[5.25rem] sm:min-h-[5.75rem] max-w-[90rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                <Link
                    to="/"
                    className="nav-brand flex items-center gap-2.5 sm:gap-3.5 shrink-0 rounded-[var(--radius-md)] transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--tlh-blue-primary)]"
                    aria-label="TedbabeLearnHUB (TLH) home"
                >
                    <BrandLogo
                        size="md"
                        imgClassName="h-12 sm:h-14 md:h-16 w-auto object-contain drop-shadow-md transition-transform duration-300 hover:scale-105"
                    />
                    <div className="flex flex-col justify-center">
                        <span className="font-bold tracking-tight text-[var(--text-main)] text-xs sm:text-[13px] md:text-sm leading-tight">
                            Tedbabe Learn HUB <span className="text-[var(--tlh-blue-primary)] font-extrabold">(TLH)</span>
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-medium text-[var(--text-secondary)] tracking-widest uppercase">
                            Learn. Grow. Achieve.
                        </span>
                    </div>
                </Link>

                <nav aria-label="Main navigation" className="hidden items-center gap-1.5 rounded-[var(--radius-xl)] border border-[var(--surface-border)] bg-[var(--surface-muted)]/90 p-1.5 lg:flex shadow-inner">
                    <NavigationLinks />
                </nav>

                <div className="flex shrink-0 items-center gap-2.5">
                    {user ? (
                        <div className="hidden items-center gap-2.5 lg:flex">
                            <NotificationCenter />
                            <Link
                                to="/dashboard"
                                className="golden-btn inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs sm:text-[13px] font-bold text-white shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all"
                            >
                                <span className="max-w-36 truncate">{user.fullName || t("dashboard")}</span>
                                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                    {roleLabel}
                                </span>
                            </Link>
                            <button
                                onClick={handleLogout}
                                type="button"
                                disabled={loggingOut}
                                className="rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-60"
                                title={t("signOut")}
                                aria-label={t("signOut")}
                            >
                                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                                    <path d="M10 17l5-5-5-5M15 12H3m9-8h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <div className="hidden items-center gap-2 lg:flex">
                            <Link
                                to="/sign-in"
                                className="rounded-[var(--radius-md)] px-4 py-2.5 text-sm sm:text-[15px] font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]/80 hover:text-[var(--text-main)]"
                            >
                                {t("signIn")}
                            </Link>
                            <Link
                                to="/register/student"
                                className="golden-btn inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs sm:text-[13px] font-bold text-white shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all"
                            >
                                <span>{t("studentSignUp")}</span>
                                <span aria-hidden="true">→</span>
                            </Link>
                        </div>
                    )}

                    {/* Desktop Theme & Language Controls */}
                    <ThemeToggle />
                    <LanguageToggle />

                    <button
                        onClick={() => setMobileMenuState({ pathname: location.pathname, open: !mobileMenuOpen })}
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-secondary)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--tlh-blue-primary)]/40 hover:bg-[var(--primary-light)] hover:text-[var(--tlh-blue-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tlh-blue-primary)] lg:hidden"
                        aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                        aria-expanded={mobileMenuOpen}
                        aria-controls="mobile-navigation"
                    >
                        {mobileMenuOpen ? (
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        ) : (
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {logoutError && (
                <p role="alert" className="mx-auto max-w-7xl px-4 pb-3 text-sm font-medium text-rose-700 sm:px-6 lg:px-8">
                    {logoutError}
                </p>
            )}

            {mobileMenuOpen && (
                <div id="mobile-navigation" className="border-t border-[var(--surface-border)] bg-[var(--surface-card)] px-4 pb-4 pt-3 shadow-lg shadow-black/20 lg:hidden">
                    <nav aria-label="Mobile navigation" className="grid gap-1 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-2 shadow-sm">
                        <NavigationLinks onNavigate={closeMobileMenu} mobile />
                    </nav>

                    {user ? (
                        <div className="mt-3 border-t border-[var(--surface-border)] pt-3">
                            <div className="mb-3 flex items-center gap-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-light)] text-sm font-bold text-[var(--tlh-blue-primary)]" aria-hidden="true">
                                    {(user.fullName || "U").trim().charAt(0).toUpperCase()}
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-[var(--text-main)]">{user.fullName || t("dashboard")}</p>
                                    <p className="text-xs font-medium text-[var(--text-secondary)]">{roleLabel}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Link
                                    to="/dashboard"
                                    onClick={closeMobileMenu}
                                    className="golden-btn rounded-full px-4 py-3 text-center text-sm font-bold text-white shadow-sm"
                                >
                                    {t("dashboard")}
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    type="button"
                                    disabled={loggingOut}
                                    className="rounded-full border border-[var(--surface-border)] px-4 py-3 text-center text-base font-bold text-[var(--text-secondary)] hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-60"
                                >
                                    {loggingOut ? t("loading") : t("signOut")}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--surface-border)] pt-3 lg:hidden">
                            <Link
                                to="/sign-in"
                                onClick={closeMobileMenu}
                                className="rounded-full border border-[var(--surface-border)] px-4 py-3 text-center text-base font-bold text-[var(--text-main)] hover:bg-[var(--surface-muted)] shadow-sm"
                            >
                                {t("signIn")}
                            </Link>
                            <Link
                                to="/register/student"
                                onClick={closeMobileMenu}
                                className="golden-btn rounded-full px-4 py-3 text-center text-sm font-bold text-white shadow-sm"
                            >
                                {t("studentSignUp")} →
                            </Link>
                        </div>
                    )}
                    {/* Mobile Theme & Language Controls */}
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--surface-border)] pt-3">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-semibold text-[var(--text-secondary)]">
                                {i18n.language === "am" ? "ገጽታ" : "Theme"}
                            </span>
                            <ThemeToggle compact />
                        </div>
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-semibold text-[var(--text-secondary)]">
                                {i18n.language === "am" ? "ቋንቋ" : "Language"}
                            </span>
                            <LanguageToggle compact />
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
