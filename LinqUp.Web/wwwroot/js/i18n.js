// The URL's culture segment is authoritative (server renders <meta name="app-culture">
// from the route) — localStorage/navigator.language are only used as a last-resort
// fallback if that meta tag is ever missing.
function getLang() {
    const meta = document.querySelector('meta[name="app-culture"]');
    if (meta && (meta.content === "uk" || meta.content === "en")) {
        return meta.content;
    }

    const stored = localStorage.getItem("linqup_lang");
    if (stored === "uk" || stored === "en") {
        return stored;
    }

    return navigator.language && navigator.language.toLowerCase().startsWith("uk") ? "uk" : "en";
}

function translateI18n(key, lang, params) {
    if (typeof lang === "object" && params === undefined) {
        params = lang;
        lang = undefined;
    }
    lang = lang || getLang();
    const dict = (typeof translations !== "undefined" && (translations[lang] || translations.en)) || {};
    let value = key.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), dict);
    if (value === undefined) {
        const fallbackDict = (typeof translations !== "undefined" && translations.en) || {};
        value = key.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), fallbackDict);
    }
    if (value === undefined) return key;

    if (params && typeof value === "string") {
        Object.keys(params).forEach((paramKey) => {
            value = value.replace(new RegExp(`\\{${paramKey}\\}`, "g"), params[paramKey]);
        });
    }
    return value;
}

function applyTranslations() {
    const lang = getLang();
    document.documentElement.lang = lang;

    // Component partials render data-i18n="" (present but empty) when no key was given —
    // Razor only omits an attribute for null *boolean* expressions, not arbitrary strings —
    // so an empty key must be treated as "no key" here rather than looked up literally.
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (!key) return;
        const req = el.querySelector(".field-required");
        const translated = translateI18n(key, lang);
        if (req) {
            el.textContent = translated + " ";
            el.appendChild(req);
        } else {
            el.textContent = translated;
        }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (key) el.setAttribute("placeholder", translateI18n(key, lang));
    });

    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
        const key = el.getAttribute("data-i18n-title");
        if (key) el.setAttribute("title", translateI18n(key, lang));
    });

    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
        const key = el.getAttribute("data-i18n-aria");
        if (key) el.setAttribute("aria-label", translateI18n(key, lang));
    });

    document.querySelectorAll("[data-lang-option]").forEach((el) => {
        el.classList.toggle("is-active", el.getAttribute("data-lang-option") === lang);
    });
}

document.addEventListener("DOMContentLoaded", applyTranslations);
