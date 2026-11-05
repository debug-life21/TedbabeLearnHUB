import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { formatSantim } from "../lib/money";

export function PaymentResultPage() {
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get("orderId") ?? "";
    const returnedFromCancel = searchParams.get("cancelled") === "1";
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [checking, setChecking] = useState(false);

    const verify = useCallback(async () => {
        if (!orderId) {
            setError("The payment return link is missing its order reference. Check your payment history for the latest status.");
            return;
        }
        setChecking(true);
        setError("");
        try {
            setResult(await apiRequest(`/api/payments/orders/${encodeURIComponent(orderId)}/verify`, { method: "POST" }));
        } catch (verifyError) {
            setError(verifyError instanceof Error ? verifyError.message : "The payment could not be verified right now.");
        } finally {
            setChecking(false);
        }
    }, [orderId]);

    useEffect(() => { void verify(); }, [verify]);

    const status = result?.transaction?.status ?? result?.order?.status ?? "pending";
    const success = status === "success" && result?.fulfilled;
    const failed = ["failed", "expired"].includes(status);

    return (
        <main className="editorial-page mx-auto flex min-h-[65vh] max-w-2xl items-center px-4 py-12">
            <section className="w-full rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200 sm:p-12">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--tlh-blue-primary)]">TedbabeLearnHUB checkout</p>
                <h1 className="mt-3 text-3xl font-black text-slate-900">
                    {success ? "Payment confirmed" : failed ? "Payment not completed" : "Payment verification"}
                </h1>
                {success ? (
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                        We verified your payment of {formatSantim(result.transaction.amountSantim, result.transaction.currency)}.
                        Purchased access is active. Course purchases still follow the administrator’s separate class-placement process.
                    </p>
                ) : failed ? (
                    <p className="mt-4 text-sm leading-6 text-slate-600">The provider did not confirm a successful payment. No access was granted. You can review the order in your payment history.</p>
                ) : (
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                        {returnedFromCancel
                            ? "You returned from the payment provider. We are checking the final status with the server; do not retry until it is confirmed."
                            : "The provider has returned you to LearnHUB. Access will not be granted until backend verification confirms payment."}
                    </p>
                )}
                {error ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
                {!success && !failed ? (
                    <button type="button" disabled={checking || !orderId} onClick={() => void verify()} className="golden-btn mt-6 rounded-full px-5 py-3 text-sm font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50">
                        {checking ? "Checking with provider…" : "Check payment status"}
                    </button>
                ) : null}
                {result?.transaction?.reference ? <p className="mt-5 font-mono text-xs text-slate-500">Reference: {result.transaction.reference}</p> : null}
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                    <Link to="/dashboard" className="golden-btn rounded-full px-5 py-3 text-sm font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95">Go to dashboard</Link>
                    <Link to="/courses" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Browse courses</Link>
                </div>
            </section>
        </main>
    );
}
