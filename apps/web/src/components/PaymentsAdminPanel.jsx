import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";
import { formatSantim, toMajorUnits, toSantim } from "../lib/money";
import {
  Badge,
  DashboardCard,
  EmptyState,
  MetricCard,
  Modal,
} from "./UIComponents";

/**
 * Payment management dashboard (Module 4).
 *
 * Every figure is computed by the server from real Transaction / Refund rows —
 * nothing here is estimated or simulated. Gross, gateway fees, refunds and net
 * are shown as separate columns so the difference between collected money and
 * money actually retained is never blurred.
 */

const RANGE_PRESETS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

const GRANULARITIES = [
  { value: "day", label: "Daily" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

const TRANSACTION_STATUSES = [
  "initialized",
  "pending",
  "success",
  "failed",
  "cancelled",
  "expired",
  "refunded",
  "partially_refunded",
];

const REFUND_STATUSES = [
  "requested",
  "approved",
  "processing",
  "processed",
  "failed",
  "rejected",
];

const STATUS_BADGE = {
  success: "emerald",
  pending: "amber",
  initialized: "slate",
  failed: "rose",
  cancelled: "slate",
  expired: "slate",
  refunded: "indigo",
  partially_refunded: "indigo",
  requested: "amber",
  approved: "cyan",
  processing: "cyan",
  processed: "emerald",
  rejected: "rose",
};

const inputClass = "w-full rounded-xl border border-slate-200 p-2.5 text-sm";
const labelClass = "block text-xs font-bold text-slate-700";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status) {
  return String(status ?? "").replace(/_/g, " ");
}

/** Build the query string shared by the dashboard, transaction and refund calls. */
function buildQuery({
  preset,
  from,
  to,
  granularity,
  provider,
  status,
  courseId,
  page,
  limit,
}) {
  const params = new URLSearchParams();
  if (preset && preset !== "custom") {
    const days = Number(preset);
    params.set(
      "from",
      new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
    );
  } else {
    if (from) params.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
  }
  if (granularity) params.set("granularity", granularity);
  if (provider) params.set("provider", provider);
  if (status) params.set("status", status);
  if (courseId) params.set("courseId", courseId);
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  return params.toString();
}

export function PaymentsAdminPanel() {
  const [filters, setFilters] = useState({
    preset: "30",
    from: "",
    to: "",
    granularity: "day",
    provider: "",
    status: "",
    courseId: "",
  });
  const [page, setPage] = useState(1);
  const [dashboard, setDashboard] = useState(null);
  const [transactions, setTransactions] = useState({
    rows: [],
    total: 0,
    limit: 100,
  });
  const [refunds, setRefunds] = useState([]);
  const [providers, setProviders] = useState([]);
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundForm, setRefundForm] = useState({ amount: "0.00", reason: "" });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const query = buildQuery({ ...filters, page, limit: 100 });
      const [dashboardRes, transactionsRes, refundsRes, configRes, coursesRes] =
        await Promise.all([
          apiRequest(`/api/admin/payments/dashboard?${query}`),
          apiRequest(`/api/admin/payments/transactions?${query}`),
          apiRequest(`/api/admin/payments/refunds?${query}`),
          apiRequest("/api/admin/payments/config"),
          apiRequest("/api/admin/courses"),
        ]);
      setDashboard(dashboardRes);
      setTransactions(transactionsRes);
      setRefunds(refundsRes.refunds || []);
      setProviders(configRes.providers || []);
      setCourses(coursesRes.courses || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load payment data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const refresh = async (message) => {
    await load();
    if (message) {
      setFeedback(message);
    }
  };

  const revenue = dashboard?.revenue;
  const counts = dashboard?.transactions;
  const pageCount = Math.max(
    1,
    Math.ceil((transactions.total || 0) / (transactions.limit || 100)),
  );

  const providerOptions = useMemo(
    () => providers.map((entry) => entry.id),
    [providers],
  );

  const openRefundModal = (transaction) => {
    if (!transaction?.order?.id) return;
    setRefundTarget(transaction);
    setRefundForm({
      amount: toMajorUnits(transaction.amountSantim),
      reason: "",
    });
  };

  const submitRefund = async () => {
    if (!refundTarget) return;
    const amountSantim = toSantim(refundForm.amount);
    if (!amountSantim || amountSantim <= 0) {
      setError("Enter a refund amount greater than zero.");
      return;
    }
    if (refundForm.reason.trim().length < 3) {
      setError("Enter a refund reason of at least 3 characters.");
      return;
    }
    setIsBusy(true);
    setError("");
    try {
      await apiRequest("/api/admin/payments/refunds", {
        method: "POST",
        body: JSON.stringify({
          orderId: refundTarget.order.id,
          amountSantim,
          reason: refundForm.reason.trim(),
        }),
      });
      setRefundTarget(null);
      await refresh("Refund request recorded.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to record the refund.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const settleRefund = async (refund, status) => {
    setIsBusy(true);
    setError("");
    try {
      await apiRequest(`/api/admin/payments/refunds/${refund.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh(`Refund marked ${status}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update the refund.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const reconcile = async () => {
    setIsBusy(true);
    setError("");
    try {
      const result = await apiRequest("/api/admin/payments/reconcile", {
        method: "POST",
        body: JSON.stringify({ olderThanMinutes: 15, limit: 100 }),
      });
      const summary = result.summary ?? {};
      await refresh(
        `Reconciled ${summary.checked ?? 0} open attempt(s): ${summary.settled ?? 0} settled, ${summary.failed ?? 0} failed.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconciliation failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const exportCsv = async () => {
    setIsBusy(true);
    setError("");
    try {
      const query = buildQuery({ ...filters, page: 1 });
      const blob = await apiRequest(
        `/api/admin/payments/transactions/export.csv?${query}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "learnhub-transactions.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback("CSV transaction report downloaded.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to export the transaction report.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading && !dashboard) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
        Loading payment data…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-blue-700">
          {feedback}
        </div>
      ) : null}

      {/* Filters */}
      <DashboardCard
        title="Filters"
        subtitle={`Timezone ${dashboard?.timezone ?? "Africa/Addis_Ababa"} · amounts in ${dashboard?.currency ?? "ETB"} · CSV exports are limited to 5,000 matching transactions`}
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={isBusy}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void reconcile()}
              disabled={isBusy}
              className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              Reconcile pending
            </button>
            <button
              type="button"
              onClick={() => void exportCsv()}
              disabled={isBusy}
              className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={isBusy}
              className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              Print / Save PDF
            </button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="payments-range">
              Date range
            </label>
            <select
              id="payments-range"
              className={inputClass}
              value={filters.preset}
              onChange={(event) => setFilter("preset", event.target.value)}
            >
              {RANGE_PRESETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom range</option>
            </select>
          </div>
          {filters.preset === "custom" ? (
            <>
              <div>
                <label className={labelClass} htmlFor="payments-from">
                  From
                </label>
                <input
                  id="payments-from"
                  type="date"
                  className={inputClass}
                  value={filters.from}
                  onChange={(event) => setFilter("from", event.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="payments-to">
                  To
                </label>
                <input
                  id="payments-to"
                  type="date"
                  className={inputClass}
                  value={filters.to}
                  onChange={(event) => setFilter("to", event.target.value)}
                />
              </div>
            </>
          ) : null}
          <div>
            <label className={labelClass} htmlFor="payments-granularity">
              Series granularity
            </label>
            <select
              id="payments-granularity"
              className={inputClass}
              value={filters.granularity}
              onChange={(event) => setFilter("granularity", event.target.value)}
            >
              {GRANULARITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="payments-provider">
              Payment method
            </label>
            <select
              id="payments-provider"
              className={inputClass}
              value={filters.provider}
              onChange={(event) => setFilter("provider", event.target.value)}
            >
              <option value="">All providers</option>
              {providerOptions.map((providerId) => {
                const entry = providers.find((item) => item.id === providerId);
                return (
                  <option key={providerId} value={providerId}>
                    {entry?.label ?? providerId}
                    {entry?.configured ? "" : " (not configured)"}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="payments-status">
              Transaction status
            </label>
            <select
              id="payments-status"
              className={inputClass}
              value={filters.status}
              onChange={(event) => setFilter("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {TRANSACTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="payments-course">
              Course
            </label>
            <select
              id="payments-course"
              className={inputClass}
              value={filters.courseId}
              onChange={(event) => setFilter("courseId", event.target.value)}
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </DashboardCard>

      {/* Revenue summary */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Gross revenue"
          value={formatSantim(revenue?.grossSantim ?? 0)}
          icon="💵"
          subtext={`${revenue?.transactionCount ?? 0} collected transaction(s)`}
        />
        <MetricCard
          label="Gateway fees"
          value={formatSantim(revenue?.gatewayFeeSantim ?? 0)}
          icon="🏦"
          subtext="Charged by the payment providers"
        />
        <MetricCard
          label="Refunds"
          value={formatSantim(revenue?.refundedSantim ?? 0)}
          icon="↩️"
          subtext={`${counts?.refunded ?? 0} refunded transaction(s)`}
        />
        <MetricCard
          label="Net revenue"
          value={formatSantim(revenue?.netSantim ?? 0)}
          icon="📈"
          subtext="Gross − gateway fees − refunds"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Today"
          value={formatSantim(dashboard?.today?.grossSantim ?? 0)}
          icon="📅"
          subtext={`${dashboard?.today?.transactionCount ?? 0} transaction(s)`}
        />
        <MetricCard
          label="Month to date"
          value={formatSantim(dashboard?.monthToDate?.grossSantim ?? 0)}
          icon="🗓️"
          subtext={`${dashboard?.monthToDate?.transactionCount ?? 0} transaction(s)`}
        />
        <MetricCard
          label="Average order"
          value={formatSantim(revenue?.averageOrderSantim ?? 0)}
          icon="🧾"
          subtext="Gross ÷ collected transactions"
        />
        <MetricCard
          label="Failed / cancelled"
          value={`${counts?.failed ?? 0} / ${counts?.cancelled ?? 0}`}
          icon="⚠️"
          subtext={`${counts?.pending ?? 0} still pending`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard
          title="Revenue by source"
          subtitle="Where the collected money came from"
        >
          <dl className="space-y-3 text-sm">
            {[
              ["Course sales", dashboard?.revenueBySource?.coursesSantim],
              ["Subscriptions", dashboard?.revenueBySource?.subscriptionSantim],
              [
                "One-time packages & services",
                dashboard?.revenueBySource?.oneOffPlansSantim,
              ],
              [
                "Total plans & packages",
                dashboard?.revenueBySource?.plansTotalSantim,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0"
              >
                <dt className="font-semibold text-slate-600">{label}</dt>
                <dd className="font-black text-slate-900">
                  {formatSantim(value ?? 0)}
                </dd>
              </div>
            ))}
          </dl>
        </DashboardCard>

        <DashboardCard
          title="Payment provider performance"
          subtitle="Attempts, successes and fees per gateway"
        >
          {(dashboard?.providers ?? []).length === 0 ? (
            <EmptyState
              title="No gateway traffic yet"
              description="Provider performance appears once transactions are recorded."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-2">Provider</th>
                    <th className="pb-2">Attempts</th>
                    <th className="pb-2">Success</th>
                    <th className="pb-2">Failed</th>
                    <th className="pb-2">Success rate</th>
                    <th className="pb-2 text-right">Gross</th>
                  </tr>
                </thead>
                <tbody className="font-semibold text-slate-700">
                  {(dashboard?.providers ?? []).map((row) => (
                    <tr
                      key={row.provider}
                      className="border-t border-slate-100"
                    >
                      <td className="py-2 font-bold text-slate-900">
                        {row.provider}
                      </td>
                      <td className="py-2">{row.attempts}</td>
                      <td className="py-2">{row.successCount}</td>
                      <td className="py-2">{row.failureCount}</td>
                      <td className="py-2">
                        {row.successRate === null ? "—" : `${row.successRate}%`}
                      </td>
                      <td className="py-2 text-right">
                        {formatSantim(row.grossSantim)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>
      </div>

      <DashboardCard
        title="Course revenue"
        subtitle="Top selling courses in the selected range"
      >
        {(dashboard?.courses ?? []).length === 0 ? (
          <EmptyState
            title="No course sales in this range"
            description="Adjust the filters to widen the reporting window."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-2">Course</th>
                  <th className="pb-2">Orders</th>
                  <th className="pb-2">Seats</th>
                  <th className="pb-2 text-right">Gross</th>
                </tr>
              </thead>
              <tbody className="font-semibold text-slate-700">
                {dashboard.courses.map((row) => (
                  <tr key={row.courseId} className="border-t border-slate-100">
                    <td className="py-2 font-bold text-slate-900">
                      {row.title}
                    </td>
                    <td className="py-2">{row.orderCount}</td>
                    <td className="py-2">{row.quantity}</td>
                    <td className="py-2 text-right">
                      {formatSantim(row.grossSantim)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      {/* Revenue series */}
      <DashboardCard
        title="Revenue over time"
        subtitle={`Grouped by ${filters.granularity}`}
      >
        {(dashboard?.series ?? []).length === 0 ? (
          <EmptyState
            title="No revenue in this range"
            description="Nothing was collected during the selected period."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-2">Period</th>
                  <th className="pb-2">Transactions</th>
                  <th className="pb-2">Gross</th>
                  <th className="pb-2">Fees</th>
                  <th className="pb-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="font-semibold text-slate-700">
                {dashboard.series.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100">
                    <td className="py-2 font-bold text-slate-900">{row.key}</td>
                    <td className="py-2">{row.count}</td>
                    <td className="py-2">{formatSantim(row.grossSantim)}</td>
                    <td className="py-2">{formatSantim(row.feeSantim)}</td>
                    <td className="py-2 text-right">
                      {formatSantim(row.netSantim)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      {/* Transactions */}
      <DashboardCard
        title="Transactions"
        subtitle={`${transactions.total} record(s) matching the filters`}
      >
        {transactions.rows.length === 0 ? (
          <EmptyState
            title="No transactions"
            description="No payment attempts match the current filters."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-2">Reference</th>
                    <th className="pb-2">Student</th>
                    <th className="pb-2">Item</th>
                    <th className="pb-2">Provider</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Fee</th>
                    <th className="pb-2">Net</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="font-semibold text-slate-700">
                  {transactions.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100 align-top"
                    >
                      <td className="py-2 font-mono text-[11px] text-slate-900">
                        {row.reference}
                      </td>
                      <td className="py-2">
                        <div className="font-bold text-slate-900">
                          {row.student?.fullName ?? "—"}
                        </div>
                        <div className="text-[11px] font-medium text-slate-400">
                          {row.student?.email ?? ""}
                        </div>
                      </td>
                      <td className="py-2">
                        {(row.order?.items ?? []).map((item, index) => (
                          <div key={`${row.id}-${index}`}>
                            {item.title} × {item.quantity}
                          </div>
                        ))}
                      </td>
                      <td className="py-2">{row.provider}</td>
                      <td className="py-2">
                        <Badge variant={STATUS_BADGE[row.status] ?? "slate"}>
                          {statusLabel(row.status)}
                        </Badge>
                      </td>
                      <td className="py-2">{formatSantim(row.amountSantim)}</td>
                      <td className="py-2">{formatSantim(row.feeSantim)}</td>
                      <td className="py-2">{formatSantim(row.netSantim)}</td>
                      <td className="py-2 whitespace-nowrap">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="py-2 text-right">
                        {row.order?.id && row.status === "success" ? (
                          <button
                            type="button"
                            onClick={() => openRefundModal(row)}
                            disabled={isBusy}
                            className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Refund
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pageCount > 1 ? (
              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>
                  Page {transactions.page} of {pageCount}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || isBusy}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="rounded-lg bg-white px-3 py-1.5 font-bold text-slate-700 ring-1 ring-slate-300 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= pageCount || isBusy}
                    onClick={() => setPage((value) => value + 1)}
                    className="rounded-lg bg-white px-3 py-1.5 font-bold text-slate-700 ring-1 ring-slate-300 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </DashboardCard>

      {/* Refund ledger */}
      <DashboardCard
        title="Refund ledger"
        subtitle={`${refunds.length} refund record(s)`}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {REFUND_STATUSES.filter(
            (status) => dashboard?.refunds?.byStatus?.[status],
          ).map((status) => (
            <div
              key={status}
              className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {statusLabel(status)}
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {formatSantim(dashboard.refunds.byStatus[status].amountSantim)}
              </p>
              <p className="text-[11px] font-semibold text-slate-400">
                {dashboard.refunds.byStatus[status].count} refund(s)
              </p>
            </div>
          ))}
        </div>
        {refunds.length === 0 ? (
          <EmptyState
            title="No refunds"
            description="Refund requests will be listed here once recorded."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-2">Order</th>
                  <th className="pb-2">Student</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Provider capability</th>
                  <th className="pb-2">Reason</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="font-semibold text-slate-700">
                {refunds.map((refund) => (
                  <tr
                    key={refund.id}
                    className="border-t border-slate-100 align-top"
                  >
                    <td className="py-2 font-mono text-[11px] text-slate-900">
                      {refund.orderReference ?? refund.orderId}
                    </td>
                    <td className="py-2 font-bold text-slate-900">
                      {refund.student?.fullName ?? "—"}
                    </td>
                    <td className="py-2">
                      {formatSantim(refund.amountSantim)}
                    </td>
                    <td className="py-2">
                      <Badge variant={STATUS_BADGE[refund.status] ?? "slate"}>
                        {statusLabel(refund.status)}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <Badge
                        variant={refund.providerCapable ? "emerald" : "amber"}
                      >
                        {refund.providerCapable ? "Automated" : "Manual"}
                      </Badge>
                    </td>
                    <td className="py-2 max-w -[220px] ">{refund.reason}</td>
                    <td className="py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {["requested", "approved"].includes(refund.status) ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void settleRefund(refund, "processed")
                            }
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            Mark processed
                          </button>
                        ) : null}
                        {["requested", "approved"].includes(refund.status) ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void settleRefund(refund, "rejected")
                            }
                            className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      <Modal
        title="Record a refund"
        isOpen={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
      >
        {refundTarget ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/70">
              <p>
                <span className="font-bold text-slate-900">Order:</span>{" "}
                {refundTarget.order.reference}
              </p>
              <p>
                <span className="font-bold text-slate-900">Student:</span>{" "}
                {refundTarget.student?.fullName} ({refundTarget.student?.email})
              </p>
              <p>
                <span className="font-bold text-slate-900">Paid:</span>{" "}
                {formatSantim(refundTarget.amountSantim)} via{" "}
                {refundTarget.provider}
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="refund-amount">
                Refund amount ({refundTarget.currency})
              </label>
              <input
                id="refund-amount"
                className={inputClass}
                value={refundForm.amount}
                onChange={(event) =>
                  setRefundForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="refund-reason">
                Reason
              </label>
              <textarea
                id="refund-reason"
                rows={3}
                className={inputClass}
                value={refundForm.reason}
                onChange={(event) =>
                  setRefundForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                placeholder="Why is this payment being refunded?"
              />
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              Refunds are recorded as a request first. Marking it processed
              revokes the granted access and, where the gateway supports it,
              triggers the provider-side refund.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-600 ring-1 ring-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitRefund()}
                disabled={isBusy}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isBusy ? "Saving…" : "Record refund"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
