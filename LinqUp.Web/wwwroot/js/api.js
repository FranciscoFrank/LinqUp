const API_BASE = document.querySelector('meta[name="api-base-url"]').content.replace(/\/$/, "");

const TOKEN_KEYS = {
    expiresAt: "linqup_access_expires_at"
};

function getTokens() {
    return {
        expiresAt: localStorage.getItem(TOKEN_KEYS.expiresAt)
    };
}

let refreshPromise = null;
let backgroundRefreshTimer = null;

function scheduleBackgroundTokenRefresh() {
    if (backgroundRefreshTimer) {
        clearTimeout(backgroundRefreshTimer);
        backgroundRefreshTimer = null;
    }

    const tokens = getTokens();
    if (!tokens.expiresAt) return;

    const expiresTime = new Date(tokens.expiresAt).getTime();
    const now = Date.now();
    // Silently refresh 2 minutes before the token expires
    const refreshBeforeMs = 2 * 60 * 1000;
    const delay = expiresTime - now - refreshBeforeMs;

    if (delay <= 0) {
        // Expired or close to expiring, refresh immediately in background
        refreshTokens();
    } else {
        backgroundRefreshTimer = setTimeout(() => {
            refreshTokens();
        }, Math.min(delay, 2147483647));
    }
}

function setTokens(payload) {
    if (payload && payload.accessTokenExpiresAt) {
        localStorage.setItem(TOKEN_KEYS.expiresAt, payload.accessTokenExpiresAt);
        scheduleBackgroundTokenRefresh();
    }
}

function clearTokens() {
    localStorage.removeItem(TOKEN_KEYS.expiresAt);
    localStorage.removeItem("linqup_user_cache");
    if (backgroundRefreshTimer) {
        clearTimeout(backgroundRefreshTimer);
        backgroundRefreshTimer = null;
    }
}

function isLoggedIn() {
    return !!getTokens().expiresAt;
}

// Background auto-refresh check on tab visibility change
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isLoggedIn()) {
        const tokens = getTokens();
        if (tokens.expiresAt) {
            const expiresTime = new Date(tokens.expiresAt).getTime();
            // If less than 3 minutes remain, refresh now
            if (expiresTime - Date.now() < 3 * 60 * 1000) {
                refreshTokens();
            }
        }
    }
});

// Initialize background refresh if logged in
if (isLoggedIn()) {
    scheduleBackgroundTokenRefresh();
}

async function refreshTokens() {
    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE}/api/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include"
            });

            if (!res.ok) {
                clearTokens();
                return false;
            }

            const data = await res.json();
            setTokens(data);
            return true;
        } catch {
            return false;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

async function apiFetch(path, options = {}, { auth = true, retry = true } = {}) {
    const headers = new Headers(options.headers || {});
    options.credentials = "include";

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401 && auth && retry) {
        const refreshed = await refreshTokens();
        if (refreshed) {
            return apiFetch(path, options, { auth, retry: false });
        }

        clearTokens();
        if (!location.pathname.toLowerCase().includes("/auth/")) {
            location.href = withCulture("/auth/login");
        }
    }

    return res;
}

async function apiJson(path, options = {}, authOpts) {
    const headers = { ...(options.headers || {}) };
    if (options.body) {
        headers["Content-Type"] = "application/json";
    }

    const res = await apiFetch(path, { ...options, headers }, authOpts);

    let data = null;
    let textBody = null;
    try {
        textBody = await res.text();
        if (textBody) {
            data = JSON.parse(textBody);
        }
    } catch {
        data = textBody;
    }

    return { ok: res.ok, status: res.status, data };
}

