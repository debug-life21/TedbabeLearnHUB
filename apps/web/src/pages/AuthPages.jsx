import { useCallback, useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { getDevicePayload } from "../lib/device";
import { BrandLogo } from "../components/BrandLogo";

function AuthShell({ title, subtitle, children }) {
    return (
        <div className="editorial-page auth-page mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-20">
            <div className="rounded-[var(--radius-3xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-xl)] ring-1 ring-[var(--surface-border)]/50 sm:p-12">
                <div className="mb-10 text-center">
                    <Link to="/" className="inline-flex justify-center transition hover:scale-105">
                        <BrandLogo size="md" />
                    </Link>
                    <h1 className="mt-8 text-3xl font-black tracking-tight text-[var(--text-main)] sm:text-4xl">{title}</h1>
                    <p className="mt-3 text-[15px] font-medium text-[var(--text-muted)] leading-relaxed">{subtitle}</p>
                </div>
                {children}
            </div>
        </div>
    );
}

function Feedback({ children }) {
    if (!children) return null;
    const success = children.startsWith("A new code has been sent") || children.toLowerCase().includes("successful");
    return (
        <div 
            role={success ? "status" : "alert"} 
            className={`mb-6 rounded-[var(--radius-2xl)] p-4 text-sm font-semibold ring-1 ${
                success 
                    ? "bg-[var(--tlh-cyan)]/10 text-[var(--tlh-cyan)] ring-[var(--tlh-cyan)]/20" 
                    : "bg-rose-50 text-rose-700 ring-rose-200"
            }`}
        >
            <div className="flex items-center gap-2">
                {success ? "✓" : "⚠️"}
                {children}
            </div>
        </div>
    );
}

function GoogleSignIn({ onCredential, disabled }) {
    const [gsiError, setGsiError] = useState(false);
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    const handleCustomClick = () => {
        if (!googleClientId) {
            setGsiError(true);
            return;
        }
        const gsiBtn = document.querySelector(".gsi-hidden-wrapper div[role='button']");
        if (gsiBtn) {
            gsiBtn.click();
        } else {
            setGsiError(true);
        }
    };

    return (
        <div className="mb-6 w-full">
            <div className={`relative flex w-full justify-center ${disabled ? "pointer-events-none opacity-60" : ""}`}>
                {/* 1. Always-visible luxury branded Google button */}
                <button
                    type="button"
                    onClick={handleCustomClick}
                    disabled={disabled}
                    className="group relative flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-3.5 px-6 text-[13px] font-bold text-slate-800 dark:text-white shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-md active:scale-[0.99] transition-all"
                >
                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Continue with Google</span>
                </button>

                {/* 2. Official Google GSI component transparently layered over it */}
                {googleClientId ? (
                    <div className="gsi-hidden-wrapper absolute inset-0 opacity-0 overflow-hidden flex items-center justify-center pointer-events-auto cursor-pointer">
                        <GoogleLogin
                            onSuccess={(response) => {
                                if (response.credential) onCredential(response.credential);
                            }}
                            onError={() => {
                                setGsiError(true);
                            }}
                            text="continue_with"
                            shape="pill"
                            width="380"
                            useOneTap={false}
                        />
                    </div>
                ) : null}
            </div>
            {gsiError && (
                <p className="mt-2 text-center text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Google sign-in popup was blocked or restricted. Please continue with email registration below.
                </p>
            )}
        </div>
    );
}

function readApplicationFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
            originalFilename: file.name,
            mimeType: file.type,
            base64Data: String(reader.result).split(",")[1],
        });
        reader.onerror = () => reject(new Error(`Could not read ${file.name}. Please try again.`));
        reader.readAsDataURL(file);
    });
}

