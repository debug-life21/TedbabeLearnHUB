import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";

const HomePage = lazy(() => import("./pages/HomePage").then((page) => ({ default: page.HomePage })));
const ExplorePage = lazy(() => import("./pages/ExplorePage").then((page) => ({ default: page.ExplorePage })));
const CourseCatalogPage = lazy(() => import("./pages/CourseCatalogPage").then((page) => ({ default: page.CourseCatalogPage })));
const CourseDetailsPage = lazy(() => import("./pages/CourseDetailsPage").then((page) => ({ default: page.CourseDetailsPage })));
const HowItWorksPage = lazy(() => import("./pages/HowItWorksPage").then((page) => ({ default: page.HowItWorksPage })));
const PricingPage = lazy(() => import("./pages/PricingPage").then((page) => ({ default: page.PricingPage })));
const InstructorsPage = lazy(() => import("./pages/InstructorsPage").then((page) => ({ default: page.InstructorsPage })));
const HelpCenterPage = lazy(() => import("./pages/HelpCenterPage").then((page) => ({ default: page.HelpCenterPage })));
const VerifyCertificatePage = lazy(() => import("./pages/VerifyCertificatePage").then((page) => ({ default: page.VerifyCertificatePage })));
const LearningWorkspace = lazy(() => import("./pages/LearningWorkspace").then((page) => ({ default: page.LearningWorkspace })));

const AboutPage = lazy(() => import("./pages/AboutPage").then((page) => ({ default: page.AboutPage })));
const ContactPage = lazy(() => import("./pages/ContactPage").then((page) => ({ default: page.ContactPage })));
const FAQPage = lazy(() => import("./pages/FAQPage").then((page) => ({ default: page.FAQPage })));
const LegalPages = lazy(() => import("./pages/LegalPages").then((page) => ({ default: page.PrivacyPolicyPage })));
const TermsOfServicePage = lazy(() => import("./pages/LegalPages").then((page) => ({ default: page.TermsOfServicePage })));
const CookiePolicyPage = lazy(() => import("./pages/LegalPages").then((page) => ({ default: page.CookiePolicyPage })));
const AcceptableUsePage = lazy(() => import("./pages/LegalPages").then((page) => ({ default: page.AcceptableUsePage })));

const SignInPage = lazy(() => import("./pages/AuthPages").then((page) => ({ default: page.SignInPage })));
const SignupPage = lazy(() => import("./pages/AuthPages").then((page) => ({ default: page.SignupPage })));
const VerifyCodePage = lazy(() => import("./pages/AuthPages").then((page) => ({ default: page.VerifyCodePage })));
const ForgotPasswordPage = lazy(() => import("./pages/AuthPages").then((page) => ({ default: page.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/AuthPages").then((page) => ({ default: page.ResetPasswordPage })));

const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then((page) => ({ default: page.AdminDashboard })));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard").then((page) => ({ default: page.TeacherDashboard })));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard").then((page) => ({ default: page.StudentDashboard })));
const PaymentResultPage = lazy(() => import("./pages/PaymentResultPage").then((page) => ({ default: page.PaymentResultPage })));

function ProtectedRoute({ children, roles }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (<div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent"></div>
          <span className="text-sm font-bold text-slate-700">Loading your learning space…</span>
        </div>
      </div>);
    }
    if (!user) {
        return <Navigate to="/sign-in" replace/>;
    }
    const isAdmin = Boolean(user.role === "admin" || user.role === "hub_admin");
    if (!isAdmin && !user.emailVerified) {
        return <Navigate to="/verify-code" replace state={{ email: user.email, purpose: "signup" }} />;
    }
    if (roles && !roles.includes(user.role) && !isAdmin) {
        return <Navigate to="/dashboard" replace/>;
    }
    return <>{children}</>;
}