function resolveMediaUrl(path) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${API_BASE}${path}`;
}

function resolveAvatarUrl(path) {
    return resolveMediaUrl(path);
}

const api = {
    register: (payload) => apiJson("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }, { auth: false }),

    login: (payload) => apiJson("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }, { auth: false }),

    loginTwoFactor: (payload) => apiJson("/api/auth/login/2fa", { method: "POST", body: JSON.stringify(payload) }, { auth: false }),
    forgotPassword: (email) => apiJson("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }, { auth: false }),
    resetPassword: (payload) => apiJson("/api/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }, { auth: false }),
    confirmEmail: (payload) => apiJson("/api/auth/confirm-email", { method: "POST", body: JSON.stringify(payload) }, { auth: false }),

    logout: async () => {
        await apiJson("/api/auth/logout", { method: "POST" }, { auth: false });
        clearTokens();
    },

    getSessions: () => apiJson("/api/auth/sessions"),
    revokeSession: (id) => apiJson(`/api/auth/sessions/${id}`, { method: "DELETE" }),
    revokeAllSessions: () => apiJson("/api/auth/sessions/revoke-all", { method: "POST" }),

    setupTwoFactor: () => apiJson("/api/auth/2fa/setup", { method: "POST" }),
    enableTwoFactor: (code) => apiJson("/api/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) }),
    disableTwoFactor: (password) => apiJson("/api/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password }) }),
    regenerateRecoveryCodes: () => apiJson("/api/auth/2fa/recovery-codes/regenerate", { method: "POST" }),
    changePassword: (payload) => apiJson("/api/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),
    changeEmail: (payload) => apiJson("/api/auth/change-email", { method: "POST", body: JSON.stringify(payload) }),

    getMe: () => apiJson("/api/profile/me"),
    updateMe: (payload) => apiJson("/api/profile/me", { method: "PUT", body: JSON.stringify(payload) }),
    isNicknameAvailable: (value) => apiJson(`/api/profile/nickname-available?value=${encodeURIComponent(value)}`, {}, { auth: false }),
    getPublicProfile: (nickname) => apiJson(`/api/profile/${encodeURIComponent(nickname)}`, {}, { auth: false }),

    uploadAvatar: async (file) => {
        const form = new FormData();
        form.append("file", file);
        const res = await apiFetch("/api/profile/avatar", { method: "POST", body: form });
        let data = null;
        try {
            data = await res.json();
        } catch {
            // no JSON body
        }
        return { ok: res.ok, status: res.status, data };
    },
    deleteAvatar: () => apiFetch("/api/profile/avatar", { method: "DELETE" }),

    uploadProjectLogo: async (projectId, file) => {
        const form = new FormData();
        form.append("file", file);
        const res = await apiFetch(`/api/projects/${projectId}/logo`, { method: "POST", body: form });
        let data = null;
        try {
            data = await res.json();
        } catch {}
        return { ok: res.ok, status: res.status, data };
    },
    deleteProjectLogo: (projectId) => apiFetch(`/api/projects/${projectId}/logo`, { method: "DELETE" }),

    addContact: (payload) => apiJson("/api/profile/contacts", { method: "POST", body: JSON.stringify(payload) }),
    updateContact: (id, payload) => apiJson(`/api/profile/contacts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    deleteContact: (id) => apiJson(`/api/profile/contacts/${id}`, { method: "DELETE" }),

    getSkillsCatalog: (search) => apiJson(`/api/skills${search ? `?search=${encodeURIComponent(search)}` : ""}`, {}, { auth: false }),
    addSkill: (payload) => apiJson("/api/profile/skills", { method: "POST", body: JSON.stringify(payload) }),
    updateSkill: (id, payload) => apiJson(`/api/profile/skills/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    deleteSkill: (id) => apiJson(`/api/profile/skills/${id}`, { method: "DELETE" }),

    getIntegrations: () => apiJson("/api/profile/integrations"),
    updateIntegration: (payload) => apiJson("/api/profile/integrations", { method: "POST", body: JSON.stringify(payload) }),
    disconnectIntegration: (provider) => apiJson(`/api/profile/integrations/${encodeURIComponent(provider)}`, { method: "DELETE" })
};
