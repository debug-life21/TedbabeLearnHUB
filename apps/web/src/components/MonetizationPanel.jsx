import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";
import { PLATFORM_CURRENCY, formatSantim, toMajorUnits, toSantim } from "../lib/money";
import { Badge, DashboardCard, EmptyState, MetricCard, Modal } from "./UIComponents";

const PLAN_KINDS = [
    { value: "package", label: "Premium learning package" },
    { value: "tutoring", label: "Private tutoring" },
    { value: "live_class", label: "Paid live class" },
    { value: "resource", label: "Digital learning resource" },
    { value: "certificate", label: "Paid certificate" },
    { value: "subscription", label: "Subscription" },
];

const PLAN_INTERVALS = [
    { value: "none", label: "One-time purchase" },
    { value: "month", label: "Monthly" },
    { value: "quarter", label: "Quarterly" },
    { value: "year", label: "Annual" },
];

const SUBSCRIPTION_STATUSES = ["pending", "active", "grace_period", "expired", "cancelled"];

const inputClass = "w-full rounded-xl border border-slate-200 p-2.5 text-sm";
const labelClass = "block text-xs font-bold text-slate-700";

function kindLabel(kind) {
    return PLAN_KINDS.find((entry) => entry.value === kind)?.label ?? kind;
}

function intervalLabel(interval) {
    return PLAN_INTERVALS.find((entry) => entry.value === interval)?.label ?? interval;
}

