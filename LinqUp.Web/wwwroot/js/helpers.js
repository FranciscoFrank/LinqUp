const CONTACT_TYPE_ICONS = {
    Phone: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    Email: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
    Telegram: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`,
    Viber: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.78 3.56A11.75 11.75 0 0 0 12 .3C5.55.3.3 5.55.3 12c0 2.22.62 4.3 1.7 6.08L.36 23.3l5.44-1.6A11.66 11.66 0 0 0 12 23.7c6.45 0 11.7-5.25 11.7-11.7 0-3.13-1.22-6.08-3.42-8.28l-.5-.16zm-3.04 12.3c-.22.62-1.3 1.18-1.84 1.25-.48.06-1.1.09-3.56-.93-3.15-1.31-5.18-4.52-5.34-4.73-.16-.21-1.28-1.7-1.28-3.25s.8-2.31 1.09-2.63c.28-.31.62-.39.83-.39.21 0 .42 0 .6.01.2.01.46-.07.72.55.26.63.89 2.18.97 2.34.08.16.13.34.03.55-.1.21-.16.34-.31.52-.16.18-.33.4-.47.54-.16.15-.32.32-.14.63.19.31.83 1.36 1.77 2.2 1.22 1.08 2.24 1.42 2.56 1.58.31.16.5.13.68-.08.19-.21.8-.93 1.02-1.25.21-.31.43-.26.72-.16.29.1 1.84.87 2.16 1.02.31.16.52.23.6.36.08.13.08.76-.14 1.38z"/></svg>`,
    WhatsApp: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.42 0H12.6C19.23 0 24 4.77 24 11.4V12.6C24 19.23 19.23 24 12.6 24H11.42C4.77 24 0 19.23 0 12.6V11.4C0 4.77 4.77 0 11.42 0ZM12 4.8C8.03 4.8 4.8 8.03 4.8 12C4.8 13.56 5.3 15.01 6.13 16.23L5.22 19.49L8.57 18.6C9.62 19.06 10.78 19.2 12 19.2C15.97 19.2 19.2 15.97 19.2 12C19.2 8.03 15.97 4.8 12 4.8ZM16.32 15.34C16.14 15.86 15.22 16.31 14.7 16.38C14.28 16.43 13.67 16.51 11.64 15.68C9.04 14.62 7.37 11.96 7.24 11.78C7.12 11.6 6.16 10.33 6.16 9.02C6.16 7.7 6.84 7.06 7.12 6.77C7.36 6.51 7.74 6.42 8.08 6.42C8.2 6.42 8.3 6.42 8.4 6.43C8.65 6.44 8.77 6.46 8.94 6.86C9.15 7.38 9.67 8.65 9.73 8.78C9.79 8.91 9.87 9.1 9.77 9.31C9.67 9.51 9.58 9.61 9.42 9.79C9.26 9.97 9.09 10.2 8.95 10.33C8.79 10.5 8.61 10.68 8.81 11.02C9.01 11.36 9.67 12.43 10.63 13.29C11.87 14.4 12.88 14.75 13.25 14.9C13.62 15.05 14 15.01 14.24 14.75C14.54 14.43 14.91 13.88 15.29 13.33C15.58 12.91 15.93 12.97 16.27 13.1C16.61 13.23 18.42 14.12 18.79 14.31C19.16 14.5 19.41 14.59 19.5 14.75C19.59 14.91 19.59 15.67 19.22 16.19"/></svg>`,
    Discord: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>`,
    LinkedIn: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
    GitHub: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`,
    Website: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    Other: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`
};

function contactIcon(type) {
    return CONTACT_TYPE_ICONS[type] || CONTACT_TYPE_ICONS.Other;
}

function contactHref(type, value) {
    switch (type) {
        case "Phone":
            return `tel:${value}`;
        case "Email":
            return `mailto:${value}`;
        case "Telegram":
            return value.startsWith("http") ? value : `https://t.me/${value.replace(/^@/, "")}`;
        case "Website":
        case "LinkedIn":
        case "GitHub":
            return value.startsWith("http") ? value : `https://${value}`;
        default:
            return null;
    }
}

function formatExperience(months, lang) {
    lang = lang || getLang();
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const parts = [];
    if (years > 0) {
        parts.push(`${years} ${translateI18n("common.years", lang)}`);
    }
    if (rest > 0 || parts.length === 0) {
        parts.push(`${rest} ${translateI18n("common.months", lang)}`);
    }
    return parts.join(" ");
}

function formatDate(isoString, lang) {
    lang = lang || getLang();
    const date = new Date(isoString);
    return date.toLocaleString(lang === "uk" ? "uk-UA" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function formatLastUsed(isoString, isCurrent, lang) {
    lang = lang || getLang();
    if (isCurrent) {
        return lang === "uk" ? "Зараз онлайн" : "Active now";
    }
    if (!isoString) {
        return lang === "uk" ? "Невідомо" : "Unknown";
    }
    const diffMs = Date.now() - new Date(isoString).getTime();
    if (diffMs < 2 * 60 * 1000) {
        return lang === "uk" ? "Щойно" : "Just now";
    }
    if (diffMs < 60 * 60 * 1000) {
        const mins = Math.floor(diffMs / (60 * 1000));
        return lang === "uk" ? `${mins} хв тому` : `${mins} min ago`;
    }
    return formatDate(isoString, lang);
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

function initials(firstName, lastName) {
    const a = (firstName || "").trim().charAt(0);
    const b = (lastName || "").trim().charAt(0);
    return (a + b).toUpperCase() || "?";
}

// Prefixes a same-app path with the current URL culture segment and ensures lowercase URLs (e.g. withCulture("/Profile/Me") -> "/uk/profile/me").
function withCulture(path) {
    const lang = getLang();
    const clean = path.startsWith("/") ? path : `/${path}`;
    const [pathname, ...rest] = clean.split(/([?#].*)/);
    const queryOrHash = rest.join("");
    return `/${lang}${pathname.toLowerCase()}${queryOrHash}`;
}

function withLoading(button, asyncFn) {
    return async (...args) => {
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = translateI18n("common.loading");
        try {
            return await asyncFn(...args);
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    };
}
