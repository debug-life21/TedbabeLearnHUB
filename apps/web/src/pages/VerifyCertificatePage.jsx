import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { BrandLogo } from "../components/BrandLogo";

export function VerifyCertificatePage() {
  const { certificateNumber } = useParams();
  const [query, setQuery] = useState(certificateNumber || "");
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lookupCertificate = async (num) => {
    if (!num || !num.trim()) return;
    setLoading(true);
    setError("");
    setCertificate(null);
    try {
      const res = await apiRequest(
        `/api/public/certificates/${encodeURIComponent(num.trim())}`,
      );
      setCertificate(res.certificate);
    } catch (err) {
      setError(err.message || "Certificate record could not be verified.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (certificateNumber) {
      lookupCertificate(certificateNumber);
    }
  }, [certificateNumber]);

  const handleSearch = (e) => {
    e.preventDefault();
    lookupCertificate(query);
  };

  return (
    <div className="editorial-page min-h-screen pb-24">
      {/* Isolate the certificate when printing / saving as PDF. */}
      <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #tlh-certificate, #tlh-certificate * { visibility: visible !important; }
                    #tlh-certificate {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        border-width: 4px !important;
                        box-shadow: none !important;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

      {/* Header Hero */}
      <div className="editorial-hero no-print border-b border-slate-200/80 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <span className="editorial-kicker text-blue-600 font-extrabold tracking-widest">
            OFFICIAL CREDENTIAL VERIFICATION
          </span>
          <h1 className="editorial-display mt-3 text-4xl font-extrabold text-slate-900 sm:text-5xl">
            Verify a TedbabeLearnHUB Certificate
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
            Institutions, employers, and academic bodies can independently
            authenticate TedbabeLearnHUB (TLH) certificates issued to students
            upon completing verified courses.
          </p>

          {/* Lookup Input Form */}
          <div className="mt-8 max-w-md mx-auto">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter ID e.g. TLH-2026-XXXX"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-mono tracking-wider text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="rounded-2xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] disabled:opacity-50"
              >
                {loading ? "Checking…" : "Verify"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Verification Result Section */}
      <div className="mx-auto max-w-4xl px-4 pt-12 sm:px-6 lg:px-8">
        {loading && (
          <div className="no-print flex justify-center py-12">
            <div className="flex items-center gap-3 rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-xs font-bold text-slate-700">
                Verifying credential against registry…
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-3xl bg-rose-50 p-8 text-center ring-1 ring-rose-200">
            <span className="text-3xl mb-2 block">⚠️</span>
            <h3 className="font-bold text-rose-900 text-lg">
              Verification Failed
            </h3>
            <p className="mt-1 text-xs text-rose-700">{error}</p>
            <p className="mt-3 text-[11px] text-slate-500">
              Please verify that the certificate identifier was typed correctly
              with prefixes (e.g. TLH-2026-...).
            </p>
          </div>
        )}

        {certificate && (
          <div className="space-y-6">
            {/* Status Alert Badge */}
            <div
              className={`no-print flex items-center justify-between rounded-2xl px-6 py-3.5 ring-1 ${
                certificate.status === "revoked"
                  ? "bg-rose-50 ring-rose-200"
                  : "bg-sky-50 ring-sky-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-white font-bold text-xs ${
                    certificate.status === "revoked"
                      ? "bg-rose-600"
                      : "bg-blue-600"
                  }`}
                >
                  {certificate.status === "revoked" ? "✕" : "✓"}
                </span>
                <span
                  className={`text-xs font-bold ${
                    certificate.status === "revoked"
                      ? "text-rose-900"
                      : "text-blue-900"
                  }`}
                >
                  {certificate.status === "revoked"
                    ? "Revoked Credential — No Longer Valid"
                    : "Official Authenticated Credential — Active & Valid"}
                </span>
              </div>
              <button
                onClick={() => window.print()}
                className="rounded-xl border border-sky-300 bg-white px-3 py-1 text-xs font-bold text-blue-700 hover:bg-sky-50 transition"
              >
                🖨️ Print / Save PDF
              </button>
            </div>

            {/* Framed Certificate Presentation */}
            <div
              id="tlh-certificate"
              className="relative overflow-hidden rounded-3xl border-8 border-[var(--tlh-navy)] bg-[#fffef9] p-8 sm:p-14 shadow-2xl text-center"
            >
              {/* Inner Decorative Border */}
              <div className="rounded-2xl border border-[var(--tlh-cyan)]/40 p-8 sm:p-12 relative bg-radial-gradient">
                {/* Watermark Brand Seal */}
                <div className="mx-auto mb-6 flex justify-center">
                  <BrandLogo size="lg" appearance="light" />
                </div>

                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--tlh-navy)]">
                  TEDBABELEARNHUB (TLH) ONLINE LEARNING PLATFORM
                </p>
                <h2 className="editorial-display mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Certificate of Course Completion
                </h2>

                <p className="mt-6 text-xs text-slate-500 uppercase tracking-widest">
                  THIS IS PROUDLY CONFERRED UPON
                </p>
                <div className="editorial-display mt-2 text-3xl font-extrabold text-slate-950 sm:text-4xl underline decoration-[var(--tlh-cyan)] decoration-2 underline-offset-8">
                  {certificate.studentName}
                </div>

                <p className="mt-6 text-xs text-slate-600 max-w-xl mx-auto leading-relaxed">
                  for successfully satisfying all academic requirements,
                  attending scheduled cohort live sessions, completing
                  coursework assignments, and passing evaluation assessments in
                </p>

                <div className="mt-3 text-xl font-black text-[var(--tlh-blue-primary)] sm:text-2xl">
                  {certificate.courseTitle}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-around gap-6 border-t border-slate-200/80 pt-8 text-left text-xs">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">
                      Date Issued
                    </span>
                    <span className="font-bold text-slate-800">
                      {new Date(certificate.issueDate).toLocaleDateString(
                        undefined,
                        { dateStyle: "long" },
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">
                      Overall Score
                    </span>
                    <span className="font-mono font-bold text-blue-600 text-sm">
                      {certificate.overallScore}% Grade
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">
                      Instructor / Faculty
                    </span>
                    <span className="font-bold text-slate-800">
                      {certificate.instructorName}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">
                      Credential ID
                    </span>
                    <span className="font-mono text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {certificate.certificateNumber}
                    </span>
                  </div>
                </div>

                {/* Authorised academy signature */}
                <div className="mt-10 flex flex-col items-center">
                  {certificate.signatureImage ? (
                    <img
                      src={certificate.signatureImage}
                      alt="Authorised signature"
                      className="h-16 object-contain"
                    />
                  ) : (
                    <span className="editorial-display text-2xl italic text-slate-800">
                      {certificate.signatureName || certificate.instructorName}
                    </span>
                  )}
                  <span className="mt-2 w-64 border-t border-slate-400" />
                  <span className="mt-2 text-xs font-bold text-slate-800">
                    {certificate.signatureName || certificate.instructorName}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {certificate.signatureTitle ||
                      "Authorised Signatory — TedbabeLearnHUB Academy"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
