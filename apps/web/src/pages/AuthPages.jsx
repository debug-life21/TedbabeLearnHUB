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
        <div className="editorial-page auth-page mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
            <div className="rounded-3xl bg-white p-7 shadow-xl ring-1 ring-slate-200/90 sm:p-10">
                <div className="mb-7 text-center">
                    <Link to="/" className="inline-flex justify-center transition hover:opacity-90">
                        <BrandLogo size="md" />
                    </Link>
                    <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
                    <p className="mt-1.5 text-sm font-medium text-slate-500">{subtitle}</p>
                </div>
                {children}
            </div>
        </div>
    );
}

function Feedback({ children }) {
    if (!children) return null;
    const success = children.startsWith("A new code has been sent") || children.toLowerCase().includes("successful");
    return <div role={success ? "status" : "alert"} className={`mb-5 rounded-2xl p-3.5 text-sm font-semibold ring-1 ${success ? "bg-sky-50 text-sky-800 ring-sky-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>{children}</div>;
}

function GoogleSignIn({ onCredential, disabled }) {
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        return <p className="mb-5 text-center text-xs text-slate-500">Google sign-in is not configured.</p>;
    }
    return (
        <div className={`mb-5 flex justify-center ${disabled ? "pointer-events-none opacity-60" : ""}`}>
            <GoogleLogin
                onSuccess={(response) => {
                    if (response.credential) onCredential(response.credential);
                }}
                onError={() => onCredential(null)}
                text="continue_with"
                shape="pill"
                width="360"
                useOneTap={false}
            />
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
                <div className="mb-5">
                    <a
                        href={typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
                            ? "http://localhost:5174"
                            : "https://tedbabelearnhub-admin.vercel.app"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0c234b] to-[#061124] py-3 text-xs font-bold text-white shadow-sm hover:from-[#091b3b] hover:to-[#040b17] transition"
                    >
                        Go to Admin Dashboard ↗
                    </a>
                </div>
            )}
            <GoogleSignIn onCredential={continueWithGoogle} disabled={loading} />
            <div className="mb-5 flex items-center gap-3 text-xs font-semibold text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />OR CONTINUE WITH EMAIL<span className="h-px flex-1 bg-slate-200" />
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">
                    {t("email")}
                    <input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium normal-case outline-none transition focus:border-[#0066ff] focus:ring-4 focus:ring-blue-500/10" placeholder="name@example.com" />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    <div className="flex items-center justify-between">
                        <span>{t("password")}</span>
                        <Link to="/forgot-password" className="text-[11px] font-semibold text-[#0066ff] hover:text-[#0052cc] hover:underline lowercase first-letter:uppercase">
                            Forgot password?
                        </Link>
                    </div>
                    <input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium normal-case outline-none transition focus:border-[#0066ff] focus:ring-4 focus:ring-blue-500/10" placeholder="Your password" />
                </label>
                <button disabled={loading} type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:from-[#0052cc] hover:to-[#0088e6] disabled:cursor-wait disabled:opacity-50">
                    {loading ? t("loading") : "Continue"}
                </button>
            </form>
            <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
                New to TedbabeLearnHUB? <Link to="/signup" className="font-bold text-[#0066ff] hover:text-[#0052cc] hover:underline">Create an account</Link>
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

    const fieldClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium normal-case outline-none transition focus:border-[#0066ff] focus:ring-4 focus:ring-blue-500/10";
    return (
        <div className="editorial-page auth-page mx-auto w-full px-4 py-8 sm:px-6 sm:py-12">
            <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
                <aside className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c234b] via-[#091b3b] to-[#061124] p-7 text-white shadow-xl sm:p-9 lg:sticky lg:top-24 border border-sky-500/20">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
                    <div aria-hidden="true" className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-blue-600/10 blur-2xl" />
                    <div className="relative">
                        <Link to="/" className="inline-flex items-center gap-2">
                            <BrandLogo appearance="dark" size="sm" />
                        </Link>
                        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">{role === "student" ? "Your learning journey" : "Teach with TedbabeLearnHUB"}</p>
                        <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl text-white">
                            {role === "student" ? "Build skills for what comes next." : "Help learners move forward."}
                        </h1>
                        <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
                            {role === "student"
                                ? "Create your account in a few seconds. After verifying your email, you can complete your learning profile from your dashboard so we can match you with the right cohort."
                                : "Share your teaching background, expertise, and availability. Our team reviews every application before approval."}
                        </p>
                        <div className="mt-8 space-y-3">
                            {(role === "student"
                                ? [["01", "Create your account"], ["02", "Verify your email"], ["03", "Complete your learning profile"]]
                                : [["01", "Add your teaching profile"], ["02", "Upload your CV and credentials"], ["03", "Verify email; admin reviews your application"]]
                            ).map(([number, text]) => (
                                <div key={number} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] text-xs font-black text-white shadow-sm shadow-blue-500/25">{number}</span>
                                    <span className="text-xs font-semibold text-white/90">{text}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-slate-300">
                            Your information is used to set up your TedbabeLearnHUB account and support your learning or teaching application.
                        </div>
                    </div>
                </aside>

                <main className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_24px_70px_rgba(0,102,255,0.06)] sm:p-8">
                    <div className="mb-7">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0066ff]">[ Create account ]</p>
                        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Let’s get started.</h2>
                        <p className="mt-2 text-sm text-slate-500">First choose how you want to use TedbabeLearnHUB, then complete your account details.</p>
                    </div>
                    <Feedback>{feedback}</Feedback>
                    {role === "student" ? <GoogleSignIn onCredential={continueWithGoogle} disabled={loading} /> : (
                        <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-5 text-amber-950">
                            Teacher applications require a CV and teaching details, so please register with email.
                        </p>
                    )}
                    {role === "student" && (
                        <div className="mb-5 flex items-center gap-3 text-xs font-semibold text-slate-400">
                            <span className="h-px flex-1 bg-slate-200" />OR CONTINUE WITH EMAIL<span className="h-px flex-1 bg-slate-200" />
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <fieldset>
                            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">I want to join as</legend>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: "student", title: "Student", description: "Learn new skills", icon: "🎓" },
                                    { value: "teacher", title: "Teacher", description: "Apply to teach", icon: "👩‍🏫" },
                                ].map((option) => (
                                    <button key={option.value} type="button" onClick={() => setRole(option.value)} aria-pressed={role === option.value}
                                        className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${role === option.value ? "border-[#0066ff] bg-sky-50/80 ring-2 ring-blue-500/15" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                            }`}>
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm">{option.icon}</span>
                                        <span>
                                            <span className="block text-sm font-bold text-slate-900">{option.title}</span>
                                            <span className="mt-0.5 block text-[11px] text-slate-500">{option.description}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-900">Account details</h3>
                                <p className="mt-1 text-xs text-slate-500">Use an email address you can access to verify your account.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block text-xs font-bold text-slate-700">
                                    {t("fullName")}
                                    <input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} placeholder="Your name" />
                                </label>
                                <label className="block text-xs font-bold text-slate-700">
                                    {t("email")}
                                    <input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} placeholder="name@example.com" />
                                </label>
                                <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                                    {t("password")}
                                    <input required minLength={8} maxLength={128} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} placeholder="At least 8 characters" />
                                </label>
                                <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                                    Country <span className="text-rose-500">*</span>
                                    <select required value={country} onChange={(event) => { setCountry(event.target.value); setPhoneError(""); }} className={fieldClass}>
                                        {COUNTRIES.map((c) => (
                                            <option key={c.code} value={c.code}>{c.flag} {c.name} {c.dial ? `(${c.dial})` : ""}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                                    Phone number <span className="text-rose-500">*</span>
                                    <div className="mt-1.5 flex items-stretch rounded-xl border border-slate-200 bg-white transition focus-within:border-[#0066ff] focus-within:ring-4 focus-within:ring-blue-500/10">
                                        <span className="flex shrink-0 items-center gap-1.5 border-r border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600 rounded-l-xl">
                                            <span className="text-base">{selectedCountry.flag}</span> {selectedCountry.dial || "—"}
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
                                            className="w-full rounded-r-xl px-4 py-3 text-sm font-medium outline-none"
                                            placeholder={selectedCountry.example || "Phone number"}
                                        />
                                    </div>
                                    {phoneError && <p className="mt-1.5 text-xs font-semibold text-rose-600">{phoneError}</p>}
                                </label>
                            </div>
                        </section>
                        {role === "student" ? (
                            <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50/80 to-white p-4 sm:p-5">
                                <h2 className="text-sm font-black text-slate-900">Almost there</h2>
                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                    That's all we need to get you started. After you verify your email, you can complete your
                                    learning profile — preferred courses, goals, and study schedule — from your dashboard.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/80 to-white p-4 sm:p-5">
                                <div>
                                    <h2 className="text-sm font-black text-slate-900">Teaching application</h2>
                                    <p className="mt-1 text-xs text-slate-500">Share your experience and supporting documents for administrator review.</p>
                                </div>
                                <label className="block text-xs font-bold text-slate-700">
                                    Qualifications / education
                                    <textarea required minLength={2} maxLength={1000} value={teacherForm.qualifications} onChange={(event) => setTeacherForm({ ...teacherForm, qualifications: event.target.value })} rows={2} className={fieldClass} placeholder="Degrees, certifications, and relevant training" />
                                </label>
                                <label className="block text-xs font-bold text-slate-700">
                                    Teaching experience
                                    <textarea required minLength={10} maxLength={3000} value={teacherForm.experience} onChange={(event) => setTeacherForm({ ...teacherForm, experience: event.target.value })} rows={4} className={fieldClass} placeholder="Describe your teaching experience and accomplishments" />
                                </label>
                                <label className="block text-xs font-bold text-slate-700">
                                    Years of teaching experience
                                    <input required type="number" min="0" max="60" value={teacherForm.experienceYears} onChange={(event) => setTeacherForm({ ...teacherForm, experienceYears: event.target.value })} className={fieldClass} />
                                </label>
                                <label className="block text-xs font-bold text-slate-700">
                                    Subjects you can teach (comma-separated)
                                    <input required value={teacherForm.teachingCategories} onChange={(event) => setTeacherForm({ ...teacherForm, teachingCategories: event.target.value })} className={fieldClass} placeholder="Mathematics, English, Web Development" />
                                </label>
                                <div className="block text-xs font-bold text-slate-700">
                                    Teaching modes (select at least one)
                                    <div className="mt-1.5 flex flex-wrap gap-2">
                                        {[
                                            { value: "live", label: "Live cohort classes" },
                                            { value: "self_paced", label: "Self-paced" },
                                            { value: "hybrid", label: "Hybrid" },
                                        ].map((mode) => {
                                            const active = teacherForm.teachingModes.includes(mode.value);
                                            return (
                                                <button key={mode.value} type="button" aria-pressed={active} onClick={() => setTeacherForm((form) => ({
                                                    ...form,
                                                    teachingModes: active
                                                        ? form.teachingModes.filter((item) => item !== mode.value)
                                                        : [...form.teachingModes, mode.value],
                                                }))} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-[#0066ff] bg-sky-50 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                                                    {mode.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <label className="block text-xs font-bold text-slate-700">
                                    Teaching languages (comma-separated)
                                    <input required value={teacherForm.teachingLanguages} onChange={(event) => setTeacherForm({ ...teacherForm, teachingLanguages: event.target.value })} className={fieldClass} placeholder="English, Amharic" />
                                </label>
                                <label className="block text-xs font-bold text-slate-700">
                                    Teaching availability
                                    <textarea required minLength={2} maxLength={500} value={teacherForm.availability} onChange={(event) => setTeacherForm({ ...teacherForm, availability: event.target.value })} rows={2} className={fieldClass} placeholder="Days, times, and time zone" />
                                </label>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Portfolio / website (optional)
                                        <input type="url" value={teacherForm.portfolioUrl} onChange={(event) => setTeacherForm({ ...teacherForm, portfolioUrl: event.target.value })} className={fieldClass} placeholder="https://your-site.com" />
                                    </label>
                                    <label className="block text-xs font-bold text-slate-700">
                                        LinkedIn profile (optional)
                                        <input type="url" value={teacherForm.linkedInUrl} onChange={(event) => setTeacherForm({ ...teacherForm, linkedInUrl: event.target.value })} className={fieldClass} placeholder="https://linkedin.com/in/you" />
                                    </label>
                                </div>
                                <label className="block text-xs font-bold text-slate-700">
                                    Why do you want to teach with TedbabeLearnHUB?
                                    <textarea required minLength={20} maxLength={1000} value={teacherForm.teachingStatement} onChange={(event) => setTeacherForm({ ...teacherForm, teachingStatement: event.target.value })} rows={3} className={fieldClass} placeholder="Describe how you support learners and what you would bring to TedbabeLearnHUB." />
                                </label>
                                <label className="block text-xs font-bold text-slate-700">
                                    CV / Resume (required, PDF, Word, or image; max 5MB)
                                    <input required type="file" name="cv" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={handleTeacherDocuments} className="mt-2 block w-full rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-[#0066ff] file:to-[#0099ff] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white file:shadow-sm" />
                                    {teacherForm.cv ? <span className="mt-1 block font-normal text-[#0066ff]">{teacherForm.cv.originalFilename}</span> : null}
                                </label>
                                <label className="block text-xs font-bold text-slate-700">
                                    Certificates / qualification documents (optional, up to 5 files)
                                    <input type="file" name="certificates" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={handleTeacherDocuments} className="mt-2 block w-full rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-slate-700" />
                                    {teacherForm.certificates.map((certificate) => <span key={certificate.originalFilename} className="mt-1 block font-normal text-slate-600">{certificate.originalFilename}</span>)}
                                </label>
                                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">After you verify your email, an administrator will review your application before teacher access is enabled.</p>
                            </div>
                        )}
                        <button disabled={loading} type="submit" className="w-full rounded-xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:-translate-y-0.5 hover:from-[#0052cc] hover:to-[#0088e6] disabled:cursor-wait disabled:opacity-50">
                            {loading ? t("loading") : role === "teacher" ? "Submit teacher application" : "Create student account"}
                        </button>
                    </form>
                    <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
                        Already have an account? <Link to="/sign-in" className="font-bold text-[#0066ff] hover:text-[#0052cc] hover:underline">Sign in</Link>
                    </p>
                    <p className="mt-3 text-center text-xs text-slate-400">By continuing, you agree to TedbabeLearnHUB&apos;s <Link to="/terms" className="font-semibold text-slate-600 hover:underline">Terms</Link> and <Link to="/privacy" className="font-semibold text-slate-600 hover:underline">Privacy Policy</Link>.</p>
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
                <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-500/10 p-4 text-xs leading-relaxed shadow-sm">
                    <div className="flex items-center gap-2 font-bold text-amber-500 mb-1">
                        <span className="text-base">⚠️</span> Cloud Network Email Notice
                    </div>
                    <p className="text-slate-700">
                        Outbound SMTP ports (465/587) were blocked by the cloud server network firewall. Your 6-digit verification code is:
                        <span className="block mt-2 font-mono text-xl font-black text-amber-600 tracking-[0.25em] bg-white py-2 px-3 rounded-xl border border-amber-200 text-center select-all">
                            {fallbackCode}
                        </span>
                    </p>
                </div>
            ) : (
                <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-slate-800 leading-relaxed">
                    Verification code sent to <strong className="font-bold text-[#0066ff]">{email || "your email"}</strong>. If you don't see it within a minute, check your <span className="font-bold underline">Spam / Junk</span> folder.
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    {t("email")}
                    <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium normal-case outline-none transition focus:border-[#0066ff] focus:ring-4 focus:ring-blue-500/10" />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Verification code
                    <input required minLength={6} maxLength={6} pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-4 text-center font-mono text-2xl font-black tracking-[0.5em] outline-none transition focus:border-[#0066ff] focus:ring-4 focus:ring-blue-500/10 text-slate-900" placeholder="000000" aria-label="6-digit verification code" />
                </label>
                {isNewDeviceLogin && (
                    <label className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-xs font-medium normal-case text-slate-700">
                        <input
                            type="checkbox"
                            checked={rememberDevice}
                            onChange={(event) => setRememberDevice(event.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0066ff] focus:ring-blue-500/30"
                        />
                        <span>Remember this device for 30 days and skip this code next time.</span>
                    </label>
                )}
                <button disabled={loading || code.length !== 6} type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:from-[#0052cc] hover:to-[#0088e6] disabled:cursor-wait disabled:opacity-50">
                    {loading ? t("loading") : isNewDeviceLogin ? "Confirm and sign in" : "Verify and continue"}
                </button>
            </form>
            <div className="mt-5 flex flex-col items-center gap-3 text-sm text-slate-600">
                <button type="button" disabled={loading || secondsLeft > 0 || !email} onClick={handleResend} className="font-bold text-[#0066ff] hover:text-[#0052cc] hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline">
                    {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
                </button>
                <Link to="/sign-in" className="font-semibold text-slate-500 hover:text-slate-800">Back to sign in</Link>
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
        <AuthShell title="Reset your password" subtitle="Enter your email to receive recovery instructions">
            <Feedback>{feedback}</Feedback>
            {submitted ? (
                <div className="space-y-5 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-blue-50 text-xl text-[#0066ff] ring-1 ring-sky-200">
                        ✓
                    </div>
                    <p className="text-sm text-slate-600">
                        Check your email inbox for the reset link and 6-digit code.
                    </p>
                    <div className="flex flex-col gap-2 pt-2">
                        <Link
                            to={`/reset-password?email=${encodeURIComponent(email)}`}
                            className="w-full rounded-2xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] py-3 text-xs font-black uppercase tracking-wider text-white hover:from-[#0052cc] hover:to-[#0088e6] transition shadow-md shadow-blue-500/25"
                        >
                            Enter Reset Code
                        </Link>
                        <Link to="/sign-in" className="text-xs font-bold text-slate-500 hover:text-slate-800">
                            Back to sign in
                        </Link>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        {t("email")}
                        <input
                            required
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium normal-case outline-none transition focus:border-[#0066ff] focus:ring-4 focus:ring-blue-500/10"
                            placeholder="name@example.com"
                        />
                    </label>
                    <button
                        disabled={loading || !email}
                        type="submit"
                        className="w-full rounded-2xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:from-[#0052cc] hover:to-[#0088e6] disabled:cursor-wait disabled:opacity-50"
                    >
                        {loading ? t("loading") : "Send Reset Instructions"}
                    </button>
                    <div className="pt-2 text-center text-xs">
                        <Link to="/sign-in" className="font-bold text-slate-600 hover:text-[#0066ff]">
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
                <div className="space-y-4 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-blue-50 text-2xl text-[#0066ff] ring-1 ring-sky-200">
                        ✓
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">Password Changed!</h2>
                    <p className="text-xs text-slate-600">Redirecting to sign-in page…</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        {t("email")}
                        <input
                            required
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium normal-case outline-none transition focus:border-[#0066ff] focus:ring-4 focus:ring-blue-500/10"
                        />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Reset Code or Token
                        <input
                            required
                            type="text"
                            value={tokenOrCode}
                            onChange={(e) => setTokenOrCode(e.target.value)}
                            className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-mono tracking-wider normal-case outline-none transition focus:border-[#0066ff] focus:ring-4 focus:ring-blue-500/10"
                            placeholder="6-digit code or link token"
                        />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        New Password
                        <input
                            required
                            minLength={8}
                            maxLength={128}
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium normal-case outline-none transition focus:border-[#0066ff] focus:ring-4 focus:ring-blue-500/10"
                            placeholder="At least 8 characters"
                        />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Confirm New Password
                        <input
                            required
                            minLength={8}
                            maxLength={128}
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium normal-case outline-none transition focus:border-[#0066ff] focus:ring-4 focus:ring-blue-500/10"
                            placeholder="Re-enter password"
                        />
                    </label>
                    <button
                        disabled={loading || !newPassword || !confirmPassword || !tokenOrCode}
                        type="submit"
                        className="w-full rounded-2xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:from-[#0052cc] hover:to-[#0088e6] disabled:cursor-wait disabled:opacity-50"
                    >
                        {loading ? t("loading") : "Update Password"}
                    </button>
                    <div className="pt-2 text-center text-xs">
                        <Link to="/sign-in" className="font-bold text-slate-600 hover:text-[#0066ff]">
                            ← Return to sign in
                        </Link>
                    </div>
                </form>
            )}
        </AuthShell>
    );
}
