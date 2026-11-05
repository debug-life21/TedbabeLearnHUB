import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BrandLogo } from "./BrandLogo";

const currentYear = new Date().getFullYear();

function LinkedInIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
    );
}

function WhatsAppIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
        </svg>
    );
}

function FacebookIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
        </svg>
    );
}

function TwitterXIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
    );
}

function TelegramIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M21.8 4.2 18.6 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 13.5l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6L20.4 3c.9-.3 1.7.2 1.4 1.2Z" />
        </svg>
    );
}

function YouTubeIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
        </svg>
    );
}

function TikTokIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M19.6 6.4a6.3 6.3 0 0 1-3.9-1.3v8.4a6.2 6.2 0 1 1-5.4-6.1v3.5a2.8 2.8 0 1 0 1.9 2.6V2h3.5a6.3 6.3 0 0 0 3.9 4.4v.1Z" />
        </svg>
    );
}

/* ── Social icon definitions — static at footer bottom bar ── */
const SOCIAL_LINKS = [
    {
        href: "https://www.linkedin.com/company/tedbabelearnhub",
        label: "TedbabeLearnHUB on LinkedIn",
        shortLabel: "LinkedIn",
        Icon: LinkedInIcon,
        hoverBorder: "hover:border-[#0A66C2]/60",
        hoverBg:     "hover:bg-[#0A66C2]/15",
        hoverText:   "hover:text-[#70aee0]",
        hoverShadow: "hover:shadow-[#0A66C2]/20",
    },
    {
        href: "https://wa.me/251900000000",
        label: "TedbabeLearnHUB on WhatsApp",
        shortLabel: "WhatsApp",
        Icon: WhatsAppIcon,
        hoverBorder: "hover:border-[#25D366]/50",
        hoverBg:     "hover:bg-[#25D366]/15",
        hoverText:   "hover:text-[#6fe09a]",
        hoverShadow: "hover:shadow-[#25D366]/20",
    },
    {
        href: "https://web.facebook.com/profile.php?id=61589559661444",
        label: "TedbabeLearnHUB on Facebook",
        shortLabel: "Facebook",
        Icon: FacebookIcon,
        hoverBorder: "hover:border-[#1877F2]/55",
        hoverBg:     "hover:bg-[#1877F2]/15",
        hoverText:   "hover:text-[#74a8f7]",
        hoverShadow: "hover:shadow-[#1877F2]/20",
    },
    {
        href: "https://twitter.com/learnhub",
        label: "TedbabeLearnHUB on X (Twitter)",
        shortLabel: "X",
        Icon: TwitterXIcon,
        hoverBorder: "hover:border-white/40",
        hoverBg:     "hover:bg-white/12",
        hoverText:   "hover:text-white",
        hoverShadow: "hover:shadow-white/10",
    },
    {
        href: "https://t.me/learnhub",
        label: "TedbabeLearnHUB on Telegram",
        shortLabel: "Telegram",
        Icon: TelegramIcon,
        hoverBorder: "hover:border-[#229ED9]/55",
        hoverBg:     "hover:bg-[#229ED9]/15",
        hoverText:   "hover:text-[#58c0f5]",
        hoverShadow: "hover:shadow-[#229ED9]/20",
    },
    {
        href: "https://youtube.com/learnhub",
        label: "TedbabeLearnHUB on YouTube",
        shortLabel: "YouTube",
        Icon: YouTubeIcon,
        hoverBorder: "hover:border-[#FF0000]/55",
        hoverBg:     "hover:bg-[#FF0000]/15",
        hoverText:   "hover:text-[#ff6b6b]",
        hoverShadow: "hover:shadow-[#FF0000]/20",
    },
    {
        href: "https://tiktok.com/@learnhub",
        label: "TedbabeLearnHUB on TikTok",
        shortLabel: "TikTok",
        Icon: TikTokIcon,
        hoverBorder: "hover:border-[#EE1D52]/55",
        hoverBg:     "hover:bg-[#EE1D52]/15",
        hoverText:   "hover:text-[#ff5c8a]",
        hoverShadow: "hover:shadow-[#EE1D52]/20",
    },
];

