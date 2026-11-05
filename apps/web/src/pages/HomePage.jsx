import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../lib/api";
import { SectionHeading, MetricCard } from "../components/UIComponents";
import { BrandLogo } from "../components/BrandLogo";

function getCategoryIcon(name = "") {
    const lower = name.toLowerCase();
    if (lower.includes("code") || lower.includes("soft") || lower.includes("dev") || lower.includes("web") || lower.includes("program")) return "💻";
    if (lower.includes("design") || lower.includes("ui") || lower.includes("ux") || lower.includes("art")) return "🎨";
    if (lower.includes("data") || lower.includes("ai") || lower.includes("machine") || lower.includes("python")) return "📊";
    if (lower.includes("mobile") || lower.includes("app") || lower.includes("flutter")) return "📱";
    if (lower.includes("biz") || lower.includes("bus") || lower.includes("manage") || lower.includes("market")) return "💼";
    if (lower.includes("lang") || lower.includes("speak") || lower.includes("english")) return "🗣️";
    if (lower.includes("science") || lower.includes("math")) return "🔬";
    return "💡";
}

const HERO_SLIDES = [
    {
        id: 1,
        src: "/hero-1.jpg",
        tagEn: "Collaborative Tech & Coding Studio",
        badge: "HANDS-ON PRACTICE",
        highlight: "Build through guided projects",
        animClass: "animate-kenburns-1",
    },
    {
        id: 2,
        src: "/hero-2.jpg",
        tagEn: "Expert Teacher-Led Live Classes",
        badge: "LIVE INSTRUCTION",
        highlight: "Learn with expert instructors",
        animClass: "animate-kenburns-2",
    },
    {
        id: 3,
        src: "/hero-3.jpg",
        tagEn: "Verified Progress & Mastery",
        badge: "VISIBLE PROGRESS",
        highlight: "See the progress you make",
        animClass: "animate-kenburns-3",
    },
    {
        id: 4,
        src: "/hero-4.jpg",
        tagEn: "Connected Education Network",
        badge: "LEARNING COMMUNITY",
        highlight: "Move forward together",
        animClass: "animate-kenburns-4",
    },
];

// Extract a YouTube video ID from various YouTube URL formats
function extractYouTubeId(url) {
    if (!url) return null;
    try {
        const u = new URL(url);
        // youtu.be/VIDEO_ID
        if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
        // youtube.com/watch?v=VIDEO_ID
        const v = u.searchParams.get("v");
        if (v) return v;
        // youtube.com/embed/VIDEO_ID
        const parts = u.pathname.split("/");
        const embedIdx = parts.indexOf("embed");
        if (embedIdx !== -1) return parts[embedIdx + 1];
    } catch {
        // fallback: bare ID
        const match = url.match(/[\w-]{11}/);
        if (match) return match[0];
    }
    return null;
}

const DEFAULT_PROMO_TITLE = "See How TedbabeLearnHUB Works";
const DEFAULT_PROMO_LABEL = "PLATFORM OVERVIEW";

// Normalise the admin-managed promo video setting into { title, label, url }
function normalizePromoVideo(raw) {
    if (!raw) return null;
    if (typeof raw === "string") {
        const url = raw.trim();
        return url ? { title: DEFAULT_PROMO_TITLE, label: DEFAULT_PROMO_LABEL, url } : null;
    }
    if (typeof raw === "object") {
        const url = String(raw.url || "").trim();
        if (!url) return null;
        return {
            title: String(raw.title || "").trim() || DEFAULT_PROMO_TITLE,
            label: String(raw.label || "").trim() || DEFAULT_PROMO_LABEL,
            url,
        };
    }
    return null;
}

