import React from "react";

export function SectionHeading({ title, subtitle, badge, centered = false }) {
    return (
        <div className={`mb-10 ${centered ? "text-center max-w-3xl mx-auto" : ""}`}>
            {badge ? (
                <div className="public-heading-badge inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-extrabold mb-3 tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                    <span>{badge}</span>
                </div>
            ) : null}
            <h2 className="public-heading text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[var(--text-main)] leading-tight">
                {title}
            </h2>
            {subtitle ? (
                <p className="mt-3 text-sm sm:text-base text-slate-500 leading-relaxed font-normal max-w-2xl">
                    {subtitle}
                </p>
            ) : null}
        </div>
    );
}

export function MetricCard({ label, value, subtext, icon, trend }) {
    return (
        <div className="group relative overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)] ring-1 ring-[var(--surface-border)] hover:shadow-[var(--shadow-md)] hover:ring-[var(--tlh-blue-primary)]/40 transition-all duration-300">
            {/* Top accent bar matching logo gradient */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--tlh-blue-primary)] via-[var(--tlh-cyan)] to-[var(--tlh-orange)] opacity-0 group-hover:opacity-100 transition-opacity rounded-t-[var(--radius-2xl)]" />
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
                {icon ? (
                    <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--surface-muted)] text-xl group-hover:scale-110 group-hover:bg-[var(--tlh-blue-primary)]/10 group-hover:text-[var(--tlh-blue-primary)] transition-all">
                        {icon}
                    </div>
                ) : null}
            </div>
            <div className="mt-4 flex items-baseline gap-2">
                <p className="text-3xl sm:text-4xl font-black tracking-tight text-[var(--text-main)]">{value}</p>
                {trend ? (
                    <span className="rounded-full bg-[var(--tlh-blue-primary)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--tlh-blue-primary)] ring-1 ring-[var(--tlh-blue-primary)]/20">
                        {trend}
                    </span>
                ) : null}
            </div>
            {subtext ? <p className="mt-2 text-xs text-[var(--text-secondary)] font-medium">{subtext}</p> : null}
            {/* Bottom accent line */}
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--tlh-blue-primary)]/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}

export function DashboardCard({ title, subtitle, action, children }) {
    return (
        <div className="overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--surface-border)] transition-all hover:shadow-[var(--shadow-md)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--surface-border)] bg-gradient-to-r from-[var(--surface-muted)] to-[var(--surface-card)] px-6 py-5">
                <div>
                    <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] tracking-tight">{title}</h3>
                    {subtitle ? <p className="mt-0.5 text-xs text-[var(--text-secondary)] font-medium">{subtitle}</p> : null}
                </div>
                {action ? <div>{action}</div> : null}
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

export function EmptyState({ title = "No records found", description = "There are currently no items to display in this section." }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-2xl)] border-2 border-dashed border-[var(--surface-border)] py-14 px-4 text-center bg-[var(--surface-muted)]/30">
            <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--surface-border)] text-slate-300 text-3xl">
                📁
            </div>
            <p className="mt-5 text-base font-bold text-[var(--text-main)]">{title}</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-sm leading-relaxed">{description}</p>
        </div>
    );
}

export function Badge({ variant = "slate", children }) {
    const styles = {
        emerald: "bg-[var(--tlh-blue-primary)]/10 text-[var(--tlh-blue-primary)] ring-[var(--tlh-blue-primary)]/20",
        amber:   "bg-[var(--tlh-orange)]/10 text-[var(--tlh-orange)] ring-[var(--tlh-orange)]/20",
        rose:    "bg-rose-50 text-rose-700 ring-rose-600/20",
        cyan:    "bg-[var(--tlh-cyan)]/10 text-[var(--tlh-cyan)] ring-[var(--tlh-cyan)]/20",
        indigo:  "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
        blue:    "bg-[var(--tlh-blue-primary)]/10 text-[var(--tlh-blue-primary)] ring-[var(--tlh-blue-primary)]/20",
        slate:   "bg-[var(--surface-muted)] text-[var(--text-secondary)] ring-[var(--surface-border)]",
    };
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${styles[variant]}`}>
            {children}
        </span>
    );
}

export function Modal({ title, isOpen, onClose, children }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--tlh-navy)]/65 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg rounded-[var(--radius-2xl)] bg-[var(--surface-card)] p-6 sm:p-8 shadow-[var(--shadow-lg)] ring-1 ring-[var(--surface-border)]">
                <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-4">
                    <h3 className="text-lg font-bold text-[var(--text-main)] tracking-tight">{title}</h3>
                    <button
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        type="button"
                        aria-label="Close modal"
                    >
                        ✕
                    </button>
                </div>
                <div className="mt-6">{children}</div>
            </div>
        </div>
    );
}

/** Utility for localized number formatting */
export function formatNumber(value) {
    return Number(value ?? 0).toLocaleString();
}

/** Dependency-free column chart. Each point is { key, value }. */
export function AnalyticsColumnChart({
    points,
    height = 160,
    emptyLabel = "No data in this window.",
}) {
    if (!points || points.length === 0) {
        return (
            <p className="py-8 text-center text-xs font-medium text-slate-400">
                {emptyLabel}
            </p>
        );
    }
    const max = Math.max(1, ...points.map((point) => point.value));
    return (
        <div>
            <div className="flex items-end gap-[2px]" style={{ height }}>
                {points.map((point, index) => (
                    <div
                        key={`${point.key}-${index}`}
                        title={`${point.key}: ${formatNumber(point.value)}`}
                        className="min-h-[2px] flex-1 rounded-t bg-gradient-to-t from-[var(--tlh-blue-primary)] to-[var(--tlh-cyan)] transition-all hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)]"
                        style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
                    />
                ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>{points[0]?.key}</span>
                <span>peak {formatNumber(max)}</span>
                <span>{points[points.length - 1]?.key}</span>
            </div>
        </div>
    );
}

/** Compact table used for data listing and analytics drill-downs. */
export function AnalyticsTable({
    columns,
    rows,
    emptyLabel = "No data to display.",
}) {
    if (!rows || rows.length === 0) {
        return (
            <p className="py-8 text-center text-xs font-medium text-slate-400">
                {emptyLabel}
            </p>
        );
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
                <thead>
                    <tr className="border-b border-slate-100">
                        {columns.map((column) => (
                            <th
                                key={column.key}
                                className={`whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${column.align ?? "text-left"}`}
                            >
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {rows.map((row, index) => (
                        <tr
                            key={row.id ?? index}
                            className="transition-colors hover:bg-slate-50/70"
                        >
                            {columns.map((column) => (
                                <td
                                    key={column.key}
                                    className={`px-3 py-2.5 ${column.align ?? "text-left"} ${column.className ?? "font-medium text-slate-700"}`}
                                >
                                    {column.render ? column.render(row) : row[column.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
