// ==========================================================================
// Theme Management (Light / Dark Mode with Persistence)
// ==========================================================================
function isCurrentThemeDark() {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark") return true;
    if (attr === "light") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("linqup-theme", theme);
}

(() => {
    const savedTheme = localStorage.getItem("linqup-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
        document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }
})();

document.addEventListener("DOMContentLoaded", async () => {
    // ----------------------------------------------------------------------
    // Auth State & User Display
    // ----------------------------------------------------------------------
    const authed = isLoggedIn();

    document.querySelectorAll("[data-auth-visible]").forEach((el) => {
        const want = el.getAttribute("data-auth-visible") === "true";
        el.style.display = authed === want ? "" : "none";
    });

    function renderUserInfo(data) {
        if (!data) return;
        const avatarUrl = resolveAvatarUrl(data.avatarUrl);
        const avatarEls = document.querySelectorAll("#nav-avatar, #dropdown-avatar");
        avatarEls.forEach((avatarEl) => {
            if (avatarUrl) {
                avatarEl.style.backgroundImage = `url('${avatarUrl}')`;
                avatarEl.style.backgroundSize = "cover";
                avatarEl.textContent = "";
            } else {
                avatarEl.style.backgroundImage = "none";
                avatarEl.textContent = initials(data.firstName, data.lastName);
            }
        });

        const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ");
        const defaultUser = typeof t === "function" ? translateI18n("common.user") : (typeof getLang === "function" && getLang() === "en" ? "User" : "Користувач");
        const displayName = fullName || (data.nickname ? `@${data.nickname}` : defaultUser);
        const displayHandle = data.nickname ? `@${data.nickname}` : (data.email || "");

        const usernameEl = document.getElementById("nav-username");
        if (usernameEl) {
            usernameEl.textContent = displayName;
        }

        const userSubEl = document.getElementById("nav-user-sub");
        if (userSubEl) {
            userSubEl.textContent = displayHandle;
            userSubEl.style.display = displayHandle ? "block" : "none";
        }

        const dropdownFullnameEl = document.getElementById("dropdown-fullname");
        if (dropdownFullnameEl) {
            dropdownFullnameEl.textContent = displayName;
        }

        const dropdownHandleEl = document.getElementById("dropdown-handle");
        if (dropdownHandleEl) {
            dropdownHandleEl.textContent = displayHandle;
            dropdownHandleEl.style.display = displayHandle ? "block" : "none";
        }
    }

    if (authed) {
        // Instant pre-hydration from cache so user never sees '?' or empty state on refresh
        try {
            const cached = localStorage.getItem("linqup_user_cache");
            if (cached) {
                renderUserInfo(JSON.parse(cached));
            }
        } catch {}

        const { ok, data } = await api.getMe();
        if (ok) {
            try {
                localStorage.setItem("linqup_user_cache", JSON.stringify(data));
            } catch {}
            renderUserInfo(data);
        }
    }

    document.getElementById("logout-btn")?.addEventListener("click", async (e) => {
        e.preventDefault();
        try { localStorage.removeItem("linqup_user_cache"); } catch {}
        await api.logout();
        location.href = withCulture("/");
    });

    // ----------------------------------------------------------------------
    // Theme Toggle Trigger
    // ----------------------------------------------------------------------
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", (e) => {
            e.preventDefault();
            const currentlyDark = isCurrentThemeDark();
            const nextTheme = currentlyDark ? "light" : "dark";
            applyTheme(nextTheme);
        });
    }

    // ----------------------------------------------------------------------
    // Mobile Drawer Navigation
    // ----------------------------------------------------------------------
    const mobileToggle = document.getElementById("mobile-toggle");
    const mobileDrawer = document.getElementById("mobile-drawer");

    if (mobileToggle && mobileDrawer) {
        const toggleMobileMenu = (forceState) => {
            const isOpen = forceState !== undefined ? forceState : !mobileDrawer.classList.contains("is-open");
            mobileDrawer.classList.toggle("is-open", isOpen);
            mobileToggle.classList.toggle("is-open", isOpen);
            mobileToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
            document.body.style.overflow = isOpen ? "hidden" : "";
        };

        mobileToggle.addEventListener("click", () => toggleMobileMenu());

        mobileDrawer.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => toggleMobileMenu(false));
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && mobileDrawer.classList.contains("is-open")) {
                toggleMobileMenu(false);
            }
        });
    }

    // ----------------------------------------------------------------------
    // Floating Language Switcher (Matching User Reference)
    // ----------------------------------------------------------------------
    const floatingWidget = document.getElementById("floating-lang-widget");
    const floatingTrigger = document.getElementById("floating-lang-trigger");
    const floatingMenu = document.getElementById("floating-lang-menu");

    if (floatingWidget && floatingTrigger && floatingMenu) {
        const toggleFloatingLang = (forceState) => {
            const isOpen = forceState !== undefined ? forceState : !floatingWidget.classList.contains("is-open");
            floatingWidget.classList.toggle("is-open", isOpen);
            floatingTrigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
        };

        floatingTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleFloatingLang();
        });

        document.addEventListener("click", (e) => {
            if (!floatingWidget.contains(e.target)) {
                toggleFloatingLang(false);
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                toggleFloatingLang(false);
            }
        });

        floatingMenu.querySelectorAll("[data-lang]").forEach((link) => {
            const targetLang = link.getAttribute("data-lang");
            const currentPath = location.pathname.replace(/^\/(en|uk)/, "");
            link.href = `/${targetLang}${currentPath}${location.search}`;
            link.classList.toggle("is-active", targetLang === getLang());
        });
    }

    // ----------------------------------------------------------------------
    // Nav Scroll-Spy for Smooth Section Highlighting
    // ----------------------------------------------------------------------
    const sectionIds = ["about", "how-it-works", "projects", "contact"];
    const navAnchors = document.querySelectorAll(".nav-links a.nav-link");

    if (navAnchors.length && "IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute("id");
                    navAnchors.forEach((link) => {
                        const href = link.getAttribute("href") || "";
                        link.classList.toggle("is-active", href.includes(`#${id}`));
                    });
                }
            });
        }, { rootMargin: "-30% 0px -60% 0px" });

        sectionIds.forEach((id) => {
            const section = document.getElementById(id);
            if (section) observer.observe(section);
        });
    }

    // ----------------------------------------------------------------------
    // Clean URL In-Page Navigation (Prevent '#' in Address Bar)
    // ----------------------------------------------------------------------
    const handleInPageNavClick = (e) => {
        const anchor = e.target.closest("header a, footer a, #mobile-drawer a, .footer a");
        if (!anchor) return;

        const href = anchor.getAttribute("href");
        if (!href) return;

        if (href === "#") {
            e.preventDefault();
            return;
        }

        const hashIndex = href.indexOf("#");
        if (hashIndex !== -1) {
            const hash = href.substring(hashIndex);
            const path = href.substring(0, hashIndex);
            const currentPath = window.location.pathname;

            const isCurrentPage = !path || path === currentPath || (path.replace(/\/$/, "") === currentPath.replace(/\/$/, ""));
            if (isCurrentPage) {
                const targetId = hash.replace("#", "");
                const targetEl = document.getElementById(targetId) || document.querySelector(hash);
                if (targetEl) {
                    e.preventDefault();
                    targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
                    if (window.location.hash) {
                        history.replaceState(null, "", currentPath + window.location.search);
                    }
                }
            }
        }
    };

    document.addEventListener("click", handleInPageNavClick);

    // If page loaded with a hash in URL, smoothly scroll and clean hash from address bar
    if (window.location.hash) {
        const targetId = window.location.hash.replace("#", "");
        const targetEl = document.getElementById(targetId) || document.querySelector(window.location.hash);
        if (targetEl) {
            setTimeout(() => {
                targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
        }
        history.replaceState(null, "", window.location.pathname + window.location.search);
    }
});

