import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";
import { formatSantim } from "../lib/money";
import { Badge, DashboardCard, EmptyState } from "./UIComponents";

function statusVariant(status) {
    if (status === "success" || status === "paid") return "emerald";
    if (status === "pending" || status === "processing" || status === "initialized") return "amber";
    if (status === "failed") return "rose";
    return "slate";
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);
}

function printReceipt(receipt, printWindow) {
    const currency = receipt.platform.currency;
    const rows = receipt.order.items.map((item) => `
        <tr><td>${escapeHtml(item.title)}</td><td>${item.quantity}</td>
        <td>${escapeHtml(formatSantim(item.unitPriceSantim, currency))}</td>
        <td>${escapeHtml(formatSantim(item.subtotalSantim, currency))}</td></tr>`).join("");
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(receipt.receiptNumber)}</title>
        <style>body{font:14px Arial,sans-serif;max-width:760px;margin:40px auto;color:#172033}
        h1{margin-bottom:4px}small{color:#64748b}table{width:100%;border-collapse:collapse;margin:24px 0}
        th,td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f8fafc}
        .total{font-size:18px;font-weight:bold;text-align:right}.meta{line-height:1.8}</style></head>
        <body><h1>${escapeHtml(receipt.platform.name)}</h1><small>Payment receipt</small>
        <div class="meta"><p>Receipt: ${escapeHtml(receipt.receiptNumber)}<br>
        Order: ${escapeHtml(receipt.order.reference)}<br>
        Issued: ${escapeHtml(new Date(receipt.issuedAt).toLocaleString())}<br>
        Student: ${escapeHtml(receipt.student.fullName)} (${escapeHtml(receipt.student.email)})<br>
        Provider: ${escapeHtml(receipt.transaction.provider)}<br>
        Payment status: ${escapeHtml(receipt.transaction.status)}</p></div>
        <table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
        <p>Subtotal: ${escapeHtml(formatSantim(receipt.order.subtotalSantim, currency))}<br>
        Discount: ${escapeHtml(formatSantim(receipt.order.discountSantim, currency))}</p>
        <p class="total">Paid: ${escapeHtml(formatSantim(receipt.order.totalSantim, currency))}</p>
        <script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
}