function TeacherApprovalPending() {
    return (
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
            <div className="rounded-3xl border border-amber-200 bg-white p-8 shadow-sm sm:p-12">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-700">…</div>
                <h1 className="mt-5 text-2xl font-black text-slate-900">Your application is under review</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">Your email is verified. An administrator must approve your teacher account before you can access the teaching dashboard.</p>
            </div>
        </div>
    );
}

function DashboardDispatcher() {
    const { user } = useAuth();
    if (!user) {
        return <Navigate to="/sign-in" replace/>;
    }
    if (user.role === "admin" || user.role === "hub_admin") {
        return <AdminDashboard user={user}/>;
    }
    if (user.role === "teacher") {
        if (user.teacherStatus === "pending" || user.accountStatus === "pending_approval") {
            return <TeacherApprovalPending />;
        }
        return <TeacherDashboard user={user}/>;
    }
    return <StudentDashboard user={user}/>;
}

export default function App() {
    const location = useLocation();
    const isDashboard = location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/workspace");
    return (<div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<div role="status" className="flex min-h-[45vh] items-center justify-center px-4 text-sm font-semibold text-stone-600">Preparing your TedbabeLearnHUB space…</div>}>
        <Routes>
          {/* Public educational & information routes */}
          <Route path="/" element={<HomePage />}/>
          <Route path="/categories" element={<ExplorePage />}/>
          <Route path="/courses" element={<CourseCatalogPage />}/>
          <Route path="/courses/:slug" element={<CourseDetailsPage />}/>
          <Route path="/how-it-works" element={<HowItWorksPage />}/>
          <Route path="/pricing" element={<PricingPage />}/>
          <Route path="/instructors" element={<InstructorsPage />}/>
          <Route path="/about" element={<AboutPage />}/>
          <Route path="/contact" element={<ContactPage />}/>
          <Route path="/faq" element={<FAQPage />}/>
          <Route path="/help" element={<HelpCenterPage />}/>
          <Route path="/verify-certificate" element={<VerifyCertificatePage />}/>
          <Route path="/verify-certificate/:certificateNumber" element={<VerifyCertificatePage />}/>

          {/* Legal pages */}
          <Route path="/privacy" element={<LegalPages />}/>
          <Route path="/terms" element={<TermsOfServicePage />}/>
          <Route path="/cookies" element={<CookiePolicyPage />}/>
          <Route path="/acceptable-use" element={<AcceptableUsePage />}/>

          {/* Authentication & onboarding routes */}
          <Route path="/sign-in" element={<SignInPage />}/>
          <Route path="/signup" element={<SignupPage />}/>
          <Route path="/register/student" element={<SignupPage initialRole="student" />}/>
          <Route path="/apply/teacher" element={<SignupPage initialRole="teacher" />}/>
          <Route path="/verify-code" element={<VerifyCodePage />}/>
          <Route path="/forgot-password" element={<ForgotPasswordPage />}/>
          <Route path="/reset-password" element={<ResetPasswordPage />}/>

          {/* Protected portal dashboard */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardDispatcher /></ProtectedRoute>}/>
          <Route path="/dashboard/student" element={<ProtectedRoute roles={["student"]}><DashboardDispatcher /></ProtectedRoute>}/>
          <Route path="/dashboard/teacher" element={<ProtectedRoute roles={["teacher"]}><DashboardDispatcher /></ProtectedRoute>}/>
          <Route path="/dashboard/admin" element={<ProtectedRoute roles={["admin"]}><DashboardDispatcher /></ProtectedRoute>}/>
          <Route path="/payment/result" element={<ProtectedRoute roles={["student"]}><PaymentResultPage /></ProtectedRoute>}/>

          {/* Dedicated Course Learning Workspace */}
          <Route path="/workspace/:classroomId" element={<ProtectedRoute><LearningWorkspace /></ProtectedRoute>}/>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
        </Suspense>
      </main>
      {!isDashboard && <Footer />}
    </div>);
}