// --------------------------------------------------------------------------
// Avatar Dropdown (User Profile Menu)
// --------------------------------------------------------------------------
const userMenuTrigger = document.getElementById("user-menu-trigger");
if (userMenuTrigger) {
    const userMenu = document.getElementById("user-menu");

    userMenuTrigger.addEventListener("click", () => {
        userMenu.classList.toggle("is-open");
        userMenuTrigger.setAttribute("aria-expanded", userMenu.classList.contains("is-open") ? "true" : "false");
    });

    document.addEventListener("click", (e) => {
        if (!userMenu.contains(e.target)) {
            userMenu.classList.remove("is-open");
            userMenuTrigger.setAttribute("aria-expanded", "false");
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            userMenu.classList.remove("is-open");
            userMenuTrigger.setAttribute("aria-expanded", "false");
        }
    });
}

// --------------------------------------------------------------------------
// Sticky Header Scroll Transition
// --------------------------------------------------------------------------
const header = document.getElementById("site-header");
if (header) {
    const updateHeaderState = () => {
        header.classList.toggle("is-scrolled", window.scrollY > 20);
    };
    updateHeaderState();
    window.addEventListener("scroll", updateHeaderState, { passive: true });
}

// --------------------------------------------------------------------------
// Collapsible Sidebar Management
// --------------------------------------------------------------------------
const sidebarCollapseBtn = document.getElementById("sidebar-collapse-btn");
const appShell = document.getElementById("app-shell");

const updateSidebarState = (isCollapsed) => {
    if (!appShell) return;
    appShell.classList.toggle("is-collapsed", isCollapsed);
    try {
        localStorage.setItem("linqup_sidebar_collapsed", isCollapsed ? "true" : "false");
    } catch (e) {}

    if (sidebarCollapseBtn) {
        const currentLang = typeof getLang === "function" ? getLang() : "uk";
        const langDict = (typeof translations !== "undefined" && translations[currentLang]) ? translations[currentLang] : null;
        const expandText = langDict?.sidebar?.expand || (currentLang === "en" ? "Expand" : "Розгорнути");
        const collapseText = langDict?.sidebar?.collapse || (currentLang === "en" ? "Collapse" : "Згорнути");
        const text = isCollapsed ? expandText : collapseText;

        const labelEl = sidebarCollapseBtn.querySelector(".sidebar-label");
        if (labelEl) labelEl.textContent = text;
        sidebarCollapseBtn.setAttribute("title", text);
        sidebarCollapseBtn.setAttribute("aria-label", text);
        sidebarCollapseBtn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    }
};

if (appShell && sidebarCollapseBtn) {
    // Sync initial state from localStorage
    try {
        const isStoredCollapsed = localStorage.getItem("linqup_sidebar_collapsed") === "true";
        if (isStoredCollapsed) {
            updateSidebarState(true);
        }
    } catch (e) {}

    sidebarCollapseBtn.addEventListener("click", () => {
        const isCollapsed = appShell.classList.contains("is-collapsed");
        updateSidebarState(!isCollapsed);
    });
}

// Remove the preload class if it was attached
document.documentElement.classList.remove("sidebar-collapsed-preload");