/** ISO string → value for a datetime-local input. */
function toDateTimeLocal(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** datetime-local value → ISO string (or null). */
function fromDateTimeLocal(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const emptyPlanForm = {
    id: "",
    code: "",
    name: "",
    kind: "package",
    description: "",
    price: "0.00",
    interval: "none",
    gracePeriodDays: 0,
    benefits: "",
    sessionCount: 0,
    certificateEligible: false,
    courseIds: [],
    isActive: true,
};

const emptyPromotionForm = {
    id: "",
    code: "",
    name: "",
    description: "",
    discountType: "percent",
    discountValue: "0",
    scope: "all",
    courseIds: [],
    planIds: [],
    startsAt: "",
    endsAt: "",
    maxRedemptions: 0,
    perStudentLimit: 1,
    isActive: true,
};

/**
 * Monetization administration (Module 2): sellable plans, course pricing and
 * promotional campaigns. Every figure shown comes from the API; nothing is
 * hard-coded or simulated.
 */
export function MonetizationPanel() {
    const [section, setSection] = useState("plans");
    const [overview, setOverview] = useState(null);
    const [plans, setPlans] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [courses, setCourses] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [courseSearch, setCourseSearch] = useState("");
    const [pricingDrafts, setPricingDrafts] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [busyId, setBusyId] = useState("");
    const [feedback, setFeedback] = useState("");
    const [error, setError] = useState("");
    const [planForm, setPlanForm] = useState(emptyPlanForm);
    const [promotionForm, setPromotionForm] = useState(emptyPromotionForm);
    const [planModalOpen, setPlanModalOpen] = useState(false);
    const [promotionModalOpen, setPromotionModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const [overviewRes, plansRes, promotionsRes, coursesRes, subscriptionsRes] = await Promise.all([
                apiRequest("/api/admin/monetization/overview"),
                apiRequest("/api/admin/monetization/plans"),
                apiRequest("/api/admin/monetization/promotions"),
                apiRequest("/api/admin/courses"),
                apiRequest("/api/admin/monetization/subscriptions?limit=100"),
            ]);
            setOverview(overviewRes);
            setPlans(plansRes.plans || []);
            setPromotions(promotionsRes.promotions || []);
            setCourses(coursesRes.courses || []);
            setSubscriptions(subscriptionsRes.subscriptions || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to load monetization data.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const filteredCourses = useMemo(() => {
        const term = courseSearch.trim().toLowerCase();
        if (!term) return courses;
        return courses.filter((course) =>
            course.title?.toLowerCase().includes(term)
            || course.category?.name?.toLowerCase().includes(term));
    }, [courses, courseSearch]);

    const openPlanModal = (plan) => {
        setPlanForm(plan ? {
            id: plan._id,
            code: plan.code,
            name: plan.name,
            kind: plan.kind,
            description: plan.description ?? "",
            price: toMajorUnits(plan.priceSantim),
            interval: plan.interval ?? "none",
            gracePeriodDays: plan.gracePeriodDays ?? 0,
            benefits: (plan.benefits ?? []).join("\n"),
            sessionCount: plan.sessionCount ?? 0,
            certificateEligible: Boolean(plan.certificateEligible),
            courseIds: (plan.courseIds ?? []).map((course) => course._id ?? course),
            isActive: Boolean(plan.isActive),
        } : emptyPlanForm);
        setPlanModalOpen(true);
    };

    const openPromotionModal = (promotion) => {
        setPromotionForm(promotion ? {
            id: promotion._id,
            code: promotion.code,
            name: promotion.name,
            description: promotion.description ?? "",
            discountType: promotion.discountType,
            discountValue: promotion.discountType === "fixed" ? toMajorUnits(promotion.discountValue) : String(promotion.discountValue),
            scope: promotion.scope ?? "all",
            courseIds: (promotion.courseIds ?? []).map((course) => course._id ?? course),
            planIds: (promotion.planIds ?? []).map((plan) => plan._id ?? plan),
            startsAt: toDateTimeLocal(promotion.startsAt),
            endsAt: toDateTimeLocal(promotion.endsAt),
            maxRedemptions: promotion.maxRedemptions ?? 0,
            perStudentLimit: promotion.perStudentLimit ?? 1,
            isActive: Boolean(promotion.isActive),
        } : emptyPromotionForm);
        setPromotionModalOpen(true);
    };

    const handleSavePlan = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setError("");
        try {
            const priceSantim = toSantim(planForm.price);
            if (priceSantim === null) {
                throw new Error("Enter a valid non-negative price.");
            }
            const payload = {
                code: planForm.code.trim().toUpperCase(),
                name: planForm.name.trim(),
                kind: planForm.kind,
                description: planForm.description,
                priceSantim,
                currency: PLATFORM_CURRENCY,
                interval: planForm.kind === "subscription" ? planForm.interval : "none",
                gracePeriodDays: Number(planForm.gracePeriodDays) || 0,
                benefits: planForm.benefits.split("\n").map((line) => line.trim()).filter(Boolean),
                sessionCount: Number(planForm.sessionCount) || 0,
                certificateEligible: planForm.certificateEligible,
                courseIds: planForm.courseIds,
                isActive: planForm.isActive,
            };
            if (planForm.id) {
                await apiRequest(`/api/admin/monetization/plans/${planForm.id}`, { method: "PATCH", body: JSON.stringify(payload) });
                setFeedback(`Plan ${payload.code} updated.`);
            } else {
                await apiRequest("/api/admin/monetization/plans", { method: "POST", body: JSON.stringify(payload) });
                setFeedback(`Plan ${payload.code} created.`);
            }
            setPlanModalOpen(false);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save the plan.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSavePromotion = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setError("");
        try {
            const discountValue = promotionForm.discountType === "percent"
                ? Number(promotionForm.discountValue)
                : toSantim(promotionForm.discountValue);
            if (discountValue === null || !Number.isFinite(discountValue)) {
                throw new Error("Enter a valid discount value.");
            }
            const payload = {
                code: promotionForm.code.trim().toUpperCase(),
                name: promotionForm.name.trim(),
                description: promotionForm.description,
                discountType: promotionForm.discountType,
                discountValue: Math.round(discountValue),
                currency: PLATFORM_CURRENCY,
                scope: promotionForm.scope,
                courseIds: promotionForm.scope === "courses" ? promotionForm.courseIds : [],
                planIds: promotionForm.scope === "plans" ? promotionForm.planIds : [],
                startsAt: fromDateTimeLocal(promotionForm.startsAt),
                endsAt: fromDateTimeLocal(promotionForm.endsAt),
                maxRedemptions: Number(promotionForm.maxRedemptions) || 0,
                perStudentLimit: Number(promotionForm.perStudentLimit) || 1,
                isActive: promotionForm.isActive,
            };
            if (promotionForm.id) {
                await apiRequest(`/api/admin/monetization/promotions/${promotionForm.id}`, { method: "PATCH", body: JSON.stringify(payload) });
                setFeedback(`Promotion ${payload.code} updated.`);
            } else {
                await apiRequest("/api/admin/monetization/promotions", { method: "POST", body: JSON.stringify(payload) });
                setFeedback(`Promotion ${payload.code} created.`);
            }
            setPromotionModalOpen(false);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save the promotion.");
        } finally {
            setIsSaving(false);
        }
    };

    const togglePlanActive = async (plan) => {
        setBusyId(plan._id);
        setError("");
        try {
            await apiRequest(`/api/admin/monetization/plans/${plan._id}`, {
                method: "PATCH",
                body: JSON.stringify({ isActive: !plan.isActive }),
            });
            setFeedback(`Plan ${plan.code} ${plan.isActive ? "deactivated" : "activated"}.`);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update the plan.");
        } finally {
            setBusyId("");
        }
    };

    const togglePromotionActive = async (promotion) => {
        setBusyId(promotion._id);
        setError("");
        try {
            await apiRequest(`/api/admin/monetization/promotions/${promotion._id}`, {
                method: "PATCH",
                body: JSON.stringify({ isActive: !promotion.isActive }),
            });
            setFeedback(`Promotion ${promotion.code} ${promotion.isActive ? "deactivated" : "activated"}.`);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update the promotion.");
        } finally {
            setBusyId("");
        }
    };

    const deletePlan = async (plan) => {
        setBusyId(plan._id);
        setError("");
        try {
            await apiRequest(`/api/admin/monetization/plans/${plan._id}`, { method: "DELETE" });
            setFeedback(`Plan ${plan.code} deleted.`);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not delete the plan.");
        } finally {
            setBusyId("");
        }
    };

    const deletePromotion = async (promotion) => {
        setBusyId(promotion._id);
        setError("");
        try {
            await apiRequest(`/api/admin/monetization/promotions/${promotion._id}`, { method: "DELETE" });
            setFeedback(`Promotion ${promotion.code} deleted.`);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not delete the promotion.");
        } finally {
            setBusyId("");
        }
    };

    const draftFor = (course) => pricingDrafts[course._id] ?? {
        isFree: course.isFree !== false,
        price: toMajorUnits(course.priceSantim ?? 0),
    };

    const updateDraft = (course, patch) => {
        setPricingDrafts((drafts) => ({ ...drafts, [course._id]: { ...draftFor(course), ...patch } }));
    };

    const savePricing = async (course) => {
        const draft = draftFor(course);
        setBusyId(course._id);
        setError("");
        try {
            const priceSantim = draft.isFree ? 0 : toSantim(draft.price);
            if (priceSantim === null) {
                throw new Error("Enter a valid price.");
            }
            await apiRequest(`/api/admin/monetization/courses/${course._id}/pricing`, {
                method: "PATCH",
                body: JSON.stringify({ isFree: draft.isFree, priceSantim, currency: PLATFORM_CURRENCY }),
            });
            setPricingDrafts((drafts) => {
                const next = { ...drafts };
                delete next[course._id];
                return next;
            });
            setFeedback(`${course.title} is now ${draft.isFree ? "free" : `priced at ${formatSantim(priceSantim)}`}.`);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update the course price.");
        } finally {
            setBusyId("");
        }
    };

    if (isLoading && !overview) {
        return (
            <div role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                Loading monetization settings…
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {error ? (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div>
            ) : null}
            {feedback ? (
                <div className="flex items-center justify-between rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-900 ring-1 ring-blue-200">
                    <span>{feedback}</span>
                    <button onClick={() => setFeedback("")} className="text-blue-500 hover:text-blue-800" type="button">✕</button>
                </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Active plans" value={overview?.plans?.active ?? 0} icon="🧩" />
                <MetricCard label="Paid programmes" value={overview?.courses?.paid ?? 0} subtext={`${overview?.courses?.free ?? 0} free`} icon="💳" />
                <MetricCard label="Active promotions" value={overview?.promotions?.active ?? 0} icon="🏷️" />
                <MetricCard label="Active subscriptions" value={overview?.subscriptions?.active ?? 0} icon="🔁" />
            </div>

            <div className="flex flex-wrap gap-2">
                {[
                    { id: "plans", label: `Plans (${plans.length})` },
                    { id: "pricing", label: "Course pricing" },
                    { id: "promotions", label: `Promotions (${promotions.length})` },
                    { id: "subscriptions", label: `Subscriptions (${subscriptions.length})` },
                ].map((entry) => (
                    <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSection(entry.id)}
                        className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                            section === entry.id
                                ? "bg-gradient-to-r from-[#0066ff] to-[#0099ff] text-white shadow-sm"
                                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                    >
                        {entry.label}
                    </button>
                ))}
            </div>

            {section === "plans" ? (
                <DashboardCard
                    title="Monetization plans"
                    subtitle="Packages, tutoring, live classes, resources, certificates and subscriptions."
                    action={
                        <button onClick={() => openPlanModal(null)} type="button" className="rounded-full bg-gradient-to-r from-[#0066ff] to-[#0099ff] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm">
                            + New plan
                        </button>
                    }
                >
                    {plans.length === 0 ? (
                        <EmptyState title="No plans yet." description="Create a plan to sell packages, tutoring, live classes or subscriptions." />
                    ) : (
                        <div className="space-y-3">
                            {plans.map((plan) => (
                                <div key={plan._id} className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-slate-900">{plan.name}</span>
                                            <Badge variant={plan.isActive ? "emerald" : "slate"}>{plan.isActive ? "Active" : "Inactive"}</Badge>
                                            <Badge variant="indigo">{kindLabel(plan.kind)}</Badge>
                                            {plan.interval && plan.interval !== "none" ? <Badge variant="cyan">{intervalLabel(plan.interval)}</Badge> : null}
                                        </div>
                                        <p className="mt-1 font-mono text-[11px] text-slate-500">{plan.code}</p>
                                        {plan.description ? <p className="mt-1 text-xs text-slate-600">{plan.description}</p> : null}
                                        {plan.benefits?.length ? (
                                            <p className="mt-1 text-xs text-slate-500">Benefits: {plan.benefits.join(" · ")}</p>
                                        ) : null}
                                        <p className="mt-1 text-xs text-slate-400">
                                            {plan.courseIds?.length ? `${plan.courseIds.length} bundled course(s)` : "No bundled courses"}
                                            {plan.gracePeriodDays ? ` · ${plan.gracePeriodDays}-day grace period` : ""}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="text-lg font-black text-slate-900">{formatSantim(plan.priceSantim ?? 0, plan.currency)}</span>
                                        <div className="flex flex-wrap gap-2">
                                            <button type="button" onClick={() => openPlanModal(plan)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200">Edit</button>
                                            <button type="button" disabled={busyId === plan._id} onClick={() => void togglePlanActive(plan)} className="rounded-lg bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-sky-100 disabled:opacity-50">
                                                {plan.isActive ? "Deactivate" : "Activate"}
                                            </button>
                                            <button type="button" disabled={busyId === plan._id} onClick={() => void deletePlan(plan)} className="rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">Delete</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </DashboardCard>
            ) : null}

            {section === "pricing" ? (
                <DashboardCard
                    title="Course pricing"
                    subtitle="Free courses keep the existing free-registration workflow; paid courses require a verified payment."
                    action={
                        <input
                            value={courseSearch}
                            onChange={(event) => setCourseSearch(event.target.value)}
                            placeholder="Search programmes…"
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                        />
                    }
                >
                    {filteredCourses.length === 0 ? (
                        <EmptyState title="No programmes match your search." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        <th className="px-3 py-2">Programme</th>
                                        <th className="px-3 py-2">Access</th>
                                        <th className="px-3 py-2">Price (ETB)</th>
                                        <th className="px-3 py-2 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredCourses.slice(0, 100).map((course) => {
                                        const draft = draftFor(course);
                                        const dirty = Boolean(pricingDrafts[course._id]);
                                        return (
                                            <tr key={course._id} className="hover:bg-slate-50/70">
                                                <td className="px-3 py-2.5">
                                                    <p className="font-bold text-slate-900">{course.title}</p>
                                                    <p className="text-[10px] text-slate-400">{course.category?.name ?? "Uncategorised"}</p>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <select
                                                        value={draft.isFree ? "free" : "paid"}
                                                        onChange={(event) => updateDraft(course, { isFree: event.target.value === "free" })}
                                                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                                    >
                                                        <option value="free">Free</option>
                                                        <option value="paid">Paid</option>
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        disabled={draft.isFree}
                                                        value={draft.isFree ? "0.00" : draft.price}
                                                        onChange={(event) => updateDraft(course, { price: event.target.value })}
                                                        className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-100 disabled:text-slate-400"
                                                    />
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    <button
                                                        type="button"
                                                        disabled={!dirty || busyId === course._id}
                                                        onClick={() => void savePricing(course)}
                                                        className="rounded-lg bg-gradient-to-r from-[#0066ff] to-[#0099ff] px-3 py-1.5 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        {busyId === course._id ? "Saving…" : "Save"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filteredCourses.length > 100 ? (
                                <p className="mt-3 text-center text-[11px] font-medium text-slate-400">
                                    Showing the first 100 of {filteredCourses.length} programmes. Refine your search to see more.
                                </p>
                            ) : null}
                        </div>
                    )}
                </DashboardCard>
            ) : null}

            {section === "promotions" ? (
                <DashboardCard
                    title="Promotional campaigns"
                    subtitle="Discount codes applied at checkout. Redemption counts are enforced by the server."
                    action={
                        <button onClick={() => openPromotionModal(null)} type="button" className="rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm">
                            + New promotion
                        </button>
                    }
                >
                    {promotions.length === 0 ? (
                        <EmptyState title="No promotions yet." description="Create a discount code to run a promotional campaign." />
                    ) : (
                        <div className="space-y-3">
                            {promotions.map((promotion) => (
                                <div key={promotion._id} className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-slate-900">{promotion.name}</span>
                                            <Badge variant={promotion.isRedeemableNow ? "emerald" : "slate"}>
                                                {promotion.isRedeemableNow ? "Redeemable" : promotion.isActive ? "Outside window" : "Inactive"}
                                            </Badge>
                                            <Badge variant="amber">
                                                {promotion.discountType === "percent"
                                                    ? `${promotion.discountValue}% off`
                                                    : `${formatSantim(promotion.discountValue, promotion.currency)} off`}
                                            </Badge>
                                            <Badge variant="indigo">Scope: {promotion.scope}</Badge>
                                        </div>
                                        <p className="mt-1 font-mono text-[11px] text-slate-500">{promotion.code}</p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            {promotion.startsAt ? `From ${new Date(promotion.startsAt).toLocaleDateString()}` : "No start date"}
                                            {" · "}
                                            {promotion.endsAt ? `Until ${new Date(promotion.endsAt).toLocaleDateString()}` : "No end date"}
                                            {" · "}
                                            {promotion.maxRedemptions > 0 ? `${promotion.redemptionCount}/${promotion.maxRedemptions} redeemed` : `${promotion.redemptionCount} redeemed`}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" onClick={() => openPromotionModal(promotion)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200">Edit</button>
                                        <button type="button" disabled={busyId === promotion._id} onClick={() => void togglePromotionActive(promotion)} className="rounded-lg bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-sky-100 disabled:opacity-50">
                                            {promotion.isActive ? "Deactivate" : "Activate"}
                                        </button>
                                        <button type="button" disabled={busyId === promotion._id} onClick={() => void deletePromotion(promotion)} className="rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </DashboardCard>
            ) : null}

            {section === "subscriptions" ? (
                <DashboardCard title="Student subscriptions" subtitle="Recurring plans purchased by learners. Renewal reminders are issued by the platform.">
                    {subscriptions.length === 0 ? (
                        <EmptyState title="No subscriptions yet." description="Subscriptions appear here once a learner purchases a recurring plan." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        <th className="px-3 py-2">Learner</th>
                                        <th className="px-3 py-2">Plan</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2">Current period ends</th>
                                        <th className="px-3 py-2 text-right">Renewals</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {subscriptions.map((subscription) => (
                                        <tr key={subscription._id} className="hover:bg-slate-50/70">
                                            <td className="px-3 py-2.5">
                                                <p className="font-bold text-slate-900">{subscription.student?.fullName || subscription.student?.name || "—"}</p>
                                                <p className="text-[10px] text-slate-400">{subscription.student?.email}</p>
                                            </td>
                                            <td className="px-3 py-2.5">{subscription.plan?.name ?? "—"}<p className="text-[10px] text-slate-400">{subscription.plan?.code}</p></td>
                                            <td className="px-3 py-2.5"><Badge variant={subscription.status === "active" ? "emerald" : "slate"}>{subscription.status}</Badge></td>
                                            <td className="px-3 py-2.5">{subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "—"}</td>
                                            <td className="px-3 py-2.5 text-right">{subscription.renewalCount ?? 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </DashboardCard>
            ) : null}

            <Modal title={planForm.id ? "Edit plan" : "New monetization plan"} isOpen={planModalOpen} onClose={() => setPlanModalOpen(false)}>
                <form onSubmit={handleSavePlan} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className={labelClass}>Code
                            <input required value={planForm.code} onChange={(event) => setPlanForm({ ...planForm, code: event.target.value.toUpperCase() })} className={`mt-1 ${inputClass}`} placeholder="PREMIUM_MONTHLY" />
                        </label>
                        <label className={labelClass}>Name
                            <input required value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} className={`mt-1 ${inputClass}`} />
                        </label>
                        <label className={labelClass}>Kind
                            <select value={planForm.kind} onChange={(event) => setPlanForm({ ...planForm, kind: event.target.value })} className={`mt-1 ${inputClass}`}>
                                {PLAN_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                            </select>
                        </label>
                        <label className={labelClass}>Price (ETB)
                            <input required type="number" min="0" step="0.01" value={planForm.price} onChange={(event) => setPlanForm({ ...planForm, price: event.target.value })} className={`mt-1 ${inputClass}`} />
                        </label>
                        {planForm.kind === "subscription" ? (
                            <>
                                <label className={labelClass}>Billing interval
                                    <select value={planForm.interval === "none" ? "month" : planForm.interval} onChange={(event) => setPlanForm({ ...planForm, interval: event.target.value })} className={`mt-1 ${inputClass}`}>
                                        {PLAN_INTERVALS.filter((entry) => entry.value !== "none").map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                                    </select>
                                </label>
                                <label className={labelClass}>Grace period (days)
                                    <input type="number" min="0" max="365" value={planForm.gracePeriodDays} onChange={(event) => setPlanForm({ ...planForm, gracePeriodDays: event.target.value })} className={`mt-1 ${inputClass}`} />
                                </label>
                            </>
                        ) : null}
                        {planForm.kind === "tutoring" || planForm.kind === "live_class" ? (
                            <label className={labelClass}>Included sessions
                                <input type="number" min="0" value={planForm.sessionCount} onChange={(event) => setPlanForm({ ...planForm, sessionCount: event.target.value })} className={`mt-1 ${inputClass}`} />
                            </label>
                        ) : null}
                    </div>
                    <label className={labelClass}>Description
                        <textarea rows={2} value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} className={`mt-1 ${inputClass}`} />
                    </label>
                    <label className={labelClass}>Benefits (one per line)
                        <textarea rows={3} value={planForm.benefits} onChange={(event) => setPlanForm({ ...planForm, benefits: event.target.value })} className={`mt-1 ${inputClass}`} placeholder={"Unlimited access to all courses\nPriority tutor support"} />
                    </label>
                    <div>
                        <p className={labelClass}>Bundled programmes</p>
                        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3">
                            {courses.map((course) => (
                                <label key={course._id} className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={planForm.courseIds.includes(course._id)}
                                        onChange={(event) => setPlanForm({
                                            ...planForm,
                                            courseIds: event.target.checked
                                                ? [...planForm.courseIds, course._id]
                                                : planForm.courseIds.filter((id) => id !== course._id),
                                        })}
                                    />
                                    {course.title}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <input type="checkbox" checked={planForm.certificateEligible} onChange={(event) => setPlanForm({ ...planForm, certificateEligible: event.target.checked })} />
                            Certificate eligible
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <input type="checkbox" checked={planForm.isActive} onChange={(event) => setPlanForm({ ...planForm, isActive: event.target.checked })} />
                            Active
                        </label>
                    </div>
                    <button type="submit" disabled={isSaving} className="w-full rounded-xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] py-2.5 text-xs font-bold text-white disabled:opacity-60">
                        {isSaving ? "Saving…" : planForm.id ? "Save plan" : "Create plan"}
                    </button>
                </form>
            </Modal>

            <Modal title={promotionForm.id ? "Edit promotion" : "New promotion"} isOpen={promotionModalOpen} onClose={() => setPromotionModalOpen(false)}>
                <form onSubmit={handleSavePromotion} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className={labelClass}>Code
                            <input required value={promotionForm.code} onChange={(event) => setPromotionForm({ ...promotionForm, code: event.target.value.toUpperCase() })} className={`mt-1 ${inputClass}`} placeholder="LAUNCH10" />
                        </label>
                        <label className={labelClass}>Name
                            <input required value={promotionForm.name} onChange={(event) => setPromotionForm({ ...promotionForm, name: event.target.value })} className={`mt-1 ${inputClass}`} />
                        </label>
                        <label className={labelClass}>Discount type
                            <select
                                value={promotionForm.discountType}
                                onChange={(event) => setPromotionForm({ ...promotionForm, discountType: event.target.value, discountValue: "0" })}
                                className={`mt-1 ${inputClass}`}
                            >
                                <option value="percent">Percentage</option>
                                <option value="fixed">Fixed amount</option>
                            </select>
                        </label>
                        <label className={labelClass}>
                            {promotionForm.discountType === "percent" ? "Discount (%)" : "Discount (ETB)"}
                            <input required type="number" min="0" step={promotionForm.discountType === "percent" ? "1" : "0.01"} value={promotionForm.discountValue} onChange={(event) => setPromotionForm({ ...promotionForm, discountValue: event.target.value })} className={`mt-1 ${inputClass}`} />
                        </label>
                        <label className={labelClass}>Applies to
                            <select value={promotionForm.scope} onChange={(event) => setPromotionForm({ ...promotionForm, scope: event.target.value })} className={`mt-1 ${inputClass}`}>
                                <option value="all">Everything</option>
                                <option value="courses">Selected programmes</option>
                                <option value="plans">Selected plans</option>
                            </select>
                        </label>
                        <label className={labelClass}>Max redemptions (0 = unlimited)
                            <input type="number" min="0" value={promotionForm.maxRedemptions} onChange={(event) => setPromotionForm({ ...promotionForm, maxRedemptions: event.target.value })} className={`mt-1 ${inputClass}`} />
                        </label>
                        <label className={labelClass}>Starts at
                            <input type="datetime-local" value={promotionForm.startsAt} onChange={(event) => setPromotionForm({ ...promotionForm, startsAt: event.target.value })} className={`mt-1 ${inputClass}`} />
                        </label>
                        <label className={labelClass}>Ends at
                            <input type="datetime-local" value={promotionForm.endsAt} onChange={(event) => setPromotionForm({ ...promotionForm, endsAt: event.target.value })} className={`mt-1 ${inputClass}`} />
                        </label>
                    </div>
                    {promotionForm.scope === "courses" ? (
                        <div>
                            <p className={labelClass}>Programmes</p>
                            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3">
                                {courses.map((course) => (
                                    <label key={course._id} className="flex items-center gap-2 text-xs text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={promotionForm.courseIds.includes(course._id)}
                                            onChange={(event) => setPromotionForm({
                                                ...promotionForm,
                                                courseIds: event.target.checked
                                                    ? [...promotionForm.courseIds, course._id]
                                                    : promotionForm.courseIds.filter((id) => id !== course._id),
                                            })}
                                        />
                                        {course.title}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    {promotionForm.scope === "plans" ? (
                        <div>
                            <p className={labelClass}>Plans</p>
                            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3">
                                {plans.map((plan) => (
                                    <label key={plan._id} className="flex items-center gap-2 text-xs text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={promotionForm.planIds.includes(plan._id)}
                                            onChange={(event) => setPromotionForm({
                                                ...promotionForm,
                                                planIds: event.target.checked
                                                    ? [...promotionForm.planIds, plan._id]
                                                    : promotionForm.planIds.filter((id) => id !== plan._id),
                                            })}
                                        />
                                        {plan.name} ({plan.code})
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <input type="checkbox" checked={promotionForm.isActive} onChange={(event) => setPromotionForm({ ...promotionForm, isActive: event.target.checked })} />
                        Active
                    </label>
                    <button type="submit" disabled={isSaving} className="w-full rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] py-2.5 text-xs font-bold text-white disabled:opacity-60">
                        {isSaving ? "Saving…" : promotionForm.id ? "Save promotion" : "Create promotion"}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