export function SignInPage() {
    const { t } = useTranslation();
    const { user, login, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState("");

    useEffect(() => {
        if (user && user.emailVerified) {
            navigate("/dashboard", { replace: true });
        }
    }, [user, navigate]);

    const continueWithGoogle = useCallback(async (credential) => {
        if (!credential) {
            setFeedback("Google sign-in could not be completed. Please try again.");
            return;
        }
        setLoading(true);
        setFeedback("");
        try {
            await apiRequest("/api/auth/google", {
                method: "POST",
                body: JSON.stringify({ credential, device: getDevicePayload() }),
            });
            await refreshUser();
            navigate("/dashboard");
        } catch (error) {
            setFeedback(error.message);
        } finally {
            setLoading(false);
        }
    }, [navigate, refreshUser]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setFeedback("");
        try {
            const response = await login({ email, password, device: getDevicePayload() });
            if (response.user && response.user.emailVerified) {
                await refreshUser();
                navigate("/dashboard");
                return;
            }
            sessionStorage.setItem("learnhub_pending_email", response.email || email);
            sessionStorage.setItem("learnhub_pending_purpose", response.purpose || "signup");
            navigate("/verify-code", {
                state: {
                    email: response.email || email,
                    purpose: response.purpose || "signup",
                    devCode: response.devCode || response.fallbackCode,
                    fallbackCode: response.fallbackCode || response.devCode,
                    emailDelivered: response.emailDelivered,
                }
            });
        } catch (error) {
            setFeedback(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell title={t("signIn")} subtitle="Access your TedbabeLearnHUB (TLH) learning and management portal">
            <Feedback>{feedback}</Feedback>
            {feedback && feedback.toLowerCase().includes("admin") && (
                <div className="mb-6">
                    <a
                        href={typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
                            ? "http://localhost:5174"
                            : "https://tedbabelearnhub-admin.vercel.app"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-2xl)] bg-gradient-to-r from-[var(--tlh-navy)] to-[var(--tlh-deep-blue)] py-4 text-xs font-black uppercase tracking-wider text-white shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all hover:-translate-y-0.5"
                    >
                        Go to Admin Dashboard ↗
                    </a>
                </div>
            )}
            <GoogleSignIn onCredential={continueWithGoogle} disabled={loading} />
            <div className="mb-6 flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]/60">
                <span className="h-px flex-1 bg-[var(--surface-border)]" />
                <span>Or email sign in</span>
                <span className="h-px flex-1 bg-[var(--surface-border)]" />
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                        {t("email")}
                    </label>
                    <input 
                        required 
                        autoComplete="email" 
                        type="email" 
                        value={email} 
                        onChange={(event) => setEmail(event.target.value)} 
                        className="w-full rounded-[var(--radius-2xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-semibold text-[var(--text-main)] outline-none transition-all placeholder:text-[var(--text-muted)]/50 focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5" 
                        placeholder="name@example.com" 
                    />
                </div>
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">
                            {t("password")}
                        </label>
                        <Link to="/forgot-password" name="forgot_password_link" className="text-[11px] font-bold text-[var(--tlh-blue-primary)] hover:text-[var(--tlh-blue-hover)] hover:underline">
                            Forgot password?
                        </Link>
                    </div>
                    <input 
                        required 
                        autoComplete="current-password" 
                        type="password" 
                        value={password} 
                        onChange={(event) => setPassword(event.target.value)} 
                        className="w-full rounded-[var(--radius-2xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-semibold text-[var(--text-main)] outline-none transition-all placeholder:text-[var(--text-muted)]/50 focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5" 
                        placeholder="••••••••" 
                    />
                </div>
                <button 
                    disabled={loading} 
                    type="submit" 
                    className="golden-btn w-full rounded-full py-4 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95 disabled:cursor-wait disabled:opacity-50"
                >
                    {loading ? t("loading") : "Sign In to Portal"}
                </button>
            </form>
            <p className="mt-8 border-t border-[var(--surface-border)]/50 pt-8 text-center text-[13px] font-medium text-[var(--text-muted)]">
                New to TedbabeLearnHUB? <Link to="/signup" className="font-black text-[var(--tlh-blue-primary)] hover:text-[var(--tlh-blue-hover)] hover:underline">Create an account</Link>
            </p>
        </AuthShell>
    );
}
const COUNTRIES = [
    { code: "ET", name: "Ethiopia", flag: "🇪🇹", dial: "+251", pattern: /^(?:\+?251[97]\d{8}|0?[97]\d{8})$/, example: "912 345 678", placeholder: "912 345 678" },
    { code: "US", name: "United States", flag: "🇺🇸", dial: "+1", pattern: /^(?:\+?1)?[2-9]\d{9}$/, example: "202 555 1234", placeholder: "202 555 1234" },
    { code: "GB", name: "United Kingdom", flag: "🇬🇧", dial: "+44", pattern: /^(?:\+?44|0)?[1-9]\d{9,10}$/, example: "7911 123456", placeholder: "7911 123456" },
    { code: "KE", name: "Kenya", flag: "🇰🇪", dial: "+254", pattern: /^(?:\+?254|0)?[17]\d{8}$/, example: "712 345 678", placeholder: "712 345 678" },
    { code: "NG", name: "Nigeria", flag: "🇳🇬", dial: "+234", pattern: /^(?:\+?234|0)?[789]\d{9}$/, example: "801 234 5678", placeholder: "801 234 5678" },
    { code: "ZA", name: "South Africa", flag: "🇿🇦", dial: "+27", pattern: /^(?:\+?27|0)?[1-9]\d{8}$/, example: "82 123 4567", placeholder: "82 123 4567" },
    { code: "IN", name: "India", flag: "🇮🇳", dial: "+91", pattern: /^(?:\+?91)?[6-9]\d{9}$/, example: "98765 43210", placeholder: "98765 43210" },
    { code: "AE", name: "UAE", flag: "🇦🇪", dial: "+971", pattern: /^(?:\+?971|0)?[2-9]\d{7,8}$/, example: "50 123 4567", placeholder: "50 123 4567" },
    { code: "DE", name: "Germany", flag: "🇩🇪", dial: "+49", pattern: /^(?:\+?49|0)?[1-9]\d{9,11}$/, example: "151 12345678", placeholder: "151 12345678" },
    { code: "FR", name: "France", flag: "🇫🇷", dial: "+33", pattern: /^(?:\+?33|0)?[1-9]\d{8}$/, example: "6 12 34 56 78", placeholder: "6 12 34 56 78" },
    { code: "CA", name: "Canada", flag: "🇨🇦", dial: "+1", pattern: /^(?:\+?1)?[2-9]\d{9}$/, example: "613 555 1234", placeholder: "613 555 1234" },
    { code: "AU", name: "Australia", flag: "🇦🇺", dial: "+61", pattern: /^(?:\+?61|0)?[2-9]\d{8}$/, example: "412 345 678", placeholder: "412 345 678" },
    { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", dial: "+966", pattern: /^(?:\+?966|0)?[5]\d{8}$/, example: "51 234 5678", placeholder: "51 234 5678" },
    { code: "EG", name: "Egypt", flag: "🇪🇬", dial: "+20", pattern: /^(?:\+?20|0)?[1]\d{9}$/, example: "10 1234 5678", placeholder: "10 1234 5678" },
    { code: "GH", name: "Ghana", flag: "🇬🇭", dial: "+233", pattern: /^(?:\+?233|0)?[2-9]\d{8}$/, example: "24 123 4567", placeholder: "24 123 4567" },
    { code: "TZ", name: "Tanzania", flag: "🇹🇿", dial: "+255", pattern: /^(?:\+?255|0)?[6-7]\d{8}$/, example: "71 234 5678", placeholder: "71 234 5678" },
    { code: "UG", name: "Uganda", flag: "🇺🇬", dial: "+256", pattern: /^(?:\+?256|0)?[3-7]\d{8}$/, example: "71 234 5678", placeholder: "71 234 5678" },
    { code: "RW", name: "Rwanda", flag: "🇷🇼", dial: "+250", pattern: /^(?:\+?250|0)?[7]\d{8}$/, example: "78 123 4567", placeholder: "78 123 4567" },
    { code: "CN", name: "China", flag: "🇨🇳", dial: "+86", pattern: /^(?:\+?86)?[1]\d{10}$/, example: "138 1234 5678", placeholder: "138 1234 5678" },
    { code: "JP", name: "Japan", flag: "🇯🇵", dial: "+81", pattern: /^(?:\+?81|0)?[0-9]\d{8,9}$/, example: "90 1234 5678", placeholder: "90 1234 5678" },
    { code: "BR", name: "Brazil", flag: "🇧🇷", dial: "+55", pattern: /^(?:\+?55|0)?[1-9]\d{9,10}$/, example: "11 91234 5678", placeholder: "11 91234 5678" },
    { code: "IT", name: "Italy", flag: "🇮🇹", dial: "+39", pattern: /^(?:\+?39)?[0-9]\d{8,10}$/, example: "312 345 6789", placeholder: "312 345 6789" },
    { code: "ES", name: "Spain", flag: "🇪🇸", dial: "+34", pattern: /^(?:\+?34)?[6-9]\d{8}$/, example: "612 345 678", placeholder: "612 345 678" },
    { code: "TR", name: "Turkey", flag: "🇹🇷", dial: "+90", pattern: /^(?:\+?90|0)?[5]\d{9}$/, example: "530 123 4567", placeholder: "530 123 4567" },
    { code: "PK", name: "Pakistan", flag: "🇵🇰", dial: "+92", pattern: /^(?:\+?92|0)?[3]\d{9}$/, example: "300 123 4567", placeholder: "300 123 4567" },
    { code: "BD", name: "Bangladesh", flag: "🇧🇩", dial: "+880", pattern: /^(?:\+?880|0)?[1]\d{9}$/, example: "171 234 5678", placeholder: "171 234 5678" },
    { code: "MX", name: "Mexico", flag: "🇲🇽", dial: "+52", pattern: /^(?:\+?52)?[1-9]\d{9}$/, example: "55 1234 5678", placeholder: "55 1234 5678" },
    { code: "OTHER", name: "Other", flag: "🌍", dial: "", pattern: /^\+?\d{7,15}$/, example: "912345678", placeholder: "Phone number" },
];

function validatePhone(phone, countryCode) {
    const entry = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[COUNTRIES.length - 1];
    const cleanPhone = phone.replace(/[\s\-().]/g, "");
    if (!cleanPhone) return "Phone number is required.";
    if (cleanPhone.length < 7) return "Phone number must be at least 7 digits.";
    if (!entry.pattern.test(cleanPhone)) {
        if (countryCode === "ET") {
            return "Enter a valid Ethiopian number starting with 9 or 7 (e.g. 912 345 678).";
        }
        return `Enter a valid ${entry.name} number (e.g. ${entry.example}).`;
    }
    return "";
}

export function SignupPage({ initialRole = "student" }) {
    const { t } = useTranslation();
    const { refreshUser } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState(initialRole);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [country, setCountry] = useState("ET");
    const [phoneError, setPhoneError] = useState("");

    const selectedCountry = COUNTRIES.find((c) => c.code === country) || COUNTRIES[0];

    const [teacherForm, setTeacherForm] = useState({
        qualifications: "",
        experience: "",
        experienceYears: 0,
        teachingCategories: "",
        teachingModes: ["live"],
        teachingLanguages: "English",
        availability: "",
        teachingStatement: "",
        portfolioUrl: "",
        linkedInUrl: "",
        cv: null,
        certificates: [],
    });

    const continueWithGoogle = useCallback(async (credential) => {
        if (!credential) {
            setFeedback("Google sign-up could not be completed. Please try again.");
            return;
        }
        const phoneErr = validatePhone(contactPhone, country);
        if (phoneErr) {
            setFeedback(phoneErr);
            return;
        }
        setLoading(true);
        setFeedback("");
        try {
            await apiRequest("/api/auth/google", {
                method: "POST",
                body: JSON.stringify({
                    credential,
                    role,
                    phone: contactPhone,
                    country,
                    device: getDevicePayload(),
                }),
            });
            await refreshUser();
            await navigate("/dashboard");
        } catch (error) {
            setFeedback(error.message);
        } finally {
            setLoading(false);
        }
    }, [contactPhone, country, navigate, refreshUser, role]);

    const handleTeacherDocuments = async (event) => {
        const files = Array.from(event.target.files || []);
        const fieldName = event.currentTarget.name;
        if (files.some((file) => file.size > 5 * 1024 * 1024)) {
            setFeedback("Each CV or certificate must be smaller than 5MB.");
            event.target.value = "";
            return;
        }
        if (files.reduce((sum, file) => sum + file.size, 0) > 10 * 1024 * 1024) {
            setFeedback("Application documents must total less than 10MB.");
            event.target.value = "";
            return;
        }
        try {
            const documents = await Promise.all(files.map(readApplicationFile));
            setTeacherForm((form) => ({
                ...form,
                ...(fieldName === "cv" ? { cv: documents[0] } : { certificates: documents }),
            }));
            setFeedback("");
        } catch (error) {
            setFeedback(error.message);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (role === "teacher" && !teacherForm.cv) {
            setFeedback("Upload your CV to submit a teacher application.");
            return;
        }
        const phoneErr = validatePhone(contactPhone, country);
        if (phoneErr) {
            setPhoneError(phoneErr);
            setFeedback(phoneErr);
            return;
        }
        setPhoneError("");
        setLoading(true);
        setFeedback("");
        try {
            const response = await apiRequest("/api/auth/signup", {
                method: "POST",
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    role,
                    phone: contactPhone,
                    country,
                    device: getDevicePayload(),
                    ...(role === "teacher" ? {
                        teacherApplication: {
                            qualifications: teacherForm.qualifications,
                            experience: teacherForm.experience,
                            teachingStatement: teacherForm.teachingStatement,
                            experienceYears: Number(teacherForm.experienceYears),
                            teachingCategories: teacherForm.teachingCategories
                                .split(",").map((category) => category.trim()).filter(Boolean),
                            teachingModes: teacherForm.teachingModes.length ? teacherForm.teachingModes : ["live"],
                            teachingLanguages: teacherForm.teachingLanguages
                                .split(",").map((language) => language.trim()).filter(Boolean),
                            availability: teacherForm.availability,
                            portfolioUrl: teacherForm.portfolioUrl,
                            linkedInUrl: teacherForm.linkedInUrl,
                            cv: teacherForm.cv,
                            certificates: teacherForm.certificates,
                        },
                    } : {}),
                }),
            });
            // Always require OTP verification regardless of role before accessing dashboard
            sessionStorage.setItem("learnhub_pending_email", response.email);
            sessionStorage.setItem("learnhub_pending_purpose", response.purpose || "signup");
            navigate("/verify-code", {
                state: {
                    email: response.email,
                    purpose: response.purpose || "signup",
                    devCode: response.devCode || response.fallbackCode,
                    fallbackCode: response.fallbackCode || response.devCode,
                    emailDelivered: response.emailDelivered,
                }
            });
        } catch (error) {
            setFeedback(error.message);
        } finally {
            setLoading(false);
        }
    };

    const fieldClass = "mt-2 w-full rounded-[var(--radius-xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-semibold text-[var(--text-main)] outline-none transition-all placeholder:text-[var(--text-muted)]/50 focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5";
    return (
        <div className="editorial-page auth-page mx-auto w-full px-4 py-12 sm:px-6 sm:py-20">
            <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
                <aside className="relative overflow-hidden rounded-[var(--radius-3xl)] bg-gradient-to-br from-[#071B49] via-[#0B2D70] to-[#071B49] dark:from-[#050E24] dark:via-[#0B1E4A] dark:to-[#050E24] p-8 text-white shadow-[var(--shadow-xl)] sm:p-10 lg:sticky lg:top-24 border border-white/10">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--tlh-sky)]/10 blur-3xl" />
                    <div aria-hidden="true" className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-[var(--tlh-blue-primary)]/10 blur-2xl" />
                    <div className="relative">
                        <Link to="/" className="inline-flex items-center gap-2 transition hover:scale-105">
                            <BrandLogo appearance="dark" size="sm" />
                        </Link>
                        <p className="mt-10 text-[11px] font-black uppercase tracking-[0.25em] text-[var(--tlh-sky)]">{role === "student" ? "Your learning journey" : "Teach with TedbabeLearnHUB"}</p>
                        <h1 className="mt-4 text-3xl font-black leading-[1.15] sm:text-4xl text-white">
                            {role === "student" ? "Build skills for what comes next." : "Help learners move forward."}
                        </h1>
                        <p className="mt-6 max-w-md text-[15px] font-medium leading-relaxed text-white/70">
                            {role === "student"
                                ? "Create your account in a few seconds. After verifying your email, you can complete your learning profile from your dashboard."
                                : "Share your teaching background, expertise, and availability. Our team reviews every application before approval."}
                        </p>
                        <div className="mt-10 space-y-4">
                            {(role === "student"
                                ? [["01", "Create your account"], ["02", "Verify your email"], ["03", "Complete your profile"]]
                                : [["01", "Add your profile"], ["02", "Upload credentials"], ["03", "Verification & Review"]]
                            ).map(([number, text]) => (
                                <div key={number} className="flex items-center gap-4 rounded-[var(--radius-2xl)] border border-white/10 bg-white/5 p-4 backdrop-blur-md transition hover:bg-white/10">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-xl)] bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] text-xs font-black text-white shadow-lg shadow-[var(--tlh-blue-primary)]/20">{number}</span>
                                    <span className="text-[13px] font-bold text-white/90">{text}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-10 rounded-[var(--radius-2xl)] border border-white/10 bg-black/20 p-5 text-[12px] font-medium leading-relaxed text-white/50">
                            Your information is used to set up your TedbabeLearnHUB account and support your learning or teaching application.
                        </div>
                    </div>
                </aside>

                <main className="rounded-[var(--radius-3xl)] border border-[var(--surface-border)]/60 bg-[var(--surface-card)] p-6 shadow-[var(--shadow-xl)] sm:p-10">
                    <div className="mb-10">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--tlh-blue-primary)]">[ Create account ]</p>
                        <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--text-main)] sm:text-4xl">Let’s get started.</h2>
                        <p className="mt-3 text-[15px] font-medium text-[var(--text-muted)]">First choose how you want to use TedbabeLearnHUB, then complete your account details.</p>
                    </div>
                    <Feedback>{feedback}</Feedback>
                    {role === "student" ? <GoogleSignIn onCredential={continueWithGoogle} disabled={loading} /> : (
                        <p className="mb-8 rounded-[var(--radius-2xl)] border border-[var(--tlh-gold)]/20 bg-[var(--tlh-gold)]/5 p-5 text-sm font-semibold leading-relaxed text-[var(--tlh-gold)]">
                            <span className="mr-2">💡</span>
                            Teacher applications require a CV and teaching details, so please register with email.
                        </p>
                    )}
                    {role === "student" && (
                        <div className="mb-8 flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]/60">
                            <span className="h-px flex-1 bg-[var(--surface-border)]" />
                            <span>Or email registration</span>
                            <span className="h-px flex-1 bg-[var(--surface-border)]" />
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <fieldset>
                            <legend className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">I want to join as</legend>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { value: "student", title: "Student", description: "Learn new skills", icon: "🎓" },
                                    { value: "teacher", title: "Teacher", description: "Apply to teach", icon: "👩‍🏫" },
                                ].map((option) => (
                                    <button 
                                        key={option.value} 
                                        type="button" 
                                        onClick={() => setRole(option.value)} 
                                        aria-pressed={role === option.value}
                                        className={`flex items-center gap-4 rounded-[var(--radius-2xl)] border p-5 text-left transition-all ${
                                            role === option.value 
                                                ? "border-[var(--tlh-blue-primary)] bg-[var(--tlh-blue-primary)]/5 ring-4 ring-[var(--tlh-blue-primary)]/10" 
                                                : "border-[var(--surface-border)] bg-[var(--surface-page)] hover:border-[var(--tlh-blue-primary)]/40 hover:bg-white"
                                        }`}
                                    >
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-xl)] bg-white text-2xl shadow-sm border border-[var(--surface-border)]/50">{option.icon}</span>
                                        <span>
                                            <span className={`block text-sm font-black ${role === option.value ? "text-[var(--tlh-blue-primary)]" : "text-[var(--text-main)]"}`}>{option.title}</span>
                                            <span className="mt-1 block text-[11px] font-bold text-[var(--text-muted)]">{option.description}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <section className="space-y-6 rounded-[var(--radius-2xl)] border border-[var(--surface-border)]/60 bg-[var(--surface-page)]/50 p-6 sm:p-8">
                            <div>
                                <h3 className="text-[15px] font-black text-[var(--text-main)]">Account details</h3>
                                <p className="mt-1.5 text-[13px] font-medium text-[var(--text-muted)]">Use an email address you can access to verify your account.</p>
                            </div>
                            <div className="grid gap-6 sm:grid-cols-2">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                        {t("fullName")}
                                    </label>
                                    <input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} placeholder="Your name" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                        {t("email")}
                                    </label>
                                    <input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} placeholder="name@example.com" />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                        {t("password")}
                                    </label>
                                    <input required minLength={8} maxLength={128} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} placeholder="At least 8 characters" />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                        Country <span className="text-rose-500">*</span>
                                    </label>
                                    <select required value={country} onChange={(event) => { setCountry(event.target.value); setPhoneError(""); }} className={fieldClass}>
                                        {COUNTRIES.map((c) => (
                                            <option key={c.code} value={c.code}>{c.flag} {c.name} {c.dial ? `(${c.dial})` : ""}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                        Phone number <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="flex items-stretch rounded-[var(--radius-xl)] border border-[var(--surface-border)] bg-white transition-all focus-within:border-[var(--tlh-blue-primary)] focus-within:ring-4 focus-within:ring-[var(--tlh-blue-primary)]/5">
                                        <span className="flex shrink-0 items-center gap-2 border-r border-[var(--surface-border)] bg-[var(--surface-page)] px-4 text-sm font-bold text-[var(--text-main)] rounded-l-[var(--radius-xl)]">
                                            <span className="text-lg">{selectedCountry.flag}</span> {selectedCountry.dial || "—"}
                                        </span>
                                        <input
                                            required
                                            type="tel"
                                            autoComplete="tel"
                                            minLength={7}
                                            maxLength={16}
                                            value={contactPhone}
                                            onChange={(event) => {
                                                setContactPhone(event.target.value);
                                                if (phoneError) setPhoneError("");
                                            }}
                                            onBlur={() => {
                                                if (contactPhone) setPhoneError(validatePhone(contactPhone, country));
                                            }}
                                            className="w-full rounded-r-[var(--radius-xl)] px-5 py-4 text-sm font-semibold text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]/50"
                                            placeholder={selectedCountry.example || "Phone number"}
                                        />
                                    </div>
                                    {phoneError && <p className="mt-2 text-[12px] font-bold text-rose-600 flex items-center gap-1.5"><span className="text-sm">⚠️</span>{phoneError}</p>}
                                </div>
                            </div>
                        </section>
                        {role === "student" ? (
                            <div className="rounded-[var(--radius-2xl)] border border-[var(--tlh-blue-primary)]/20 bg-gradient-to-br from-[var(--tlh-blue-primary)]/5 to-white p-6">
                                <h2 className="text-[15px] font-black text-[var(--text-main)]">Almost there</h2>
                                <p className="mt-2 text-[13px] font-medium leading-relaxed text-[var(--text-muted)]">
                                    That's all we need to get you started. After you verify your email, you can complete your
                                    learning profile — preferred courses, goals, and study schedule — from your dashboard.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6 rounded-[var(--radius-2xl)] border border-[var(--tlh-gold)]/20 bg-gradient-to-br from-[var(--tlh-gold)]/5 to-white p-6 sm:p-8">
                                <div>
                                    <h2 className="text-[15px] font-black text-[var(--text-main)]">Teaching application</h2>
                                    <p className="mt-1.5 text-[13px] font-medium text-[var(--text-muted)]">Share your experience and supporting documents for administrator review.</p>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                        Qualifications / education
                                    </label>
                                    <textarea required minLength={2} maxLength={1000} value={teacherForm.qualifications} onChange={(event) => setTeacherForm({ ...teacherForm, qualifications: event.target.value })} rows={3} className={fieldClass} placeholder="Degrees, certifications, and relevant training" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                        Teaching experience
                                    </label>
                                    <textarea required minLength={10} maxLength={3000} value={teacherForm.experience} onChange={(event) => setTeacherForm({ ...teacherForm, experience: event.target.value })} rows={4} className={fieldClass} placeholder="Describe your teaching experience and accomplishments" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                        Years of teaching experience
                                    </label>
                                    <input required type="number" min="0" max="60" value={teacherForm.experienceYears} onChange={(event) => setTeacherForm({ ...teacherForm, experienceYears: event.target.value })} className={fieldClass} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                        Subjects you can teach (comma-separated)
                                    </label>
                                    <input required value={teacherForm.teachingCategories} onChange={(event) => setTeacherForm({ ...teacherForm, teachingCategories: event.target.value })} className={fieldClass} placeholder="Mathematics, English, Web Development" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
                                        Teaching modes (select at least one)
                                    </label>
                                    <div className="flex flex-wrap gap-3">
                                        {[
                                            { value: "live", label: "Live cohort classes" },
                                            { value: "self_paced", label: "Self-paced" },
                                            { value: "hybrid", label: "Hybrid" },
                                        ].map((mode) => {
                                            const active = teacherForm.teachingModes.includes(mode.value);
                                            return (
                                                <button 
                                                    key={mode.value} 
                                                    type="button" 
                                                    aria-pressed={active} 
                                                    onClick={() => setTeacherForm((form) => ({
                                                        ...form,
                                                        teachingModes: active
                                                            ? form.teachingModes.filter((item) => item !== mode.value)
                                                            : [...form.teachingModes, mode.value],
                                                    }))} 
                                                    className={`rounded-[var(--radius-xl)] border px-4 py-2 text-[13px] font-black transition-all ${
                                                        active 
                                                            ? "border-[var(--tlh-blue-primary)] bg-[var(--tlh-blue-primary)] text-[var(--tlh-blue-primary)] bg-white ring-4 ring-[var(--tlh-blue-primary)]/10" 
                                                            : "border-[var(--surface-border)] bg-white text-[var(--text-muted)] hover:border-[var(--tlh-blue-primary)]/40 hover:text-[var(--text-main)]"
                                                    }`}
                                                >
                                                    {mode.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                        Teaching languages (comma-separated)
                                    </label>
                                    <input required value={teacherForm.teachingLanguages} onChange={(event) => setTeacherForm({ ...teacherForm, teachingLanguages: event.target.value })} className={fieldClass} placeholder="English, Amharic" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                        Teaching availability
                                    </label>
                                    <textarea required minLength={2} maxLength={500} value={teacherForm.availability} onChange={(event) => setTeacherForm({ ...teacherForm, availability: event.target.value })} rows={3} className={fieldClass} placeholder="Days, times, and time zone" />
                                </div>
                                <div className="grid gap-6 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                            Portfolio / website (optional)
                                        </label>
                                        <input type="url" value={teacherForm.portfolioUrl} onChange={(event) => setTeacherForm({ ...teacherForm, portfolioUrl: event.target.value })} className={fieldClass} placeholder="https://your-site.com" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                            LinkedIn profile (optional)
                                        </label>
                                        <input type="url" value={teacherForm.linkedInUrl} onChange={(event) => setTeacherForm({ ...teacherForm, linkedInUrl: event.target.value })} className={fieldClass} placeholder="https://linkedin.com/in/you" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                                        Why do you want to teach with TedbabeLearnHUB?
                                    </label>
                                    <textarea required minLength={20} maxLength={1000} value={teacherForm.teachingStatement} onChange={(event) => setTeacherForm({ ...teacherForm, teachingStatement: event.target.value })} rows={4} className={fieldClass} placeholder="Describe how you support learners and what you would bring to TedbabeLearnHUB." />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
                                        CV / Resume (required, max 5MB)
                                    </label>
                                    <div className="relative">
                                        <input required type="file" name="cv" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={handleTeacherDocuments} className="peer absolute inset-0 z-10 w-full opacity-0 cursor-pointer" />
                                        <div className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--surface-border)] bg-[var(--surface-page)] p-8 transition-all peer-hover:border-[var(--tlh-blue-primary)] peer-hover:bg-[var(--tlh-blue-primary)]/5">
                                            <span className="text-3xl mb-3">📄</span>
                                            <span className="text-sm font-bold text-[var(--text-main)]">Click to upload or drag & drop</span>
                                            <span className="mt-1 text-xs font-medium text-[var(--text-muted)]">PDF, Word, or images up to 5MB</span>
                                        </div>
                                    </div>
                                    {teacherForm.cv ? <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--tlh-blue-primary)]/5 px-3 py-2 text-xs font-bold text-[var(--tlh-blue-primary)]"><span className="text-sm">✓</span> {teacherForm.cv.originalFilename}</div> : null}
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
                                        Certificates / credentials (optional)
                                    </label>
                                    <div className="relative">
                                        <input type="file" name="certificates" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={handleTeacherDocuments} className="peer absolute inset-0 z-10 w-full opacity-0 cursor-pointer" />
                                        <div className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--surface-border)] bg-[var(--surface-page)] p-8 transition-all peer-hover:border-[var(--tlh-blue-primary)] peer-hover:bg-[var(--tlh-blue-primary)]/5">
                                            <span className="text-3xl mb-3">🎓</span>
                                            <span className="text-sm font-bold text-[var(--text-main)]">Upload credentials</span>
                                            <span className="mt-1 text-xs font-medium text-[var(--text-muted)]">Up to 5 additional files</span>
                                        </div>
                                    </div>
                                    {teacherForm.certificates.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {teacherForm.certificates.map((cert) => (
                                                <div key={cert.originalFilename} className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-page)] px-3 py-2 text-xs font-bold text-[var(--text-muted)]">
                                                    <span className="text-sm">📎</span> {cert.originalFilename}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <p className="rounded-[var(--radius-xl)] border border-[var(--tlh-gold)]/20 bg-[var(--tlh-gold)]/5 p-4 text-[12px] font-bold leading-relaxed text-[var(--tlh-gold)]">
                                    <span className="mr-1.5">🕒</span> After you verify your email, an administrator will review your application before teacher access is enabled.
                                </p>
                            </div>
                        )}
                        <button 
                            disabled={loading} 
                            type="submit" 
                            className="golden-btn w-full rounded-full py-4.5 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95 disabled:cursor-wait disabled:opacity-50"
                        >
                            {loading ? t("loading") : role === "teacher" ? "Submit Teacher Application" : "Create My Student Account"}
                        </button>
                    </form>
                    <p className="mt-10 border-t border-[var(--surface-border)]/50 pt-10 text-center text-[13px] font-medium text-[var(--text-muted)]">
                        Already have an account? <Link to="/sign-in" className="font-black text-[var(--tlh-blue-primary)] hover:text-[var(--tlh-blue-hover)] hover:underline">Sign in</Link>
                    </p>
                    <p className="mt-5 text-center text-[11px] font-bold text-[var(--text-muted)] leading-relaxed">
                        By continuing, you agree to TedbabeLearnHUB&apos;s 
                        <Link to="/terms" className="text-[var(--text-main)] hover:underline mx-1">Terms</Link> and 
                        <Link to="/privacy" className="text-[var(--text-main)] hover:underline mx-1">Privacy Policy</Link>.
                    </p>
                </main>
            </div>
        </div>
    );
}

export function VerifyCodePage() {
    const { t } = useTranslation();
    const { user, refreshUser } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [email, setEmail] = useState((location.state?.email || sessionStorage.getItem("learnhub_pending_email") || "").trim());
    const [purpose] = useState(location.state?.purpose || sessionStorage.getItem("learnhub_pending_purpose") || "signup");
    const [code, setCode] = useState(location.state?.devCode || location.state?.fallbackCode || "");
    const [fallbackCode, setFallbackCode] = useState(location.state?.fallbackCode || location.state?.devCode || "");
    const [emailDelivered, setEmailDelivered] = useState(location.state?.emailDelivered !== false);
    const [rememberDevice, setRememberDevice] = useState(true);
    const [secondsLeft, setSecondsLeft] = useState(60);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState("");
    const isNewDeviceLogin = purpose === "login";

    useEffect(() => {
        if (user && user.emailVerified) {
            navigate("/dashboard", { replace: true });
        }
    }, [user, navigate]);

    useEffect(() => {
        if (secondsLeft <= 0) return undefined;
        const timer = window.setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [secondsLeft]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setFeedback("");
        try {
            await apiRequest("/api/auth/verify-code", {
                method: "POST",
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    code: code.trim(),
                    rememberDevice: isNewDeviceLogin ? rememberDevice : true,
                    device: getDevicePayload(),
                }),
            });
            sessionStorage.removeItem("learnhub_pending_email");
            sessionStorage.removeItem("learnhub_pending_purpose");
            await refreshUser();
            navigate("/dashboard");
        } catch (error) {
            setFeedback(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setLoading(true);
        setFeedback("");
        try {
            const res = await apiRequest("/api/auth/resend-code", {
                method: "POST",
                body: JSON.stringify({ email: email.trim().toLowerCase(), purpose }),
            });
            setSecondsLeft(60);
            if (res?.devCode || res?.fallbackCode) {
                setCode(res.devCode || res.fallbackCode);
                setFallbackCode(res.devCode || res.fallbackCode);
            }
            if (res?.emailDelivered === false) {
                setEmailDelivered(false);
                setFeedback("Notice: Cloud host firewall blocked SMTP email transmission. Your code is displayed in the alert box above.");
            } else {
                setEmailDelivered(true);
                setFeedback("A new verification code has been dispatched. Please check your inbox and Spam / Junk folder.");
            }
        } catch (error) {
            setFeedback(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell
            title={isNewDeviceLogin ? "Confirm this device" : "Verify your email"}
            subtitle={isNewDeviceLogin
                ? "We noticed a new sign-in. Enter the 6-digit code sent to your inbox to confirm it's you."
                : "Enter the 6-digit code sent to your inbox"}
        >
            <Feedback>{feedback}</Feedback>
            {!emailDelivered && fallbackCode ? (
                <div className="mb-6 rounded-[var(--radius-2xl)] border border-[var(--tlh-gold)]/30 bg-[var(--tlh-gold)]/5 p-5 text-sm leading-relaxed shadow-sm">
                    <div className="flex items-center gap-2 font-black text-[var(--tlh-gold)] mb-2">
                        <span className="text-lg">⚠️</span> Cloud Network Notice
                    </div>
                    <p className="text-[var(--text-main)] font-medium">
                        Outbound SMTP ports were blocked by the server firewall. Your 6-digit verification code is:
                        <span className="block mt-3 font-mono text-2xl font-black text-[var(--tlh-gold)] tracking-[0.25em] bg-white py-3 px-4 rounded-[var(--radius-xl)] border border-[var(--tlh-gold)]/20 text-center select-all shadow-inner">
                            {fallbackCode}
                        </span>
                    </p>
                </div>
            ) : (
                <div className="mb-6 rounded-[var(--radius-xl)] border border-[var(--tlh-blue-primary)]/10 bg-[var(--tlh-blue-primary)]/5 p-4 text-[13px] text-[var(--text-main)] font-medium leading-relaxed">
                    <span className="mr-1.5">📧</span>
                    Verification code sent to <strong className="font-black text-[var(--tlh-blue-primary)]">{email || "your email"}</strong>. If you don't see it, check your <span className="font-black underline decoration-[var(--tlh-blue-primary)]/30">Spam / Junk</span> folder.
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
                        {t("email")}
                    </label>
                    <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-[var(--radius-2xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-semibold text-[var(--text-main)] outline-none transition-all focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5" />
                </div>
                <div>
                    <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
                        Verification code
                    </label>
                    <input 
                        required 
                        minLength={6} 
                        maxLength={6} 
                        pattern="[0-9]{6}" 
                        inputMode="numeric" 
                        autoComplete="one-time-code" 
                        value={code} 
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} 
                        className="w-full rounded-[var(--radius-2xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-5 text-center font-mono text-3xl font-black tracking-[0.5em] text-[var(--text-main)] outline-none transition-all focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5" 
                        placeholder="000000" 
                        aria-label="6-digit verification code" 
                    />
                </div>
                {isNewDeviceLogin && (
                    <label className="flex items-start gap-3 rounded-[var(--radius-2xl)] border border-[var(--surface-border)] bg-[var(--surface-page)]/50 p-4 text-[13px] font-bold text-[var(--text-muted)] cursor-pointer hover:bg-white transition-all">
                        <input
                            type="checkbox"
                            checked={rememberDevice}
                            onChange={(event) => setRememberDevice(event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--tlh-blue-primary)] focus:ring-[var(--tlh-blue-primary)]/30 cursor-pointer"
                        />
                        <span>Remember this device for 30 days and skip this code next time.</span>
                    </label>
                )}
                <button 
                    disabled={loading || code.length !== 6} 
                    type="submit" 
                    className="golden-btn w-full rounded-full py-4 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95 disabled:cursor-wait disabled:opacity-50"
                >
                    {loading ? t("loading") : isNewDeviceLogin ? "Confirm and sign in" : "Verify and continue"}
                </button>
            </form>
            <div className="mt-8 flex flex-col items-center gap-4">
                <button 
                    type="button" 
                    disabled={loading || secondsLeft > 0 || !email} 
                    onClick={handleResend} 
                    className="text-[13px] font-black text-[var(--tlh-blue-primary)] hover:text-[var(--tlh-blue-hover)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--text-muted)]/50 disabled:no-underline"
                >
                    {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
                </button>
                <Link to="/sign-in" className="text-[13px] font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">Back to sign in</Link>
            </div>
        </AuthShell>
    );
}

export function ForgotPasswordPage() {
    const { t } = useTranslation();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setFeedback("");
        try {
            const res = await apiRequest("/api/auth/forgot-password", {
                method: "POST",
                body: JSON.stringify({ email }),
            });
            setSubmitted(true);
            setFeedback(res.message || "A reset link and code have been sent if an account matches.");
        } catch (error) {
            setFeedback(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell title="Reset password" subtitle="Enter your email to receive recovery instructions">
            <Feedback>{feedback}</Feedback>
            {submitted ? (
                <div className="space-y-6 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-2xl)] bg-gradient-to-br from-[var(--tlh-blue-primary)]/10 to-transparent text-2xl text-[var(--tlh-blue-primary)] ring-1 ring-[var(--tlh-blue-primary)]/20 shadow-inner">
                        ✓
                    </div>
                    <p className="text-[15px] font-medium text-[var(--text-muted)] leading-relaxed">
                        Check your email inbox for the reset link and 6-digit code.
                    </p>
                    <div className="flex flex-col gap-3 pt-4">
                        <Link
                            to={`/reset-password?email=${encodeURIComponent(email)}`}
                            className="golden-btn w-full text-center rounded-full py-3.5 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
                            Enter Reset Code
                        </Link>
                        <Link to="/sign-in" className="text-[13px] font-bold text-[var(--text-muted)] hover:text-[var(--text-main)]">
                            Back to sign in
                        </Link>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
                            {t("email")}
                        </label>
                        <input
                            required
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-[var(--radius-2xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-semibold text-[var(--text-main)] outline-none transition-all placeholder:text-[var(--text-muted)]/50 focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5"
                            placeholder="name@example.com"
                        />
                    </div>
                    <button
                        disabled={loading || !email}
                        type="submit"
                        className="golden-btn w-full rounded-full py-4 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95 disabled:cursor-wait disabled:opacity-50"
                    >
                        {loading ? t("loading") : "Send Reset Instructions"}
                    </button>
                    <div className="pt-4 text-center">
                        <Link to="/sign-in" className="text-[13px] font-bold text-[var(--text-muted)] hover:text-[var(--tlh-blue-primary)] transition-colors">
                            ← Return to sign in
                        </Link>
                    </div>
                </form>
            )}
        </AuthShell>
    );
}

export function ResetPasswordPage() {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const initialEmail = searchParams.get("email") || "";
    const initialToken = searchParams.get("token") || "";

    const [email, setEmail] = useState(initialEmail);
    const [tokenOrCode, setTokenOrCode] = useState(initialToken);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (newPassword !== confirmPassword) {
            setFeedback("Passwords do not match.");
            return;
        }
        setLoading(true);
        setFeedback("");
        try {
            const res = await apiRequest("/api/auth/reset-password", {
                method: "POST",
                body: JSON.stringify({ email, tokenOrCode, newPassword }),
            });
            setSuccess(true);
            setFeedback(res.message || "Password reset successful.");
            setTimeout(() => {
                navigate("/sign-in");
            }, 2500);
        } catch (error) {
            setFeedback(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell title="Set new password" subtitle="Choose a strong password for your TedbabeLearnHUB account">
            <Feedback>{feedback}</Feedback>
            {success ? (
                <div className="space-y-6 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-2xl)] bg-gradient-to-br from-[var(--tlh-blue-primary)]/10 to-transparent text-2xl text-[var(--tlh-blue-primary)] ring-1 ring-[var(--tlh-blue-primary)]/20 shadow-inner">
                        ✓
                    </div>
                    <h2 className="text-xl font-black text-[var(--text-main)]">Password Changed!</h2>
                    <p className="text-[13px] font-medium text-[var(--text-muted)]">Redirecting to sign-in page…</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
                            {t("email")}
                        </label>
                        <input
                            required
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-[var(--radius-2xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-semibold text-[var(--text-main)] outline-none transition-all focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
                            Reset Code or Token
                        </label>
                        <input
                            required
                            type="text"
                            value={tokenOrCode}
                            onChange={(e) => setTokenOrCode(e.target.value)}
                            className="w-full rounded-[var(--radius-2xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-mono font-bold tracking-wider text-[var(--text-main)] outline-none transition-all focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5"
                            placeholder="6-digit code or link token"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
                            New Password
                        </label>
                        <input
                            required
                            minLength={8}
                            maxLength={128}
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full rounded-[var(--radius-2xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-semibold text-[var(--text-main)] outline-none transition-all placeholder:text-[var(--text-muted)]/50 focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5"
                            placeholder="At least 8 characters"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
                            Confirm New Password
                        </label>
                        <input
                            required
                            minLength={8}
                            maxLength={128}
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full rounded-[var(--radius-2xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-semibold text-[var(--text-main)] outline-none transition-all placeholder:text-[var(--text-muted)]/50 focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5"
                            placeholder="Re-enter password"
                        />
                    </div>
                    <button
                        disabled={loading || !newPassword || !confirmPassword || !tokenOrCode}
                        type="submit"
                        className="golden-btn w-full rounded-full py-4 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95 disabled:cursor-wait disabled:opacity-50"
                    >
                        {loading ? t("loading") : "Update Password"}
                    </button>
                    <div className="pt-4 text-center">
                        <Link to="/sign-in" className="text-[13px] font-bold text-[var(--text-muted)] hover:text-[var(--tlh-blue-primary)] transition-colors">
                            ← Return to sign in
                        </Link>
                    </div>
                </form>
            )}
        </AuthShell>
    );
}