export function HomePage() {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [promoVideo, setPromoVideo] = useState(null);
    const [featuredFilter, setFeaturedFilter] = useState("all");
    const [openFaqIndex, setOpenFaqIndex] = useState(0);

    // Selected category state for interactive drill-down
    const programsRef = useRef(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categoryProgramsMap, setCategoryProgramsMap] = useState({});
    const [loadingPrograms, setLoadingPrograms] = useState(false);

    useEffect(() => {
        apiRequest("/api/public/home")
            .then((res) => setData(res))
            .catch((err) => console.error("Error fetching homepage data:", err));
        // Fetch public settings to get the admin-managed public video
        apiRequest("/api/public/settings")
            .then((res) => {
                const promo = normalizePromoVideo(res?.settings?.promo_video);
                if (promo) {
                    console.log("[TedbabeLearnHUB] Promo video loaded:", promo.title);
                    setPromoVideo(promo);
                }
            })
            .catch((err) => console.error("[TedbabeLearnHUB] Error loading settings:", err));
    }, []);

    const handleCategorySelect = async (cat) => {
        if (selectedCategory?._id === cat._id) {
            setSelectedCategory(null);
            return;
        }
        setSelectedCategory(cat);
        setTimeout(() => {
            programsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 80);

        if (categoryProgramsMap[cat._id]) {
            return;
        }

        setLoadingPrograms(true);
        try {
            const res = await apiRequest(`/api/public/courses?category=${cat._id}&limit=20`);
            setCategoryProgramsMap((prev) => ({
                ...prev,
                [cat._id]: res?.courses || [],
            }));
        } catch (err) {
            console.error("Failed to load category courses:", err);
            const fallback = (data?.featuredCourses || []).filter(
                (c) => c.category?._id === cat._id || c.category === cat._id
            );
            setCategoryProgramsMap((prev) => ({
                ...prev,
                [cat._id]: fallback,
            }));
        } finally {
            setLoadingPrograms(false);
        }
    };

    // Auto-advance slides every 6 seconds
    useEffect(() => {
        if (isPaused)
            return;
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [isPaused]);
    const activeSlide = HERO_SLIDES[currentSlide];
    return (<div className="editorial-page space-y-24 pb-20">
      {/* 1. Hero Section with Ultra-Clear & Dynamic Multi-Image Carousel */}
      <section onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)} className="relative overflow-hidden bg-[var(--tlh-navy)] py-24 sm:py-32 text-white min-h-[700px] lg:min-h-[800px] flex items-center select-none">
        {/* Multi-Image Animated Crossfade Layers with Ultra Clarity */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {HERO_SLIDES.map((slide, index) => {
            const isActive = index === currentSlide;
            return (<div key={slide.id} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isActive ? "opacity-90 z-1" : "opacity-0 z-0 pointer-events-none"}`}>
                <img src={slide.src} alt={slide.tagEn} className={`w-full h-full object-cover object-center filter saturate-115 contrast-105 brightness-90 ${isActive ? slide.animClass : ""}`}/>
              </div>);
        })}

          {/* Calibrated Crisp Framing Overlays - preserving 100% image clarity */}
          <div className="absolute top-0 inset-x-0 h-44 z-2 bg-gradient-to-b from-[var(--tlh-navy)]/90 via-[var(--tlh-navy)]/40 to-transparent pointer-events-none"></div>
          <div className="absolute bottom-0 inset-x-0 h-52 z-2 bg-gradient-to-t from-[var(--tlh-navy)] via-[var(--tlh-navy)]/80 to-transparent pointer-events-none"></div>
          <div className="absolute inset-0 z-2 bg-[var(--tlh-navy)]/40 pointer-events-none"></div>
          <div className="absolute inset-0 z-2 bg-[radial-gradient(circle_at_center,_transparent_40%,_rgba(7,27,73,0.7)_100%)] pointer-events-none"></div>

          {/* Dynamic Light Beam Sweep */}
          <div className="absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-[var(--tlh-cyan)]/20 to-transparent blur-xl pointer-events-none z-2 animate-beam-sweep"></div>
        </div>

        {/* Floating Animated Atmospheric Glowing Orbs */}
        <div className="absolute top-1/6 left-1/12 w-80 h-80 rounded-full bg-[var(--tlh-cyan)]/25 blur-3xl pointer-events-none animate-float-1 z-3"></div>
        <div className="absolute bottom-1/6 right-1/12 w-96 h-96 rounded-full bg-[var(--tlh-blue-primary)]/30 blur-3xl pointer-events-none animate-float-2 z-3"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-[var(--tlh-cyan)]/15 blur-[130px] pointer-events-none animate-pulse-glow z-3"></div>

        {/* Floating Live Interactive HUD Badges (Desktop) */}
        <div className="hero-hud-card hidden xl:flex absolute top-32 right-12 z-20 items-center gap-4 rounded-[var(--radius-xl)] border border-white/15 bg-[#071B49]/80 dark:bg-[#071B49]/90 p-4 backdrop-blur-xl shadow-[var(--shadow-lg)] animate-hud-float">
          <div className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
          </div>
          <div className="text-left text-xs">
            <p className="font-extrabold text-white tracking-wide">Live Mentor-Led Cohorts</p>
            <p className="text-emerald-400 font-semibold mt-0.5">{data?.stats?.activeClasses ?? 0} active batches enrolling now</p>
          </div>
        </div>

        <div className="hero-hud-card hidden xl:flex absolute bottom-32 left-12 z-20 items-center gap-4 rounded-[var(--radius-xl)] border border-white/15 bg-[#071B49]/80 dark:bg-[#071B49]/90 p-4 backdrop-blur-xl shadow-[var(--shadow-lg)] animate-hud-float-delayed">
          <div className="h-10 w-10 rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--tlh-blue-primary)] to-[var(--tlh-cyan)] flex items-center justify-center font-bold text-white text-base shadow-lg">
            ✓
          </div>
          <div className="text-left text-xs">
            <p className="font-extrabold text-white tracking-wide">Guaranteed Practical Mastery</p>
            <p className="text-[var(--tlh-cyan)] font-semibold mt-0.5">Real client projects & verified certificates</p>
          </div>
        </div>

        {/* Central Frosted Glass Content Card */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center w-full">
          <div className="hero-content-card mx-auto max-w-4xl rounded-[var(--radius-3xl)] border border-white/15 bg-[#071B49]/80 dark:bg-[#071B49]/90 p-8 sm:p-12 lg:p-16 backdrop-blur-xl shadow-[var(--shadow-lg)] ring-1 ring-white/10 transition-all">
            {/* Official TLH Brand Logo — Hero Presentation */}
            <div className="mb-6 flex justify-center">
              <BrandLogo size="lg" appearance="dark" className="shadow-2xl ring-2 ring-white/20" />
            </div>

            {/* Active Slide Theme Badge */}
            <div className="inline-flex items-center gap-3 rounded-full border border-[var(--tlh-cyan)]/40 bg-slate-950/90 px-5 py-2 text-xs font-semibold text-[var(--tlh-cyan)] shadow-2xl shadow-slate-950/50 backdrop-blur-md transition-all">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--tlh-cyan)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--tlh-cyan)]"></span>
              </span>
              <span className="font-black text-white tracking-wide">{activeSlide.tagEn}</span>
              <span className="rounded-md bg-slate-950/95 px-2.5 py-1 text-[10px] font-black text-[var(--tlh-cyan)] border border-[var(--tlh-cyan)]/50 uppercase tracking-widest">
                {activeSlide.badge}
              </span>
            </div>

            <h1 className="hero-main-title mt-8 text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
              <span className="text-white drop-shadow-md">
                {t("heroTitle")}
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl lg:text-2xl text-slate-100 max-w-2xl mx-auto leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] font-medium">
              {t("heroDescription")}
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-5">
              <Link to="/register/student" className="golden-btn group relative inline-flex items-center gap-3 rounded-full px-9 py-4 text-base font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95">
                <span className="relative z-10">{t("heroPrimary")}</span>
                <span className="relative z-10 transition-transform group-hover:translate-x-1.5 font-bold text-lg">→</span>
              </Link>
              <Link to="/courses" className="rounded-full border border-white/20 bg-slate-900/80 px-10 py-5 text-base font-bold text-slate-200 backdrop-blur-md hover:bg-slate-800/90 hover:border-[#D97706] hover:text-[#D97706] transition-all shadow-sm">
                {t("heroSecondary")}
              </Link>
            </div>
          </div>

          {/* Interactive Slide Preview Cards & Navigation Controls */}
          <div className="mt-10 flex flex-col items-center gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-4xl w-full px-2">
              {HERO_SLIDES.map((slide, idx) => {
            const isCurrent = idx === currentSlide;
            return (<button key={slide.id} onClick={() => setCurrentSlide(idx)} type="button" className={`relative group overflow-hidden rounded-2xl p-2 transition-all flex items-center gap-2.5 text-left border ${isCurrent
                    ? "bg-slate-900/90 border-[var(--tlh-cyan)] shadow-lg shadow-blue-500/25 scale-102 ring-1 ring-[var(--tlh-cyan)]"
                    : "bg-slate-950/70 border-white/10 hover:border-white/30 hover:bg-slate-900/80"}`}>
                    <div className="relative h-10 w-12 rounded-lg overflow-hidden shrink-0 border border-white/20">
                      <img src={slide.src} alt="" className="w-full h-full object-cover"/>
                      {isCurrent && <div className="absolute inset-0 bg-[var(--tlh-cyan)]/20 ring-1 ring-inset ring-[var(--tlh-cyan)]"></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-[var(--tlh-cyan)]">0{slide.id}</span>
                        <span className="text-[11px] font-bold text-white truncate">
                          {slide.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate hidden sm:block">
                        {slide.highlight}
                      </p>
                    </div>
                  </button>);
        })}
            </div>

            {/* Quick Arrow controls & progress dots */}
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <button onClick={() => setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)} className="h-8 w-8 rounded-full bg-slate-900/80 border border-white/15 flex items-center justify-center hover:bg-[var(--tlh-cyan)] hover:text-white transition-colors" title="Previous Slide" type="button">
                ‹
              </button>
              <div className="flex gap-2">
                {HERO_SLIDES.map((_, i) => (<button key={i} onClick={() => setCurrentSlide(i)} className={`h-2 rounded-full transition-all duration-500 ${i === currentSlide ? "w-8 bg-[var(--tlh-cyan)] shadow-sm shadow-[var(--tlh-cyan)]" : "w-2 bg-slate-600 hover:bg-slate-400"}`} aria-label={`Go to slide ${i + 1}`}></button>))}
              </div>
              <button onClick={() => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)} className="h-8 w-8 rounded-full bg-slate-900/80 border border-white/15 flex items-center justify-center hover:bg-[var(--tlh-cyan)] hover:text-white transition-colors" title="Next Slide" type="button">
                ›
              </button>
            </div>
          </div>
        </div>

        {/* Slide Progress Bar across bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-900 z-10 overflow-hidden">
          <div key={currentSlide} className="h-full bg-gradient-to-r from-[var(--tlh-blue-primary)] via-[var(--tlh-cyan)] to-[var(--tlh-orange)] transition-all" style={{
            animation: isPaused ? "none" : "progressFill 6000ms linear",
        }}></div>
        </div>
      </section>

      {/* 2. Modern Bento Grid: Architectural Pillars */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <SectionHeading badge="THE TEDBABELEARNHUB (TLH) DIFFERENCE" title="A more human way to build real-world skills" subtitle="TedbabeLearnHUB (TLH) combines expert instruction, hands-on practice, and steady support to help you keep moving forward." centered/>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Bento Card 1: Placement */}
          <div className="rounded-[var(--radius-2xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-sm)] ring-1 ring-[var(--surface-border)] hover:shadow-[var(--shadow-md)] hover:ring-[var(--tlh-blue-primary)]/40 transition-all flex flex-col justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary-light)] text-[var(--tlh-blue-primary)] text-3xl">
                🧭
              </div>
              <h3 className="mt-6 text-xl font-bold text-[var(--tlh-navy)]">{t("bentoPlacementTitle")}</h3>
              <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                {t("bentoPlacementDesc")}
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-xs font-bold text-[var(--tlh-blue-primary)]">
              <span>Find a cohort that fits your goals</span>
              <span>✓</span>
            </div>
          </div>

          {/* Bento Card 2: Live Google Meet */}
          <div className="rounded-[var(--radius-2xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-sm)] ring-1 ring-[var(--surface-border)] hover:shadow-[var(--shadow-md)] hover:ring-[var(--tlh-cyan)]/40 transition-all flex flex-col justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-cyan-50 text-[var(--tlh-cyan)] text-3xl">
                📹
              </div>
              <h3 className="mt-6 text-xl font-bold text-[var(--tlh-navy)]">{t("bentoMeetTitle")}</h3>
              <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                {t("bentoMeetDesc")}
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-xs font-bold text-[var(--tlh-cyan)]">
              <span>Join your instructor and cohort live</span>
              <span>✓</span>
            </div>
          </div>

          {/* Bento Card 3: 40/40/20 Grading */}
          <div className="rounded-[var(--radius-2xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-sm)] ring-1 ring-[var(--surface-border)] hover:shadow-[var(--shadow-md)] hover:ring-[var(--tlh-blue-primary)]/40 transition-all flex flex-col justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-sky-50 text-[var(--tlh-blue-primary)] text-3xl">
                📊
              </div>
              <h3 className="mt-6 text-xl font-bold text-[var(--tlh-navy)]">{t("bentoGradingTitle")}</h3>
              <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                {t("bentoGradingDesc")}
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-xs font-bold text-[var(--tlh-blue-primary)]">
              <span>Understand what you have mastered</span>
              <span>✓</span>
            </div>
          </div>

          {/* Bento Card 4: Verified Educators (Spans 2 cols on lg) */}
          <div className="md:col-span-2 rounded-[var(--radius-2xl)] bg-gradient-to-br from-[var(--tlh-navy)] via-[var(--tlh-navy-deep)] to-slate-950 p-8 sm:p-10 text-white shadow-[var(--shadow-lg)] ring-1 ring-white/10 flex flex-col justify-between">
            <div className="max-w-2xl">
              <span className="rounded-full bg-[var(--tlh-cyan)]/20 px-4 py-1.5 text-xs font-bold text-[var(--tlh-cyan)] border border-[var(--tlh-cyan)]/30 uppercase tracking-wider">
                LEARN WITH CONFIDENCE
              </span>
              <h3 className="mt-5 text-3xl sm:text-4xl font-black tracking-tight">{t("bentoVettedTitle")}</h3>
              <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
                {t("bentoVettedDesc")} We bring structure, care, and accountability to every learning experience.
              </p>
            </div>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/register/student" className="rounded-[var(--radius-lg)] bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-8 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-500/25 hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] transition-all hover:-translate-y-0.5">
                {t("becomeStudent")}
              </Link>
              <Link to="/apply/teacher" className="rounded-[var(--radius-lg)] border border-white/20 bg-white/10 px-8 py-3 text-sm font-bold text-white hover:bg-white/20 transition-all hover:-translate-y-0.5">
                {t("applyToTeach")}
              </Link>
            </div>
          </div>

          {/* Bento Card 5: Security & RBAC */}
          <div className="rounded-[var(--radius-2xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-sm)] ring-1 ring-[var(--surface-border)] hover:shadow-[var(--shadow-md)] hover:ring-indigo-500/40 transition-all flex flex-col justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-indigo-50 text-indigo-600 text-3xl">
                🛡️
              </div>
              <h3 className="mt-6 text-xl font-bold text-[var(--text-main)]">A focused learning space</h3>
              <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                Keep your classes, resources, assignments, and progress together in one secure workspace.
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-xs font-bold text-indigo-600">
              <span>Your learning, organized in one place</span>
              <span>✓</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3b. Admin-Managed Public Video — Cinematic Premium Media Showcase */}
      {(() => {
        if (!promoVideo) return null;
        const videoId = extractYouTubeId(promoVideo.url);
        const isGoogleDrive = promoVideo.url.includes("drive.google.com");
        let embedSrc = "";
        if (videoId) {
          embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&controls=1&fs=1&color=white`;
        } else if (isGoogleDrive) {
          embedSrc = promoVideo.url.replace(/\/view(\?.*)?$/, "/preview");
        } else {
          embedSrc = promoVideo.url;
        }

        return (
          <section className="relative w-full bg-[var(--tlh-navy)] py-20 overflow-hidden text-white selection:bg-[var(--tlh-cyan)] selection:text-black">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-tr from-[var(--tlh-blue-primary)]/20 via-[var(--tlh-cyan)]/20 to-[var(--tlh-orange)]/20 blur-[130px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-20 left-1/4 w-[500px] h-[250px] bg-[var(--tlh-blue-primary)]/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              {/* Section Header */}
              <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
                <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--tlh-cyan)]/30 bg-[var(--tlh-navy-deep)]/40 px-4 py-1.5 text-xs font-black tracking-wider uppercase text-[var(--tlh-cyan)] backdrop-blur-md shadow-[0_0_20px_rgba(18,188,235,0.15)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--tlh-cyan)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--tlh-cyan)]" />
                  </span>
                  <span>{promoVideo.label || "Platform Showcase"}</span>
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                  {promoVideo.title || "Experience How TedbabeLearnHUB Works"}
                </h2>
                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                  Take an exclusive tour through structured cohorts, live scheduled lessons, interactive materials, and certified skill mastery.
                </p>
              </div>

              {/* Cinematic Video Player Container with Custom Cinema Bezel */}
              <div className="relative mx-auto max-w-5xl rounded-3xl p-1 bg-gradient-to-b from-[var(--tlh-cyan)]/30 via-slate-700/20 to-transparent shadow-[0_20px_90px_rgba(18,102,232,0.25)] ring-1 ring-white/10">
                <div className="relative rounded-[22px] overflow-hidden bg-[var(--tlh-navy)]/95 backdrop-blur-xl">
                  {/* Top Media Bar / Window Frame */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-slate-900/80">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-rose-500/80 shadow-sm" />
                      <span className="h-3 w-3 rounded-full bg-amber-500/80 shadow-sm" />
                      <span className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-sm" />
                      <span className="ml-3 text-[11px] font-semibold text-slate-400 truncate max-w-xs sm:max-w-md">
                        {promoVideo.title || "TedbabeLearnHUB Video Player"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[var(--tlh-cyan)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--tlh-cyan)] border border-[var(--tlh-cyan)]/20">
                        1080p HD
                      </span>
                      <span className="hidden sm:inline-block rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                        Official Channel
                      </span>
                    </div>
                  </div>

                  {/* 16:9 Video Canvas */}
                  <div
                    className="relative w-full bg-black overflow-hidden"
                    style={{ aspectRatio: "16/9" }}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <iframe
                      title={promoVideo.title || "Platform Overview"}
                      src={embedSrc}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                    />
                  </div>
                </div>
              </div>

              {/* Three Value Badges Below Video */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
                <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-3.5 backdrop-blur-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tlh-blue-primary)]/10 text-[var(--tlh-blue-primary)] text-lg">
                    🎯
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Cohort Placements</h4>
                    <p className="text-[11px] text-slate-400">Learn with peers at your skill level</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-3.5 backdrop-blur-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tlh-cyan)]/10 text-[var(--tlh-cyan)] text-lg">
                    📹
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Live Scheduled Classes</h4>
                    <p className="text-[11px] text-slate-400">Punctual Google Meet start times</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-3.5 backdrop-blur-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 text-lg">
                    🎓
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Verified Credentials</h4>
                    <p className="text-[11px] text-slate-400">Authentic completion certificates</p>
                  </div>
                </div>
              </div>

              {/* Sub-label below video */}
              <p className="mt-6 text-center text-xs text-slate-500 font-medium">
                Official TedbabeLearnHUB overview · Maintained by platform administrators
              </p>
            </div>
          </section>
        );
      })()}

      {/* 4. Curated Learning Categories (Click to reveal programs) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="LEARNING TRACKS"
          title={t("categoriesTitle")}
          subtitle={t("categoriesSubtitle")}
          centered
        />

        {/* Categories Grid - clickable cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.categories ?? []).map((cat) => {
            const isSelected = selectedCategory?._id === cat._id;
            return (
              <button
                key={cat._id}
                type="button"
                onClick={() => handleCategorySelect(cat)}
                aria-expanded={isSelected}
                className={`group text-left rounded-[var(--radius-2xl)] p-6 transition-all flex flex-col justify-between cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tlh-blue-primary)] ${
                  isSelected
                    ? "bg-[var(--primary-light)] ring-2 ring-[var(--tlh-blue-primary)] shadow-[var(--shadow-lg)] -translate-y-1"
                    : "bg-[var(--surface-card)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--surface-border)] hover:ring-[var(--tlh-blue-primary)]/50 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] text-2xl transition-all ${
                        isSelected
                          ? "bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] text-white shadow-md shadow-blue-500/25 scale-105"
                          : "bg-[var(--primary-light)] text-[var(--tlh-blue-primary)] group-hover:scale-110 group-hover:bg-gradient-to-r group-hover:from-[var(--tlh-blue-primary)] group-hover:to-[var(--tlh-sky)] group-hover:text-white"
                      }`}
                    >
                      {getCategoryIcon(cat.name)}
                    </div>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-3 py-1 text-xs font-bold text-white shadow-sm">
                        <span>✓</span>
                        <span>{t("activeTrack")}</span>
                      </span>
                    )}
                  </div>
                  <h3
                    className={`mt-4 text-xl font-bold transition-colors ${
                      isSelected ? "text-[var(--tlh-navy)]" : "text-[var(--text-main)] group-hover:text-[var(--tlh-blue-primary)]"
                    }`}
                  >
                    {cat.name}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                    {cat.description}
                  </p>
                </div>

                <div
                  className={`mt-6 flex items-center justify-between border-t pt-4 text-xs font-bold transition-colors ${
                    isSelected
                      ? "border-[var(--tlh-blue-primary)]/20 text-[var(--tlh-blue-primary)]"
                      : "border-[var(--surface-border)] text-[var(--text-secondary)] group-hover:text-[var(--tlh-blue-primary)]"
                  }`}
                >
                  <span className="font-semibold text-[var(--text-secondary)]">
                    {isSelected ? t("hidePrograms") : t("clickToViewPrograms")}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-sm font-extrabold transition-transform ${
                      isSelected ? "translate-y-[-2px]" : "group-hover:translate-x-1"
                    }`}
                  >
                    {isSelected ? "↑" : "↓"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Category Programs Drill-Down Display */}
        {selectedCategory && (
          <div
            ref={programsRef}
            className="mt-10 rounded-[var(--radius-2xl)] border border-[var(--tlh-blue-primary)]/20 bg-gradient-to-b from-[var(--surface-muted)] to-white dark:from-[#172033] dark:to-[#111827] p-6 sm:p-10 shadow-[var(--shadow-lg)] transition-all animate-fadeIn"
          >
            {/* Header banner */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--surface-border)] pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--primary-light)] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[var(--tlh-blue-primary)] ring-1 ring-[var(--tlh-blue-primary)]/20">
                    {getCategoryIcon(selectedCategory.name)} {t("activeTrack")}
                  </span>
                  <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs font-bold text-[var(--text-secondary)]">
                    {(categoryProgramsMap[selectedCategory._id] || []).length} {t("courses")}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl sm:text-3xl font-black text-[var(--text-main)]">
                  {t("programsInCategory")}: {selectedCategory.name}
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-2xl">
                  {selectedCategory.description}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to={`/courses?category=${selectedCategory._id}`}
                  className="rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-card)] px-4 py-2.5 text-xs sm:text-sm font-bold text-[var(--text-main)] hover:border-[var(--tlh-blue-primary)] hover:text-[var(--tlh-blue-primary)] transition-colors shadow-sm"
                >
                  {t("allProgramsInCatalog")} →
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] hover:bg-rose-50 hover:text-rose-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-[var(--text-secondary)] transition-colors"
                >
                  ✕ {t("hidePrograms")}
                </button>
              </div>
            </div>

            {/* Programs Content */}
            <div className="mt-8">
              {loadingPrograms && !categoryProgramsMap[selectedCategory._id] ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-3 border-[var(--tlh-blue-primary)] border-t-transparent mb-4"></div>
                  <p className="text-sm font-bold text-[var(--text-secondary)]">{t("loadingPrograms")}</p>
                </div>
              ) : (categoryProgramsMap[selectedCategory._id] || []).length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {(categoryProgramsMap[selectedCategory._id] || []).map((course) => (
                    <div
                      key={course._id}
                      className="flex flex-col justify-between rounded-[var(--radius-xl)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)] ring-1 ring-[var(--surface-border)] hover:shadow-[var(--shadow-md)] hover:ring-[var(--tlh-blue-primary)]/50 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-[var(--primary-light)] dark:bg-cyan-500/15 px-3 py-1 text-xs font-bold text-[var(--tlh-blue-primary)] dark:text-cyan-300 border border-[var(--tlh-blue-primary)]/20 dark:border-cyan-500/30">
                            {course.skillLevel || "All Levels"}
                          </span>
                          <span className="text-xs font-semibold text-[var(--text-secondary)] dark:text-slate-300">
                            {course.modules?.length ? `${course.modules.length} modules` : "Cohort Based"}
                          </span>
                        </div>
                        <h4 className="mt-4 text-xl font-bold text-[var(--text-main)] leading-snug">
                          {course.title}
                        </h4>
                        <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
                          {course.description}
                        </p>

                        {course.learningObjectives?.length > 0 && (
                          <div className="mt-4 space-y-1.5 border-t border-[var(--surface-border)] pt-3">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              {t("objectives")}:
                            </p>
                            {course.learningObjectives.slice(0, 2).map((obj, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                                <span className="text-[var(--tlh-blue-primary)] font-bold">✓</span>
                                <span className="line-clamp-1">{obj}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-6 flex items-center gap-2 border-t border-[var(--surface-border)] pt-4">
                        <Link
                          to={`/courses/${course.slug || course._id}`}
                          className="flex-1 rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-card)] px-3 py-2.5 text-center text-xs font-bold text-[var(--text-main)] hover:bg-[var(--surface-muted)] transition-colors"
                        >
                          {t("viewDetails") || "Details"}
                        </Link>
                        <Link
                          to="/register/student"
                          className="golden-btn flex-1 rounded-full px-3 py-2.5 text-center text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
                          {t("enrollNow")}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--surface-border)] bg-[var(--surface-card)]/70 p-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-amber-50 text-2xl text-[var(--tlh-orange)] mb-3">
                    🚀
                  </div>
                  <h4 className="text-lg font-bold text-[var(--text-main)]">
                    {t("noProgramsFound")}
                  </h4>
                  <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                    We are actively finalizing new curriculums and teacher schedules for this track. Check our other tracks or register to get notified.
                  </p>
                  <div className="mt-6 flex justify-center gap-3">
                    <Link
                      to="/courses"
                      className="rounded-[var(--radius-lg)] bg-[var(--tlh-navy)] px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[var(--tlh-blue-primary)] transition-colors shadow-sm"
                    >
                      {t("allCourses")}
                    </Link>
                    <Link
                      to="/contact"
                      className="rounded-[var(--radius-lg)] border border-[var(--surface-border)] px-5 py-2.5 text-xs sm:text-sm font-bold text-[var(--text-main)] hover:bg-[var(--surface-muted)] transition-colors"
                    >
                      {t("contact")}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 5. How LearnHUB Works: 4-Step Journey */}
      <section className="bg-slate-50/70 border-y border-slate-200/80 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading badge="STEP-BY-STEP JOURNEY" title={t("howItWorks")} subtitle={t("howItWorksSubtitle")} centered/>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200/90 flex flex-col justify-between">
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white font-black text-sm shadow-md shadow-blue-500/20">
                  01
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-900">{t("step1Title")}</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{t("step1Desc")}</p>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200/90 flex flex-col justify-between">
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-600 text-white font-black text-sm shadow-md shadow-cyan-500/20">
                  02
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-900">{t("step2Title")}</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{t("step2Desc")}</p>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200/90 flex flex-col justify-between">
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] text-white font-black text-sm shadow-md shadow-blue-500/20">
                  03
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-900">{t("step3Title")}</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{t("step3Desc")}</p>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200/90 flex flex-col justify-between">
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-md shadow-indigo-500/20">
                  04
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-900">{t("step4Title")}</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{t("step4Desc")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Featured Courses: Digital Marketing & Web Development */}
      {(data?.featuredCourses?.length ?? 0) > 0 ? (<section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading badge="FEATURED SPECIALIZATIONS" title={t("featuredCourses")} subtitle="Explore high-impact industry tracks in Digital Marketing and Modern Web Development led by certified instructors."/>
          
          {/* Integrated Filter Tabs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setFeaturedFilter("all")}
              className={`rounded-full px-5 py-2.5 text-xs font-black transition-all ${
                featuredFilter === "all"
                  ? "bg-[var(--tlh-blue-primary)] text-white shadow-md shadow-blue-500/25"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              }`}
            >
              All Tracks ({data.featuredCourses.length})
            </button>
            <button
              type="button"
              onClick={() => setFeaturedFilter("marketing")}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-black transition-all ${
                featuredFilter === "marketing"
                  ? "bg-[var(--tlh-orange)] text-slate-950 shadow-md shadow-amber-500/25"
                  : "bg-amber-50 text-[var(--tlh-orange)] hover:bg-amber-100 border border-amber-200/50 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-300"
              }`}
            >
              <span>🚀</span> Digital Marketing
            </button>
            <button
              type="button"
              onClick={() => setFeaturedFilter("dev")}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-black transition-all ${
                featuredFilter === "dev"
                  ? "bg-[var(--tlh-navy)] text-white shadow-md shadow-navy-500/25"
                  : "bg-slate-100 text-[var(--tlh-navy)] hover:bg-slate-200 border border-slate-200/50 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              }`}
            >
              <span>💻</span> Web Development
            </button>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.featuredCourses
              .filter((course) => {
                if (featuredFilter === "marketing") {
                  return course.category?.name?.toLowerCase().includes("marketing");
                }
                if (featuredFilter === "dev") {
                  return (
                    course.category?.name?.toLowerCase().includes("development") ||
                    course.category?.name?.toLowerCase().includes("programming")
                  );
                }
                return true;
              })
              .map((course) => {
                const isMarketing = course.category?.name?.toLowerCase().includes("marketing");
                return (
                  <div key={course._id} className="group flex flex-col justify-between rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200/90 hover:shadow-xl hover:ring-[var(--tlh-blue-primary)]/40 transition-all duration-300">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold border ${
                          isMarketing
                            ? "bg-amber-50 text-amber-800 border-amber-200/60 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-300"
                            : "bg-cyan-50 text-cyan-800 border-cyan-200/60 dark:bg-cyan-500/20 dark:border-cyan-500/40 dark:text-cyan-300"
                        }`}>
                          {isMarketing ? "🎯 " : "⚡ "}
                          {course.category?.name ?? "Specialization"}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                          {course.skillLevel}
                        </span>
                      </div>
                      <h3 className="mt-4 text-xl font-bold text-slate-900 dark:text-white leading-snug group-hover:text-[var(--tlh-blue-primary)] transition-colors">{course.title}</h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-200 line-clamp-3 leading-relaxed">{course.description}</p>
                      
                      <div className="mt-5 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{t("objectives")}:</p>
                        {course.learningObjectives?.slice(0, 3).map((obj, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-200 font-medium">
                            <span className={isMarketing ? "text-[var(--tlh-orange)] font-bold" : "text-[var(--tlh-blue-primary)] font-bold"}>✓</span>
                            <span>{obj}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5">
                      <Link to="/register/student" className="golden-btn inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-xs font-bold text-white transition-all shadow-sm hover:shadow-md active:scale-95">
                        {t("enrollNow")} →
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>) : null}

      {/* 7. Dual Value Proposition (Students vs Teachers) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Student Card */}
          <div className="rounded-3xl bg-gradient-to-br from-[var(--tlh-navy)] via-[var(--tlh-navy-deep)] to-slate-950 p-8 sm:p-10 text-white shadow-xl ring-1 ring-white/10 flex flex-col justify-between">
            <div>
              <span className="rounded-full bg-[var(--tlh-cyan)]/20 px-3.5 py-1 text-xs font-bold text-[var(--tlh-cyan)] border border-[var(--tlh-cyan)]/30">
                FOR LEARNERS
              </span>
              <h3 className="mt-4 text-2xl sm:text-3xl font-black text-white">{t("benefitsStudents")}</h3>
              <ul className="mt-6 space-y-4 text-sm text-slate-200">
                <li className="flex items-start gap-3">
                  <span className="rounded-full bg-[var(--tlh-blue-primary)]/40 p-1 text-[var(--tlh-cyan)] font-bold">✓</span>
                  <span>{t("studentBenefit1")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="rounded-full bg-[var(--tlh-blue-primary)]/40 p-1 text-[var(--tlh-cyan)] font-bold">✓</span>
                  <span>{t("studentBenefit2")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="rounded-full bg-[var(--tlh-blue-primary)]/40 p-1 text-[var(--tlh-cyan)] font-bold">✓</span>
                  <span>{t("studentBenefit3")}</span>
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Link to="/register/student" className="inline-block rounded-2xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-cyan)] px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white hover:scale-105 transition-all shadow-lg shadow-blue-500/25">
                {t("studentSignUp")} →
              </Link>
            </div>
          </div>

          {/* Teacher Card */}
          <div className="rounded-3xl bg-gradient-to-br from-[var(--tlh-navy-deep)] via-[var(--tlh-navy)] to-slate-950 p-8 sm:p-10 text-white shadow-xl ring-1 ring-white/10 flex flex-col justify-between">
            <div>
              <span className="rounded-full bg-[var(--tlh-orange)]/20 px-3.5 py-1 text-xs font-bold text-[var(--tlh-orange)] border border-[var(--tlh-orange)]/30">
                FOR EDUCATORS
              </span>
              <h3 className="mt-4 text-2xl sm:text-3xl font-black text-white">{t("benefitsTeachers")}</h3>
              <ul className="mt-6 space-y-4 text-sm text-slate-200">
                <li className="flex items-start gap-3">
                  <span className="rounded-full bg-[var(--tlh-orange)]/30 p-1 text-[var(--tlh-orange)] font-bold">✓</span>
                  <span>{t("teacherBenefit1")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="rounded-full bg-[var(--tlh-orange)]/30 p-1 text-[var(--tlh-orange)] font-bold">✓</span>
                  <span>{t("teacherBenefit2")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="rounded-full bg-[var(--tlh-orange)]/30 p-1 text-[var(--tlh-orange)] font-bold">✓</span>
                  <span>{t("teacherBenefit3")}</span>
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Link to="/apply/teacher" className="golden-btn inline-flex items-center gap-2 rounded-full px-7 py-3 text-xs font-bold text-white transition-all shadow-sm hover:shadow-md active:scale-95">
                {t("teacherApply")} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Standalone Community & Impact Statistics Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50/70 to-slate-100/50 dark:from-[#111827] dark:via-[#172033] dark:to-[#0F172A] p-8 sm:p-12 shadow-sm ring-1 ring-slate-200/60 dark:ring-slate-800">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 dark:bg-sky-500/15 px-3.5 py-1 text-xs font-bold text-blue-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              OUR GROWING COMMUNITY
            </span>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
              Proven Learning Milestones
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
              Real engagement, expert mentorship, and supportive cohort-based environments driving measurable growth.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {/* Active Learners */}
            <div className="group relative overflow-hidden rounded-2xl border border-[var(--tlh-blue-primary)]/20 bg-white p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:border-[var(--tlh-blue-primary)]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)]" />
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-light)] text-2xl shadow-inner border border-[var(--tlh-blue-primary)]/10 text-[var(--tlh-blue-primary)]">
                🎓
              </div>
              <div className="mt-5 font-mono text-4xl font-black tracking-tight text-[var(--tlh-navy)] sm:text-5xl">
                {data?.stats?.activeStudents != null ? `${data.stats.activeStudents}+` : "—"}
              </div>
              <h3 className="mt-2 text-base font-bold text-[var(--tlh-navy)]">
                Active Learners
              </h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                Students actively acquiring modern digital & technical capabilities.
              </p>
            </div>

            {/* Instructors */}
            <div className="group relative overflow-hidden rounded-2xl border border-[var(--tlh-orange)]/20 bg-white p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:border-[var(--tlh-orange)]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--tlh-orange)] to-amber-400" />
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl shadow-inner border border-amber-100 text-[var(--tlh-orange)]">
                👨‍🏫
              </div>
              <div className="mt-5 font-mono text-4xl font-black tracking-tight text-[var(--tlh-navy)] sm:text-5xl">
                {data?.stats?.activeTeachers != null ? `${data.stats.activeTeachers}+` : "—"}
              </div>
              <h3 className="mt-2 text-base font-bold text-[var(--tlh-navy)]">
                Instructors
              </h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                Industry veterans, certified mentors, and passionate subject educators.
              </p>
            </div>

            {/* Cohorts */}
            <div className="group relative overflow-hidden rounded-2xl border border-[var(--tlh-cyan)]/25 bg-white p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:border-[var(--tlh-cyan)]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-cyan)]" />
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-2xl shadow-inner border border-cyan-100 text-[var(--tlh-cyan)]">
                📚
              </div>
              <div className="mt-5 font-mono text-4xl font-black tracking-tight text-[var(--tlh-navy)] sm:text-5xl">
                {data?.stats?.activeClasses != null ? `${data.stats.activeClasses}+` : "—"}
              </div>
              <h3 className="mt-2 text-base font-bold text-[var(--tlh-navy)]">
                Cohorts
              </h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                Interactive live classroom groups learning and practicing together.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Blended Learning & Live Classes Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div className="space-y-6">
            <span className="rounded-full bg-[var(--tlh-cyan)]/10 px-4 py-1.5 text-xs font-black tracking-wider uppercase text-[var(--tlh-cyan)] border border-[var(--tlh-cyan)]/20">
              BLENDED LEARNING EXPERIENCE
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[var(--tlh-navy)] tracking-tight leading-tight">
              Combine Online Flexibility with Live Interaction
            </h2>
            <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
              At TedbabeLearnHUB, we don't just provide videos. We provide a complete educational experience that combines self-paced materials with scheduled live sessions.
            </p>
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--tlh-blue-primary)] text-white shadow-sm">
                  ✓
                </div>
                <div>
                  <h4 className="font-bold text-[var(--tlh-navy)]">Live Scheduled Classes</h4>
                  <p className="text-sm text-slate-500">Regular sessions on Google Meet to discuss complex topics and ask questions.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--tlh-cyan)] text-white shadow-sm">
                  ✓
                </div>
                <div>
                  <h4 className="font-bold text-[var(--tlh-navy)]">Interactive Materials</h4>
                  <p className="text-sm text-slate-500">Access video lessons, PDFs, and assignments in your dedicated cohort workspace.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--tlh-orange)] text-white shadow-sm">
                  ✓
                </div>
                <div>
                  <h4 className="font-bold text-[var(--tlh-navy)]">Expert Feedback</h4>
                  <p className="text-sm text-slate-500">Your work is reviewed by professional instructors who provide detailed feedback.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-tr from-[var(--tlh-blue-primary)]/20 to-[var(--tlh-cyan)]/20 blur-2xl rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
            <img src="/hero-bg.jpg" alt="Blended Learning" className="relative rounded-[40px] shadow-2xl ring-1 ring-slate-200 object-cover w-full h-[400px] lg:h-[500px]" />
            <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-white/90 backdrop-blur-md p-6 shadow-xl border border-white/20">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--tlh-navy)] text-white text-xl">
                  🎓
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--tlh-navy)]">Join 200+ Active Learners</p>
                  <p className="text-xs text-slate-500">Start your professional journey today with TLH.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Expert Teachers Section */}
      <section className="bg-slate-50/50 py-20 border-y border-slate-200/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading 
            badge="EXPERT INSTRUCTORS" 
            title="Learn from Industry Professionals" 
            subtitle="Our instructors are vetted experts who bring real-world experience and academic excellence to your learning journey."
            centered
          />
          
          <div className="grid gap-8 md:grid-cols-3 mt-12">
            {(data?.instructors ?? []).slice(0, 3).map((teacher, idx) => (
              <div key={teacher._id || idx} className="group rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 hover:shadow-xl hover:ring-[var(--tlh-blue-primary)]/30 transition-all text-center">
                <div className="relative mx-auto h-24 w-24 mb-6">
                  <div className="absolute -inset-2 bg-gradient-to-tr from-[var(--tlh-blue-primary)] to-[var(--tlh-cyan)] rounded-full opacity-0 group-hover:opacity-100 blur-md transition-opacity" />
                  <img src={teacher.avatar || "/learnhub-icon.png"} alt={teacher.fullName} className="relative h-full w-full rounded-full object-cover border-4 border-white shadow-md" />
                </div>
                <h3 className="text-xl font-bold text-[var(--tlh-navy)]">{teacher.fullName}</h3>
                <p className="text-xs font-black text-[var(--tlh-blue-primary)] uppercase tracking-wider mt-1">{teacher.expertise || "Senior Instructor"}</p>
                <p className="mt-4 text-sm text-slate-500 leading-relaxed line-clamp-2">
                  {teacher.bio || "Dedicated educator committed to student success and practical skill development."}
                </p>
                <div className="mt-6 flex justify-center gap-2">
                  <span className="rounded-lg bg-slate-50 px-3 py-1 text-[10px] font-bold text-slate-600 border border-slate-200">
                    {teacher.languages?.join(" / ") || "English / Amharic"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link to="/instructors" className="inline-flex items-center gap-2 text-sm font-black text-[var(--tlh-blue-primary)] hover:text-[var(--tlh-navy)] transition-colors">
              Meet all our instructors <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 11. FAQ Section (Homepage Interactive Accordion) */}
      <section id="faq" className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading 
          badge="COMMON QUESTIONS" 
          title="Frequently Asked Questions" 
          subtitle="Everything you need to know about starting your learning journey with TedbabeLearnHUB."
          centered
        />
        
        <div className="mt-10 space-y-4">
          {[
            {
              q: "How does cohort placement work?",
              a: "After registration, our academic team reviews your profile, learning goals, and schedule preferences to place you in the most suitable cohort with an expert instructor."
            },
            {
              q: "Are the classes live or recorded?",
              a: "We use an interactive blended model. You get studio-recorded lessons for self-paced study alongside scheduled live interactive sessions with your verified teacher."
            },
            {
              q: "Will I receive a verifiable certificate?",
              a: "Yes. Upon successful completion of your curriculum and passing teacher-graded assessments, you receive a tamper-proof verified TLH Certificate with a unique verification code and QR identifier."
            },
            {
              q: "What support will I receive during my studies?",
              a: "You have direct access to your instructor during scheduled live sessions, 1-on-1 progress reviews, and collaborative cohort discussion threads inside your Learning Space."
            },
            {
              q: "Can I learn while working full-time?",
              a: "Yes. Cohorts feature flexible morning, evening, and weekend scheduling across Ethiopian Time (EAT) and international time zones to fit your daily life."
            }
          ].map((item, i) => {
            const isOpen = openFaqIndex === i;
            return (
              <div 
                key={i} 
                className="overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between p-6 sm:p-7 text-left transition-colors"
                >
                  <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white pr-4">
                    {item.q}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 font-bold transition-transform duration-200 ${
                      isOpen
                        ? "rotate-180 bg-[var(--tlh-navy)] text-white dark:bg-[#D97706]"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    ▾
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-6 sm:px-8 pb-6 pt-4 text-sm text-slate-600 dark:text-slate-200 leading-relaxed bg-slate-50/50 dark:bg-slate-800/40 animate-fadeIn">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/faq"
            className="golden-btn inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <span>View all frequently asked questions</span>
            <span>→</span>
          </Link>
        </div>
      </section>

      {/* 12. Modern Call-to-Action Banner */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[var(--tlh-navy)] px-8 py-16 sm:px-16 text-center text-white ring-1 ring-white/10 shadow-2xl">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[var(--tlh-blue-primary)]/30 blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[var(--tlh-cyan)]/25 blur-3xl pointer-events-none"></div>

          <div className="relative z-10 max-w-2xl mx-auto">
            <span className="rounded-full bg-[var(--tlh-cyan)]/20 px-3.5 py-1 text-xs font-bold text-[var(--tlh-cyan)] border border-[var(--tlh-cyan)]/30">
              JOIN THE FUTURE OF LEARNING
            </span>
            <h2 className="mt-5 text-3xl font-black sm:text-4xl lg:text-5xl tracking-tight leading-tight">
              {t("ctaTitle")}
            </h2>
            <p className="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed">
              {t("ctaSubtitle")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/register/student" className="golden-btn inline-flex items-center justify-center rounded-full px-8 py-3.5 text-sm font-bold text-white transition-all shadow-sm hover:shadow-md active:scale-95">
                {t("studentSignUp")}
              </Link>
              <Link to="/apply/teacher" className="inline-flex items-center justify-center rounded-full border border-white/20 bg-slate-900/90 px-8 py-3.5 text-sm font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm">
                {t("teacherApply")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>);
}
