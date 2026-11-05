export function BrandLogo({ appearance = "light", className = "", imgClassName = "", size = "md" }) {
    const sizeClasses = {
        xs: "h-6 sm:h-7 md:h-8",
        sm: "h-8 sm:h-10 md:h-12",
        md: "h-12 sm:h-14 md:h-16",
        lg: "h-16 sm:h-20 md:h-24",
        xl: "h-20 sm:h-24 md:h-32",
    };

    return (
        <span
            className={
                appearance === "dark"
                    ? `inline-flex rounded-2xl bg-white p-2.5 shadow-md ring-1 ring-white/10 ${className}`
                    : `inline-flex items-center ${className}`
            }
        >
            <img
                src="/tedbabelearnhub-logo.png"
                alt="TedbabeLearnHUB (TLH) — Your Learning Partner for a Better Future"
                className={
                    imgClassName ||
                    `${sizeClasses[size] || sizeClasses.md} w-auto object-contain transition-transform duration-300 hover:scale-[1.02]`
                }
            />
        </span>
    );
}
