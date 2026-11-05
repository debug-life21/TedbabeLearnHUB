import { useEffect, useState } from "react";
import { useAuth } from "../../web/src/context/AuthContext.jsx";
import { apiRequest } from "../../web/src/lib/api.js";
import { AdminDashboard } from "../../web/src/pages/AdminDashboard.jsx";
import { Navbar } from "../../web/src/components/Navbar.jsx";
import { Footer } from "../../web/src/components/Footer.jsx";
import { BrandLogo } from "../../web/src/components/BrandLogo.jsx";

const publicAppUrl = import.meta.env.VITE_PUBLIC_URL ?? "/";

function isAdministrator(user) {
  return Boolean(user) && (user.role === "admin" || user.role === "hub_admin");
}

function AppShell({ children, footerOffset = false }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 selection:bg-blue-600 selection:text-white">
      <Navbar />
      <main className="flex-1">{children}</main>
      <div className={footerOffset ? "bg-[var(--tlh-navy-deep)] lg:pl-64" : undefined}>
        <Footer />
      </div>
    </div>
  );
}

export function AdminApp() {
  const { user, loading, refreshUser } = useAuth();
  const [adminUser, setAdminUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isAdministrator(user)) {
      setAdminUser((current) => current ?? user);
    } else if (!user) {
      setAdminUser(null);
    }
  }, [user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await apiRequest("/api/auth/admin-login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (isAdministrator(response.user)) {
        setAdminUser(response.user);
        setPassword("");
        await refreshUser();
      } else {
        setMessage("Access denied. Administrator privileges are required.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--tlh-blue-primary)] border-t-transparent" />
            <span className="text-sm font-bold text-slate-700">
              Checking your session…
            </span>
          </div>
        </div>
      </AppShell>
    );
  }

  if (adminUser) {
    return (
      <AppShell footerOffset>
        {message ? (
          <p
            role="alert"
            className="mx-auto max-w-7xl px-4 pt-4 text-sm font-semibold text-rose-700 sm:px-6 lg:pl-72 lg:pr-8"
          >
            {message}
          </p>
        ) : null}
        <AdminDashboard user={adminUser} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section
        className="auth-page flex flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16"
        aria-labelledby="admin-login-title"
      >
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white p-7 shadow-xl ring-1 ring-slate-200/90 sm:p-10">
            <div className="mb-7 text-center">
              <a
                href={publicAppUrl}
                className="inline-flex justify-center transition hover:opacity-90"
                aria-label="TedbabeLearnHUB home"
              >
                <BrandLogo imgClassName="h-11 w-auto max-w-[240px] object-contain" />
              </a>
              <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tlh-blue-primary)]">
                Private workspace
              </p>
              <h1
                id="admin-login-title"
                className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl"
              >
                Administrator sign in
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Use your provisioned administrator account to manage the
                TedbabeLearnHUB learning community.
              </p>
            </div>

            {message ? (
              <div
                role="alert"
                className="mb-5 rounded-2xl bg-rose-50 p-3.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200"
              >
                {message}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Administrator email
                <input
                  required
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@tedbabelearnhub.com"
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium normal-case outline-none transition focus:border-[var(--tlh-blue-primary)] focus:ring-4 focus:ring-blue-500/10"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Password
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium normal-case outline-none transition focus:border-[var(--tlh-blue-primary)] focus:ring-4 focus:ring-blue-500/10"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="golden-btn w-full rounded-full py-3.5 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95 disabled:cursor-wait disabled:opacity-50"
              >
                {submitting ? "Signing in…" : "Sign in securely"}
              </button>
            </form>

            <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs leading-relaxed text-slate-500">
              Administrator accounts are provisioned by TedbabeLearnHUB. Public
              sign-up is not available here.
            </p>
          </div>

          <p className="mt-5 text-center text-xs font-medium text-slate-500">
            <a
              href={publicAppUrl}
              className="font-bold text-[var(--tlh-blue-primary)] hover:text-[var(--tlh-blue-hover)] hover:underline"
            >
              ← Back to TedbabeLearnHUB
            </a>
          </p>
        </div>
      </section>
    </AppShell>
  );
}
