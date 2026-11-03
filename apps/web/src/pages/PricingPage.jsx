import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function PricingPage() {
  const { t } = useTranslation();
  const plans = [
    {
      name: t("pricingExploreTitle"),
      price: t("pricingExplorePrice"),
      period: t("pricingExplorePeriod"),
      description: t("pricingExploreDescription"),
      highlight: false,
      features: [
        t("pricingExploreFeature1"),
        t("pricingExploreFeature2"),
        t("pricingExploreFeature3"),
        t("pricingExploreFeature4"),
      ],
      buttonText: t("pricingExploreButton"),
      buttonLink: "/courses",
      buttonStyle: "bg-slate-900 text-white hover:bg-slate-800 shadow-sm",
    },
    {
      name: t("pricingCohortTitle"),
      price: t("pricingCohortPrice"),
      period: t("pricingCohortPeriod"),
      description: t("pricingCohortDescription"),
      highlight: true,
      features: [
        t("pricingCohortFeature1"),
        t("pricingCohortFeature2"),
        t("pricingCohortFeature3"),
        t("pricingCohortFeature4"),
      ],
      buttonText: t("pricingCohortButton"),
      buttonLink: "/register/student",
      buttonStyle:
        "bg-gradient-to-r from-[#0066ff] to-[#0099ff] text-white hover:from-[#0052cc] hover:to-[#0088e6] shadow-md shadow-blue-500/25",
    },
    {
      name: t("pricingPlanTitle"),
      price: t("pricingPlanPrice"),
      period: t("pricingPlanPeriod"),
      description: t("pricingPlanDescription"),
      highlight: false,
      features: [
        t("pricingPlanFeature1"),
        t("pricingPlanFeature2"),
        t("pricingPlanFeature3"),
        t("pricingPlanFeature4"),
      ],
      buttonText: t("pricingPlanButton"),
      buttonLink: "/register/student",
      buttonStyle: "bg-slate-900 text-white hover:bg-slate-800 shadow-sm",
    },
  ];

  return (
    <div className="editorial-page min-h-screen pb-24">
      {/* Header Hero */}
      <div className="editorial-hero border-b border-slate-200/80 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <span className="editorial-kicker text-blue-600 font-extrabold tracking-widest">
            {t("pricingKicker")}
          </span>
          <h1 className="editorial-display mt-3 text-4xl font-extrabold text-slate-900 sm:text-5xl">
            {t("pricingTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base text-slate-600 sm:text-lg leading-relaxed">
            {t("pricingDescription")}
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3 items-stretch">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`flex flex-col justify-between rounded-3xl p-8 transition-all ${
                plan.highlight
                  ? "bg-white ring-2 ring-blue-600 shadow-xl shadow-blue-500/10 lg:-translate-y-2 relative"
                  : "bg-white/90 ring-1 ring-slate-200/80 shadow-sm"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#0066ff] to-[#0099ff] px-4 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25">
                  {plan.badge}
                </span>
              )}

              <div>
                <h3 className="editorial-display text-xl font-bold text-slate-900">
                  {plan.name}
                </h3>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed min-h-[36px]">
                  {plan.description}
                </p>

                <div className="mt-6 border-y border-slate-100 py-4">
                  <div className="text-3xl font-black text-slate-900 font-mono">
                    {plan.price}
                  </div>
                  <div className="text-xs font-semibold text-slate-400 mt-0.5">
                    {plan.period}
                  </div>
                </div>

                <ul className="mt-6 space-y-3 text-xs text-slate-700">
                  {plan.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2.5">
                      <span className="text-blue-600 font-bold shrink-0">
                        ✓
                      </span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4">
                <Link
                  to={plan.buttonLink}
                  className={`w-full block text-center rounded-2xl py-3.5 text-xs font-black uppercase tracking-wider transition ${plan.buttonStyle}`}
                >
                  {plan.buttonText}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Placement Policy Note */}
        <div className="mt-16 rounded-3xl bg-slate-50 p-8 text-center ring-1 ring-slate-200/80">
          <h4 className="text-sm font-bold text-slate-900">
            {t("pricingPlacementNoteTitle")}
          </h4>
          <p className="mt-2 text-xs text-slate-600 max-w-xl mx-auto">
            {t("pricingPlacementNote")}
          </p>
          <Link
            to="/contact"
            className="mt-4 inline-block text-xs font-bold text-blue-600 hover:underline"
          >
            {t("pricingPlacementContact")} →
          </Link>
        </div>
      </div>
    </div>
  );
}