export function Footer() {
    const { t } = useTranslation();
    return (
      <footer className="editorial-footer border-t border-[#172a4d] bg-[var(--tlh-navy-deep)] text-slate-400">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">

          {/* CTA Banner */}
          <div className="mb-10 flex flex-col gap-5 rounded-2xl border border-[var(--tlh-cyan)]/25 bg-gradient-to-br from-[var(--tlh-navy)] via-[var(--tlh-navy-deep)] to-slate-950 p-5 sm:mb-14 sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:p-10 ring-1 ring-white/5">
            <div className="max-w-xl">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-300 sm:text-xs">Your next step starts here</p>
              <h2 className="mt-2 text-lg font-extrabold tracking-tight text-white sm:text-2xl">Ready to learn with TedbabeLearnHUB (TLH)?</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300 sm:mt-2 sm:text-sm">Explore courses, build your skills, and find the support that fits your goals.</p>
            </div>
            <div className="flex flex-wrap gap-2.5 sm:gap-3 shrink-0">
              <Link to="/courses" className="golden-btn inline-flex min-h-10 items-center justify-center rounded-full px-4 py-2 text-xs font-bold text-white shadow-sm hover:shadow-md transition active:scale-95 sm:min-h-11 sm:px-6 sm:text-sm">
                Explore courses
              </Link>
              <Link to="/register/student" className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-sky-400/60 hover:bg-white/10 sm:min-h-11 sm:px-6 sm:text-sm">
                {t("studentSignUp")}
              </Link>
            </div>
          </div>

          {/* Footer Links Grid */}
          <div className="grid grid-cols-3 gap-x-3 gap-y-8 border-b border-white/10 pb-10 sm:grid-cols-2 sm:gap-10 sm:pb-14 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-12">

            {/* Brand Column — Clean with logo and tagline (social icons removed from left side) */}
            <div className="col-span-3 space-y-4 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2">
                <BrandLogo appearance="dark"/>
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-slate-400 sm:text-sm">
                {t("brandTagline")}
              </p>
            </div>

            {/* Learn Column */}
            <div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/90 sm:text-xs">
                Learn
              </h3>
              <ul className="mt-3 space-y-2 text-[11px] font-medium sm:mt-4 sm:space-y-3 sm:text-sm">
                <li><Link to="/courses" className="footer-link">{t("allCourses")}</Link></li>
                <li><Link to="/categories" className="footer-link">{t("categoriesTitle")}</Link></li>
                <li><Link to="/how-it-works" className="footer-link">How it works</Link></li>
                <li><Link to="/pricing" className="footer-link">Options</Link></li>
                <li><Link to="/instructors" className="footer-link">Instructors</Link></li>
              </ul>
            </div>

            {/* Get Involved Column */}
            <div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/90 sm:text-xs">
                Get involved
              </h3>
              <ul className="mt-3 space-y-2 text-[11px] font-medium sm:mt-4 sm:space-y-3 sm:text-sm">
                <li><Link to="/register/student" className="footer-link">{t("studentSignUp")}</Link></li>
                <li><Link to="/apply/teacher" className="footer-link">{t("teacherApply")}</Link></li>
                <li><Link to="/about" className="footer-link">{t("about")}</Link></li>
                <li><Link to="/verify-certificate" className="footer-link">Certificates</Link></li>
              </ul>
            </div>

            {/* Support Column */}
            <div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/90 sm:text-xs">
                Support
              </h3>
              <ul className="mt-3 space-y-2 text-[11px] font-medium sm:mt-4 sm:space-y-3 sm:text-sm">
                <li><Link to="/faq" className="footer-link">{t("faq")}</Link></li>
                <li><Link to="/help" className="footer-link">Help center</Link></li>
                <li><Link to="/contact" className="footer-link">{t("contact")}</Link></li>
                <li><Link to="/privacy" className="footer-link">{t("privacy")}</Link></li>
                <li><Link to="/terms" className="footer-link">{t("terms")}</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar: Copyright on left, Social Media icons, Legal links on right */}
          <div className="flex flex-col gap-5 pt-6 text-[11px] text-slate-400 sm:pt-8 md:flex-row md:items-center md:justify-between">
            {/* Left: Copyright */}
            <p className="font-medium whitespace-nowrap text-slate-400">
              © {currentYear} TedbabeLearnHUB (TLH). All rights reserved.
            </p>

            {/* Center/Right: Static Social Media Icons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:inline mr-1">
                Follow Us:
              </span>
              {SOCIAL_LINKS.map(({ href, label, shortLabel, Icon, hoverBorder, hoverBg, hoverText, hoverShadow }) => (
                <a
                  key={shortLabel}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-all hover:-translate-y-0.5 hover:shadow-md ${hoverBorder} ${hoverBg} ${hoverText} ${hoverShadow}`}
                >
                  <Icon />
                </a>
              ))}
            </div>

            {/* Right: Legal links */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 sm:gap-x-5">
              <Link to="/cookies" className="footer-link">{t("cookies")}</Link>
              <Link to="/acceptable-use" className="footer-link">{t("acceptableUse")}</Link>
              <Link to="/privacy" className="footer-link">{t("privacy")}</Link>
              <Link to="/terms" className="footer-link">{t("terms")}</Link>
              <Link to="/contact" className="footer-link">Contact support</Link>
            </div>
          </div>

        </div>
      </footer>
    );
}