export function StudentPaymentsPanel({ courses = [] }) {
    const [plans, setPlans] = useState([]);
    const [providers, setProviders] = useState([]);
    const [orders, setOrders] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [providerId, setProviderId] = useState("");
    const [promotionCode, setPromotionCode] = useState("");
    const [instructions, setInstructions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busyItem, setBusyItem] = useState("");
    const [error, setError] = useState("");
    const [feedback, setFeedback] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [catalog, config, history, subscriptionHistory] = await Promise.all([
                apiRequest("/api/public/plans"),
                apiRequest("/api/payments/config"),
                apiRequest("/api/payments/orders?limit=50"),
                apiRequest("/api/payments/subscriptions"),
            ]);
            setPlans(catalog.plans ?? []);
            setProviders((config.enabled ? config.providers ?? [] : []).filter((provider) => provider.configured && provider.capabilities?.initialize));
            setOrders(history.orders ?? []);
            setSubscriptions(subscriptionHistory.subscriptions ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Unable to load payment information.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        if (!providers.some((provider) => provider.id === providerId)) {
            setProviderId(providers[0]?.id ?? "");
        }
    }, [providerId, providers]);

    const paidCourses = useMemo(() => courses.filter((course) => course.isFree === false && course.priceSantim > 0), [courses]);

    const purchase = async (itemType, itemId, key) => {
        if (!providerId) {
            setError("There is no configured payment provider available right now.");
            return;
        }
        setBusyItem(key);
        setError("");
        setFeedback("");
        setInstructions(null);
        try {
            const created = await apiRequest("/api/payments/orders", {
                method: "POST",
                body: JSON.stringify({
                    items: [{ itemType, itemId }],
                    promotionCode: promotionCode.trim(),
                    providerId,
                }),
            });
            const orderId = created.order._id;
            const resultUrl = `${window.location.origin}/payment/result?orderId=${encodeURIComponent(orderId)}`;
            const checkout = await apiRequest("/api/payments/checkout", {
                method: "POST",
                body: JSON.stringify({
                    orderId,
                    providerId,
                    returnUrl: resultUrl,
                    cancelUrl: `${resultUrl}&cancelled=1`,
                }),
            });
            if (checkout.checkoutUrl) {
                window.location.assign(checkout.checkoutUrl);
                return;
            }
            if (checkout.instructions) {
                setInstructions({ ...checkout.instructions, orderId, reference: checkout.transaction.reference });
                setFeedback("Follow the provider instructions, then check the payment status here.");
                await load();
                return;
            }
            throw new Error("The provider did not return checkout instructions. Your order remains pending; refresh before retrying.");
        } catch (purchaseError) {
            setError(purchaseError instanceof Error ? purchaseError.message : "Unable to start checkout.");
        } finally {
            setBusyItem("");
        }
    };

    const verifyOrder = async (orderId) => {
        setBusyItem(orderId);
        setError("");
        setFeedback("");
        try {
            const result = await apiRequest(`/api/payments/orders/${orderId}/verify`, { method: "POST" });
            const status = result.transaction?.status ?? result.order?.status ?? "pending";
            setFeedback(status === "success" && result.fulfilled
                ? "Payment verified. Your purchased access is active; course placement still follows the administrator workflow."
                : `Payment status: ${status.replace(/_/g, " ")}. Access is granted only after server verification.`);
            await load();
        } catch (verifyError) {
            setError(verifyError instanceof Error ? verifyError.message : "Payment verification could not be completed.");
        } finally {
            setBusyItem("");
        }
    };

    const openReceipt = async (transactionId) => {
        setError("");
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            setError("Allow pop-ups to open and print your receipt.");
            return;
        }
        try {
            const { receipt } = await apiRequest(`/api/payments/transactions/${transactionId}/receipt`);
            printReceipt(receipt, printWindow);
        } catch (receiptError) {
            printWindow.close();
            setError(receiptError instanceof Error ? receiptError.message : "Unable to open the receipt.");
        }
    };

    const cancelSubscription = async (subscriptionId) => {
        if (!window.confirm("Cancel this subscription at the end of its paid period? It will not renew automatically.")) return;
        setBusyItem(subscriptionId);
        setError("");
        setFeedback("");
        try {
            await apiRequest(`/api/payments/subscriptions/${subscriptionId}/cancel`, { method: "POST" });
            setFeedback("Cancellation is scheduled for the end of the current paid period. No automatic charge will be made.");
            await load();
        } catch (cancelError) {
            setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel the subscription.");
        } finally {
            setBusyItem("");
        }
    };

    if (loading) return <div role="status" className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Loading payment options…</div>;

    return (
        <div className="space-y-6">
            {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
            {feedback ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{feedback}</p> : null}

            {instructions ? (
                <DashboardCard title="Complete your payment" subtitle={`Order ${instructions.reference}`}>
                    {instructions.type === "telebirr_app" ? (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-700">Open Telebirr and enter the receive code shown below. We will not activate access until the server verifies the payment.</p>
                            <p className="rounded-xl bg-slate-100 p-4 text-center font-mono text-2xl font-black tracking-widest">{instructions.receiveCode}</p>
                            <button type="button" disabled={Boolean(busyItem)} onClick={() => void verifyOrder(instructions.orderId)} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                                {busyItem ? "Checking…" : "Check payment status"}
                            </button>
                        </div>
                    ) : <p className="text-sm text-slate-600">Complete payment in the provider app, then check your transaction history.</p>}
                </DashboardCard>
            ) : null}

            <DashboardCard title="Available learning options" subtitle="Choose a paid course or package. Free courses continue through the existing registration process.">
                {!providers.length ? (
                    <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Online checkout is not available in this environment. No payment will be collected.</p>
                ) : (
                    <div className="mb-5 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-bold text-slate-700">Payment method
                            <select className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" value={providerId} onChange={(event) => setProviderId(event.target.value)}>
                                {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                            </select>
                        </label>
                        <label className="text-xs font-bold text-slate-700">Promotion code (optional)
                            <input className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" value={promotionCode} onChange={(event) => setPromotionCode(event.target.value)} maxLength={40} placeholder="Enter code" />
                        </label>
                    </div>
                )}
                {paidCourses.length === 0 && plans.length === 0 ? (
                    <EmptyState title="No paid options are available yet." description="Free course registration remains available from Choose courses." />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {paidCourses.map((course) => (
                            <div key={course._id} className="rounded-2xl border border-slate-200 p-5">
                                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Course</p>
                                <h3 className="mt-1 font-bold text-slate-900">{course.title}</h3>
                                <p className="mt-2 text-lg font-black text-slate-900">{formatSantim(course.priceSantim, course.currency)}</p>
                                <button type="button" disabled={!providers.length || Boolean(busyItem)} onClick={() => void purchase("course", course._id, `course:${course._id}`)} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                                    {busyItem === `course:${course._id}` ? "Starting…" : "Purchase course"}
                                </button>
                            </div>
                        ))}
                        {plans.map((plan) => (
                            <div key={plan._id} className="rounded-2xl border border-slate-200 p-5">
                                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{plan.kind.replace(/_/g, " ")}{plan.interval !== "none" ? ` · ${plan.interval}` : ""}</p>
                                <h3 className="mt-1 font-bold text-slate-900">{plan.name}</h3>
                                <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
                                {plan.benefits?.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">{plan.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul> : null}
                                <p className="mt-3 text-lg font-black text-slate-900">{formatSantim(plan.priceSantim, plan.currency)}{plan.interval !== "none" ? <span className="text-xs font-semibold text-slate-500"> / {plan.interval}</span> : null}</p>
                                <button type="button" disabled={!providers.length || Boolean(busyItem)} onClick={() => void purchase("plan", plan._id, `plan:${plan._id}`)} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                                    {busyItem === `plan:${plan._id}` ? "Starting…" : "Choose option"}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </DashboardCard>

            <DashboardCard title="Payment history" subtitle="Only server-verified payments grant access. Receipts open in a print-ready window.">
                {!orders.length ? <EmptyState title="No payment orders yet." description="Your orders and transaction status will appear here." /> : (
                    <div className="space-y-3">
                        {orders.map((order) => (
                            <div key={order._id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                                <div>
                                    <p className="font-bold text-slate-900">{order.items.map((item) => item.title).join(", ")}</p>
                                    <p className="mt-1 text-xs text-slate-500">{order.reference} · {new Date(order.createdAt).toLocaleString()}</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">{formatSantim(order.totalSantim, order.currency)}</p>
                                    {order.transactions?.length ? <div className="mt-2 flex flex-wrap gap-2">{order.transactions.map((transaction) => <Badge key={transaction._id} variant={statusVariant(transaction.status)}>{transaction.provider}: {transaction.status.replace(/_/g, " ")}</Badge>)}</div> : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {["pending", "processing"].includes(order.status) ? <button type="button" disabled={Boolean(busyItem)} onClick={() => void verifyOrder(order._id)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-50">{busyItem === order._id ? "Checking…" : "Verify status"}</button> : null}
                                    {order.transactions?.filter((transaction) => ["success", "refunded", "partially_refunded"].includes(transaction.status)).map((transaction) => (
                                        <button key={transaction._id} type="button" onClick={() => void openReceipt(transaction._id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Receipt / PDF</button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </DashboardCard>

            <DashboardCard title="Subscriptions" subtitle="Renewals require you to place and pay for a new order. LearnHUB never charges you automatically.">
                {!subscriptions.length ? <EmptyState title="No subscriptions yet." description="Recurring plans you purchase will be listed here." /> : (
                    <div className="space-y-3">
                        {subscriptions.map((subscription) => (
                            <div key={subscription._id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                                <div>
                                    <p className="font-bold text-slate-900">{subscription.plan?.name ?? subscription.planCode}</p>
                                    <p className="mt-1 text-xs capitalize text-slate-500">{subscription.interval} · {subscription.status.replace(/_/g, " ")}</p>
                                    <p className="mt-1 text-xs text-slate-600">Current period ends {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "not set"}</p>
                                    {subscription.cancelAtPeriodEnd ? <p className="mt-1 text-xs font-semibold text-amber-800">Cancellation scheduled at period end</p> : null}
                                </div>
                                {["active", "grace_period"].includes(subscription.status) && !subscription.cancelAtPeriodEnd ? (
                                    <button type="button" disabled={Boolean(busyItem)} onClick={() => void cancelSubscription(subscription._id)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-800 disabled:opacity-50">
                                        {busyItem === subscription._id ? "Updating…" : "Cancel at period end"}
                                    </button>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
            </DashboardCard>
        </div>
    );
}
