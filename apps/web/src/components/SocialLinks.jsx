const socialLinks = [
  {
    name: "LinkedIn",
    url: "https://www.linkedin.com/company/tedbabelearnhub",
    icon: "linkedin",
  },
  {
    name: "WhatsApp",
    url: "https://wa.me/251900000000",
    icon: "whatsapp",
  },
  {
    name: "Facebook",
    url: "https://web.facebook.com/profile.php?id=61589559661444",
    icon: "facebook",
  },
  {
    name: "Twitter",
    url: "https://twitter.com/learnhub",
    icon: "twitter",
  },
  {
    name: "Telegram",
    url: "https://t.me/@wendemu",
    icon: "telegram",
  },
  {
    name: "YouTube",
    url: "https://youtube.com/learnhub",
    icon: "youtube",
  },
  { name: "TikTok", url: "https://tiktok.com/@learnhub", icon: "tiktok" },
];

function SocialIcon({ name }) {
  const shared = {
    "aria-hidden": true,
    className: "h-4 w-4",
    fill: "currentColor",
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "linkedin":
      return (
        <svg {...shared}>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...shared}>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...shared}>
          <path d="M13.5 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.3v3.2h2.8V21h3.4Z" />
        </svg>
      );
    case "twitter":
      return (
        <svg {...shared}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "telegram":
      return (
        <svg {...shared}>
          <path d="M21.8 4.2 18.6 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 13.5l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6L20.4 3c.9-.3 1.7.2 1.4 1.2Z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...shared}>
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...shared}>
          <path d="M19.6 6.4a6.3 6.3 0 0 1-3.9-1.3v8.4a6.2 6.2 0 1 1-5.4-6.1v3.5a2.8 2.8 0 1 0 1.9 2.6V2h3.5a6.3 6.3 0 0 0 3.9 4.4v.1Z" />
        </svg>
      );
    default:
      return null;
  }
}

export function SocialLinks() {
  return (
    <nav
      aria-label="TedbabeLearnHUB social media"
      className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-1.5 rounded-full border border-sky-500/20 bg-[var(--tlh-navy-deep)]/90 p-2 shadow-xl shadow-slate-950/20 backdrop-blur-md print:hidden sm:bottom-6 sm:right-6 sm:gap-2 sm:p-2.5"
    >
      {socialLinks.map(({ name, url, icon }) => {
        const className =
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400";
        const content = <SocialIcon name={icon} />;

        return (
          <span
            key={name}
            title={url ? `TedbabeLearnHUB on ${name}` : `${name} link not configured`}
          >
            {url.trim() ? (
              <a
                href={url.trim()}
                target="_blank"
                rel="noreferrer"
                aria-label={`TedbabeLearnHUB on ${name} (opens in a new tab)`}
                className={`${className} hover:bg-white/15 hover:text-white`}
              >
                {content}
              </a>
            ) : (
              <span
                aria-label={`${name} link not configured yet`}
                aria-disabled="true"
                className={`${className} cursor-not-allowed text-white/45`}
              >
                {content}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
