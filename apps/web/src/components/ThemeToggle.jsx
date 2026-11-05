import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function ThemeToggle({ compact = false }) {
    const { i18n } = useTranslation();
    const isAmharic = i18n.language === "am";
    const [theme, setTheme] = useState(() => {
        if (typeof window === "undefined") return "light";
        const saved = localStorage.getItem("learnhub_theme");
        if (saved) return saved === "dark" || saved === "bluedark" ? "dark" : "light";
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    });

    const isDark = theme === "dark";

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add("dark");
            root.classList.remove("bluedark");
            root.setAttribute("data-theme", "dark");
            localStorage.setItem("learnhub_theme", "dark");
        } else {
            root.classList.remove("dark", "bluedark");
            root.setAttribute("data-theme", "light");
            localStorage.setItem("learnhub_theme", "light");
        }
    }, [isDark]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    };

    const label = isDark
        ? isAmharic ? "ወደ ብርሃን ቀይር" : "Switch to Light Mode"
        : isAmharic ? "ወደ ዘመናዊ ዳርክ ቀይር" : "Switch to Modern Dark Mode";

    const textLabel = isDark
        ? isAmharic ? "ብርሃን" : "Light"
        : isAmharic ? "ዳርክ" : "Dark";

    return (
        <button
            type="button"
            onClick={toggleTheme}
            title={label}
            aria-label={label}
            className={`flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-card)] font-bold text-[var(--text-main)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--tlh-gold)] hover:bg-[var(--surface-muted)] hover:text-[var(--tlh-gold)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tlh-gold)] ${
                compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-[13px]"
            }`}
        >
            <span className="text-base leading-none" aria-hidden="true">
                {isDark ? "☀️" : "🌙"}
            </span>
            <span className="tracking-tight">{textLabel}</span>
        </button>
    );
}
