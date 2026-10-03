const THEME_STORAGE_KEY = "linqup_theme";

function getStoredTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
}

function getEffectiveTheme() {
    return getStoredTheme() || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
        document.documentElement.setAttribute("data-theme", theme);
    } else {
        document.documentElement.removeAttribute("data-theme");
    }
}

function toggleTheme() {
    const next = getEffectiveTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
}

applyTheme(getStoredTheme());
