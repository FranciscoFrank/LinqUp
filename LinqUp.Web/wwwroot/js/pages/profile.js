let currentProfile = null;
let userIntegrations = [];
let userSessions = [];

function setAlert(id, message, success) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || "";
    if (success !== undefined) {
        el.className = "alert " + (success ? "alert-success" : "alert-danger");
    }
    el.style.display = message ? "" : "none";
}

// ==========================================
// AVATAR & HEADER
// ==========================================

function renderAvatar() {
    const img = document.getElementById("avatar-img");
    const fallback = document.getElementById("avatar-fallback");
    const modalImg = document.getElementById("avatar-modal-img");
    const modalFallback = document.getElementById("avatar-modal-fallback");
    const modalRemoveBtn = document.getElementById("avatar-modal-remove-btn");
    const navAvatar = document.getElementById("nav-avatar");
    const dropdownAvatar = document.getElementById("dropdown-avatar");

    const url = resolveAvatarUrl(currentProfile.avatarUrl);
    const inits = initials(currentProfile.firstName, currentProfile.lastName);

    if (url) {
        img.src = url;
        img.style.display = "block";
        fallback.style.display = "none";

        if (modalImg) {
            modalImg.src = url;
            modalImg.style.display = "block";
            modalFallback.style.display = "none";
        }
        if (modalRemoveBtn) {
            modalRemoveBtn.style.display = "inline-block";
        }
        if (navAvatar) {
            navAvatar.textContent = "";
            navAvatar.style.backgroundImage = `url("${url}")`;
            navAvatar.style.backgroundSize = "cover";
        }
        if (dropdownAvatar) {
            dropdownAvatar.textContent = "";
            dropdownAvatar.style.backgroundImage = `url("${url}")`;
            dropdownAvatar.style.backgroundSize = "cover";
        }
    } else {
        img.style.display = "none";
        fallback.style.display = "flex";
        fallback.textContent = inits;

        if (modalImg) {
            modalImg.style.display = "none";
            modalFallback.style.display = "flex";
            modalFallback.textContent = inits;
        }
        if (modalRemoveBtn) {
            modalRemoveBtn.style.display = "none";
        }
        if (navAvatar) {
            navAvatar.style.backgroundImage = "";
            navAvatar.textContent = inits;
        }
        if (dropdownAvatar) {
            dropdownAvatar.style.backgroundImage = "";
            dropdownAvatar.textContent = inits;
        }
    }
}

function renderHeader() {
    document.getElementById("profile-fullname").textContent = `${currentProfile.firstName} ${currentProfile.lastName}`.trim() || " ";
    document.getElementById("profile-nickname-display").textContent = `@${currentProfile.nickname}`;
    document.getElementById("view-public-link").href = withCulture(`/u/${currentProfile.nickname}`);
    renderAvatar();

    const currentEmailEl = document.getElementById("current-email-display");
    if (currentEmailEl) {
        currentEmailEl.textContent = currentProfile.email || "—";
    }
}

// Avatar modal management
function openAvatarModal() {
    setAlert("avatar-modal-alert", "");
    setAlert("avatar-modal-success", "");
    renderAvatar();
    document.getElementById("avatar-modal").style.display = "flex";
}

function closeAvatarModal() {
    document.getElementById("avatar-modal").style.display = "none";
}

document.getElementById("avatar-edit-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openAvatarModal();
});

document.getElementById("avatar-wrapper")?.addEventListener("click", () => {
    openAvatarModal();
});

document.getElementById("avatar-modal-close")?.addEventListener("click", closeAvatarModal);
document.getElementById("avatar-modal-done-btn")?.addEventListener("click", closeAvatarModal);

document.getElementById("avatar-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "avatar-modal") {
        closeAvatarModal();
    }
});

const dropzone = document.getElementById("avatar-dropzone");
const avatarInput = document.getElementById("avatar-modal-input");

dropzone?.addEventListener("click", () => {
    avatarInput?.click();
});

dropzone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("is-dragover");
});

dropzone?.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-dragover");
});

dropzone?.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-dragover");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await handleAvatarUpload(e.dataTransfer.files[0]);
    }
});

avatarInput?.addEventListener("change", async (e) => {
    if (e.target.files && e.target.files.length > 0) {
        await handleAvatarUpload(e.target.files[0]);
    }
});

async function handleAvatarUpload(file) {
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        setAlert("avatar-modal-alert", translateI18n("profile.avatarFormatError"));
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        setAlert("avatar-modal-alert", translateI18n("profile.avatarSizeError"));
        return;
    }

    setAlert("avatar-modal-alert", "");
    setAlert("avatar-modal-success", "");

    const { ok, data } = await api.uploadAvatar(file);
    if (!ok) {
        setAlert("avatar-modal-alert", typeof data === "string" ? data : translateI18n("common.errorGeneric"));
        return;
    }

    currentProfile = data;
    renderAvatar();
    setAlert("avatar-modal-success", translateI18n("profile.avatarUpdated"), true);
}

document.getElementById("avatar-modal-remove-btn")?.addEventListener("click", async () => {
    if (!confirm(translateI18n("profile.avatarRemoveConfirm"))) return;

    setAlert("avatar-modal-alert", "");
    setAlert("avatar-modal-success", "");

    const res = await api.deleteAvatar();
    if (res.ok) {
        currentProfile.avatarUrl = null;
        renderAvatar();
        setAlert("avatar-modal-success", translateI18n("profile.avatarRemoved"), true);
    } else {
        setAlert("avatar-modal-alert", translateI18n("common.errorGeneric"));
    }
});

// ==========================================
// TAB NAVIGATION
// ==========================================

const TABS = ["general", "security", "sessions", "integrations"];

function switchTab(tabName) {
    if (!TABS.includes(tabName)) {
        tabName = "general";
    }

    document.querySelectorAll(".profile-tab-btn").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-tab") === tabName);
    });

    document.querySelectorAll(".tab-pane").forEach((pane) => {
        pane.classList.toggle("is-active", pane.id === `tab-pane-${tabName}`);
    });

    const url = new URL(window.location.href);
    url.searchParams.set("tab", tabName);
    window.history.replaceState({}, "", url.toString());

    if (tabName === "sessions") {
        loadSessions();
    } else if (tabName === "security") {
        loadTwoFaStatus();
    } else if (tabName === "integrations") {
        loadIntegrations();
    }
}

document.querySelectorAll(".profile-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        switchTab(tab);
    });
});

function initTabFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    const hashParam = window.location.hash.replace("#", "");

    if (TABS.includes(tabParam)) {
        switchTab(tabParam);
    } else if (TABS.includes(hashParam)) {
        switchTab(hashParam);
    } else {
        switchTab("general");
    }
}

// ==========================================
// GENERAL TAB (Basics, Contacts, Skills)
// ==========================================

function fillForm() {
    document.getElementById("firstName").value = currentProfile.firstName || "";
    document.getElementById("lastName").value = currentProfile.lastName || "";
    document.getElementById("nickname").value = currentProfile.nickname || "";
    document.getElementById("bio").value = currentProfile.bio || "";
    if (currentProfile.goal) {
        const goalRadio = document.querySelector(`input[name="goal"][value="${currentProfile.goal}"]`);
        if (goalRadio) goalRadio.checked = true;
    } else {
        const checkedGoal = document.querySelector('input[name="goal"]:checked');
        if (checkedGoal) checkedGoal.checked = false;
    }
}

function renderContacts() {
    const list = document.getElementById("contacts-list");
    const empty = document.getElementById("contacts-empty");
    list.innerHTML = "";

    if (!currentProfile.contactMethods.length) {
        empty.style.display = "block";
        return;
    }
    empty.style.display = "none";

    currentProfile.contactMethods.forEach((contact) => {
        const row = document.createElement("div");
        row.className = "item-row";

        const href = contactHref(contact.type, contact.value);
        const valueHtml = href
            ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(contact.value)}</a>`
            : escapeHtml(contact.value);

        row.innerHTML = `
            <div class="item-row-main">
                <span style="font-size:1.2rem;">${contactIcon(contact.type)}</span>
                <div class="item-row-text">
                    <span class="item-row-title">${contact.type}</span>
                    <span class="item-row-subtitle">${valueHtml}</span>
                </div>
                ${contact.isPrimary ? `<span class="badge" data-i18n="profile.contactPrimary">${translateI18n("profile.contactPrimary")}</span>` : ""}
            </div>
            <div class="item-row-actions">
                <button type="button" class="btn btn-danger danger" data-delete-contact="${contact.id}" data-i18n="common.delete">${translateI18n("common.delete")}</button>
            </div>
        `;
        list.appendChild(row);
    });

    list.querySelectorAll("[data-delete-contact]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-delete-contact");
            const { ok } = await api.deleteContact(id);
            if (ok) {
                currentProfile.contactMethods = currentProfile.contactMethods.filter((c) => String(c.id) !== String(id));
                renderContacts();
            }
        });
    });
}

function renderSkills() {
    const list = document.getElementById("skills-list");
    const empty = document.getElementById("skills-empty");
    list.innerHTML = "";

    if (!currentProfile.skills.length) {
        empty.style.display = "block";
        return;
    }
    empty.style.display = "none";

    currentProfile.skills.forEach((skill) => {
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
            <div class="item-row-main">
                <div class="item-row-text">
                    <span class="item-row-title">${escapeHtml(skill.skillName)}</span>
                    <span class="item-row-subtitle">${formatExperience(skill.experienceMonths)}</span>
                </div>
            </div>
            <div class="item-row-actions">
                <button type="button" class="btn btn-danger danger" data-delete-skill="${skill.id}" data-i18n="common.delete">${translateI18n("common.delete")}</button>
            </div>
        `;
        list.appendChild(row);
    });

    list.querySelectorAll("[data-delete-skill]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-delete-skill");
            const { ok } = await api.deleteSkill(id);
            if (ok) {
                currentProfile.skills = currentProfile.skills.filter((s) => String(s.id) !== String(id));
                renderSkills();
            }
        });
    });
}

// Basic info form
const nicknamePattern = /^[a-z0-9_]{3,20}$/;
let nicknameCheckTimer = null;

document.getElementById("nickname")?.addEventListener("input", (e) => {
    const value = e.target.value.trim().toLowerCase();
    const errorEl = document.querySelector('[data-error-for="nickname"]');
    if (!errorEl) return;
    errorEl.classList.remove("is-success");

    if (nicknameCheckTimer) {
        clearTimeout(nicknameCheckTimer);
    }

    if (value === currentProfile?.nickname) {
        errorEl.textContent = "";
        return;
    }

    if (!nicknamePattern.test(value)) {
        errorEl.textContent = value ? translateI18n("profile.nicknameInvalid") : "";
        return;
    }

    nicknameCheckTimer = setTimeout(async () => {
        const { data: available } = await api.isNicknameAvailable(value);
        if (available) {
            errorEl.textContent = translateI18n("profile.nicknameAvailable");
            errorEl.classList.add("is-success");
        } else {
            errorEl.textContent = translateI18n("profile.nicknameTaken");
            errorEl.classList.remove("is-success");
        }
    }, 400);
});

document.getElementById("profile-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("profile-alert", "");
    setAlert("profile-success", "");

    const selectedGoal = document.querySelector('input[name="goal"]:checked')?.value || null;

    const payload = {
        firstName: document.getElementById("firstName").value.trim(),
        lastName: document.getElementById("lastName").value.trim(),
        nickname: document.getElementById("nickname").value.trim().toLowerCase(),
        bio: document.getElementById("bio").value.trim(),
        goal: selectedGoal
    };

    const { ok, status, data } = await api.updateMe(payload);

    if (!ok) {
        const message = status === 409 ? translateI18n("profile.nicknameTaken") : (typeof data === "string" ? data : translateI18n("common.errorGeneric"));
        setAlert("profile-alert", message);
        return;
    }

    currentProfile = data;
    renderHeader();
    setAlert("profile-success", translateI18n("profile.saved"), true);
});

// Contacts toggle
document.getElementById("contact-add-toggle")?.addEventListener("click", () => {
    document.getElementById("contact-form").classList.toggle("is-active");
});

document.getElementById("contact-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
        type: document.getElementById("contact-type").value,
        value: document.getElementById("contact-value").value.trim(),
        isPrimary: document.getElementById("contact-primary").checked
    };

    const { ok, data } = await api.addContact(payload);
    if (!ok) return;

    currentProfile.contactMethods.push(data);
    renderContacts();
    e.target.reset();
    document.getElementById("contact-form").classList.remove("is-active");
});

// Skills
async function loadSkillsCatalog() {
    const { data } = await api.getSkillsCatalog();
    const select = document.getElementById("skill-preset-select");
    if (!select) return;
    select.innerHTML = "";
    (data || []).forEach((skill) => {
        const option = document.createElement("option");
        option.value = skill.id;
        option.textContent = skill.name;
        select.appendChild(option);
    });
    refreshCustomSelect(select);
}

document.querySelectorAll('input[name="skill-mode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
        const isPreset = document.querySelector('input[name="skill-mode"]:checked').value === "preset";
        document.getElementById("skill-preset-wrap").style.display = isPreset ? "block" : "none";
        document.getElementById("skill-custom-wrap").style.display = isPreset ? "none" : "block";
    });
});

document.getElementById("skill-add-toggle")?.addEventListener("click", () => {
    document.getElementById("skill-form").classList.toggle("is-active");
});

document.getElementById("skill-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("skill-alert", "");

    const isPreset = document.querySelector('input[name="skill-mode"]:checked').value === "preset";
    const experienceMonths = parseInt(document.getElementById("skill-experience").value, 10) || 0;

    const payload = isPreset
        ? { skillId: document.getElementById("skill-preset-select").value, experienceMonths }
        : { skillName: document.getElementById("skill-custom-name").value.trim(), experienceMonths };

    const { ok, status, data } = await api.addSkill(payload);
    if (!ok) {
        setAlert("skill-alert", status === 409 ? translateI18n("profile.skillAlreadyAdded") : translateI18n("common.errorGeneric"));
        return;
    }

    currentProfile.skills.push(data);
    renderSkills();
    e.target.reset();
    document.getElementById("skill-form").classList.remove("is-active");
});

// ==========================================
// SECURITY TAB (Password, Email, 2FA)
// ==========================================

// Password visibility toggles
document.querySelectorAll(".password-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-toggle-for");
        const input = document.getElementById(targetId);
        if (!input) return;

        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";

        btn.innerHTML = isPassword
            ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
               </svg>`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
               </svg>`;
    });
});

// Change Password Form
document.getElementById("password-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("password-alert", "");
    setAlert("password-success", "");

    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        setAlert("password-alert", translateI18n("common.required"));
        return;
    }

    if (newPassword !== confirmPassword) {
        setAlert("password-alert", translateI18n("security.passwordMismatch"));
        return;
    }

    if (newPassword.length < 8) {
        setAlert("password-alert", translateI18n("auth.reqMinLength"));
        return;
    }

    const btn = document.getElementById("password-submit-btn");
    btn.disabled = true;

    const { ok, data } = await api.changePassword({ currentPassword, newPassword });
    btn.disabled = false;

    if (!ok) {
        const errorMsg = typeof data === "string" ? data : (data?.message || translateI18n("common.errorGeneric"));
        setAlert("password-alert", errorMsg);
        return;
    }

    setAlert("password-success", translateI18n("security.passwordChanged"), true);
    document.getElementById("password-form").reset();
});

// Change Email Form
document.getElementById("email-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("email-alert", "");
    setAlert("email-success", "");

    const newEmail = document.getElementById("new-email").value.trim();
    const password = document.getElementById("email-password-confirm").value;

    if (!newEmail || !password) {
        setAlert("email-alert", translateI18n("common.required"));
        return;
    }

    if (currentProfile && newEmail.toLowerCase() === (currentProfile.email || "").toLowerCase()) {
        setAlert("email-alert", translateI18n("security.emailSame"));
        return;
    }

    const btn = document.getElementById("email-submit-btn");
    btn.disabled = true;

    const { ok, status, data } = await api.changeEmail({ newEmail, password });
    btn.disabled = false;

    if (!ok) {
        if (status === 409) {
            setAlert("email-alert", translateI18n("security.emailAlreadyUsed"));
        } else {
            const errorMsg = typeof data === "string" ? data : (data?.message || translateI18n("common.errorGeneric"));
            setAlert("email-alert", errorMsg);
        }
        return;
    }

    if (currentProfile) {
        currentProfile.email = newEmail;
    }
    const emailDisplay = document.getElementById("current-email-display");
    if (emailDisplay) emailDisplay.textContent = newEmail;

    setAlert("email-success", translateI18n("security.emailChanged"), true);
    document.getElementById("email-form").reset();
});

// 2FA Management
const twoFaViews = ["twofa-status-view", "twofa-setup-view", "recovery-codes-view", "disable-form-view"];

function showTwoFaView(id) {
    twoFaViews.forEach((v) => {
        const el = document.getElementById(v);
        if (el) el.style.display = v === id ? "block" : "none";
    });
}

async function loadTwoFaStatus() {
    const badge = document.getElementById("twofa-status-badge");
    const enableBtn = document.getElementById("twofa-enable-btn");
    const disableBlock = document.getElementById("twofa-disable-block");
    const tabBadge = document.getElementById("security-tab-badge");

    if (!currentProfile) return;

    if (currentProfile.twoFactorEnabled) {
        if (badge) {
            badge.textContent = translateI18n("security.enabled");
            badge.className = "badge badge-success";
        }
        if (enableBtn) enableBtn.style.display = "none";
        if (disableBlock) disableBlock.style.display = "block";
        if (tabBadge) {
            tabBadge.style.display = "inline-block";
            tabBadge.textContent = "2FA ON";
        }
    } else {
        if (badge) {
            badge.textContent = translateI18n("security.disabled");
            badge.className = "badge badge-warning";
        }
        if (enableBtn) enableBtn.style.display = "block";
        if (disableBlock) disableBlock.style.display = "none";
        if (tabBadge) {
            tabBadge.style.display = "none";
        }
    }
}

document.getElementById("twofa-enable-btn")?.addEventListener("click", async () => {
    const { ok, data } = await api.setupTwoFactor();
    if (!ok) return;

    document.getElementById("manual-key").textContent = data.manualEntryKey;
    setAlert("setup-alert", "");
    document.getElementById("setup-form").reset();
    showTwoFaView("twofa-setup-view");

    const qrBox = document.getElementById("qr-box");
    qrBox.innerHTML = "";
    if (typeof QRCode !== "undefined") {
        new QRCode(qrBox, {
            text: data.otpAuthUri,
            width: 180,
            height: 180
        });
    }
});

document.getElementById("setup-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("setup-alert", "");

    const code = document.getElementById("setup-code").value.trim();
    const { ok, data } = await api.enableTwoFactor(code);

    if (!ok) {
        setAlert("setup-alert", translateI18n("auth.errorCode"));
        return;
    }

    currentProfile.twoFactorEnabled = true;
    renderRecoveryCodes(data.recoveryCodes);
    showTwoFaView("recovery-codes-view");
});

let currentRecoveryCodes = [];

function renderRecoveryCodes(codes) {
    currentRecoveryCodes = codes || [];
    const grid = document.getElementById("recovery-codes-grid");
    if (!grid) return;
    grid.innerHTML = "";
    currentRecoveryCodes.forEach((code) => {
        const span = document.createElement("span");
        span.textContent = code;
        grid.appendChild(span);
    });
}

function downloadRecoveryCodesTxt(codes) {
    if (!codes || codes.length === 0) return;
    const lines = [
        "==================================================",
        "LinqUp - Резервні коди 2FA (Recovery Codes)",
        "Створено: " + new Date().toLocaleString(),
        "==================================================",
        "УВАГА: Кожен код працює лише один раз.",
        "Зберігайте цей файл у надійному та безпечному місці.",
        "--------------------------------------------------",
        "",
        ...codes.map((c, i) => `  [${i + 1}]  ${c}`),
        "",
        "--------------------------------------------------",
        "https://linqup.ua"
    ];

    const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linqup-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

document.getElementById("recovery-download-btn")?.addEventListener("click", () => {
    downloadRecoveryCodesTxt(currentRecoveryCodes);
});

document.getElementById("recovery-done-btn")?.addEventListener("click", () => {
    showTwoFaView("twofa-status-view");
    loadTwoFaStatus();
});

document.getElementById("twofa-regenerate-btn")?.addEventListener("click", async () => {
    const { ok, data } = await api.regenerateRecoveryCodes();
    if (!ok) return;
    renderRecoveryCodes(data.recoveryCodes);
    showTwoFaView("recovery-codes-view");
});

document.getElementById("twofa-disable-btn")?.addEventListener("click", () => {
    setAlert("disable-alert", "");
    document.getElementById("disable-form").reset();
    showTwoFaView("disable-form-view");
});

document.getElementById("disable-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("disable-alert", "");

    const password = document.getElementById("disable-password").value;
    const { ok } = await api.disableTwoFactor(password);

    if (!ok) {
        setAlert("disable-alert", translateI18n("common.errorGeneric"));
        return;
    }

    currentProfile.twoFactorEnabled = false;
    showTwoFaView("twofa-status-view");
    loadTwoFaStatus();
});

// ==========================================
// SESSIONS TAB
// ==========================================

async function loadSessions() {
    const { ok, data } = await api.getSessions();
    const list = document.getElementById("sessions-list");
    const empty = document.getElementById("sessions-empty");
    const countBadge = document.getElementById("sessions-count-badge");
    if (!list) return;

    list.innerHTML = "";
    userSessions = ok && data ? data : [];

    if (countBadge) {
        countBadge.textContent = userSessions.length;
        countBadge.style.display = userSessions.length > 0 ? "inline-block" : "none";
    }

    if (!userSessions.length) {
        empty.style.display = "block";
        return;
    }
    empty.style.display = "none";

    userSessions.forEach((session) => {
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
            <div class="item-row-main">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--color-brand); flex-shrink: 0;">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                <div class="item-row-text">
                    <span class="item-row-title">${escapeHtml(session.deviceName || session.userAgent || "Unknown device")}</span>
                    <span class="item-row-subtitle">${escapeHtml(session.ipAddress || "")} &middot; ${translateI18n("sessions.created")}: ${formatDate(session.createdAt)}</span>
                    <span class="item-row-subtitle">${translateI18n("sessions.lastUsed")}: ${formatLastUsed(session.lastUsedAt, session.isCurrent)}</span>
                </div>
                ${session.isCurrent ? `<span class="badge badge-success" data-i18n="sessions.current">${translateI18n("sessions.current")}</span>` : ""}
            </div>
            <div class="item-row-actions">
                ${session.isCurrent ? "" : `<button type="button" class="btn btn-danger danger btn-sm" data-revoke="${session.id}" data-i18n="sessions.revoke">${translateI18n("sessions.revoke")}</button>`}
            </div>
        `;
        list.appendChild(row);
    });

    list.querySelectorAll("[data-revoke]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-revoke");
            const { ok } = await api.revokeSession(id);
            if (ok) {
                loadSessions();
            }
        });
    });
}

document.getElementById("revoke-all-btn")?.addEventListener("click", async () => {
    await api.revokeAllSessions();
    loadSessions();
});

// ==========================================
// INTEGRATIONS TAB
// =========================================
const PROVIDERS = [
    {
        key: "telegram",
        name: "Telegram",
        color: "#229ED9",
        descKey: "integrations.telegramDesc",
        icon: `<img src="https://cdn.simpleicons.org/telegram/white" width="24" height="24" alt="Telegram" />`
    },
    {
        key: "viber",
        name: "Viber",
        color: "#7360F2",
        descKey: "integrations.viberDesc",
        icon: `<img src="https://cdn.simpleicons.org/viber/white" width="24" height="24" alt="Viber" />`
    },
    {
        key: "discord",
        name: "Discord",
        color: "#5865F2",
        descKey: "integrations.discordDesc",
        icon: `<img src="https://cdn.simpleicons.org/discord/white" width="24" height="24" alt="Discord" />`
    },
    {
        key: "whatsapp",
        name: "WhatsApp",
        color: "#25D366",
        descKey: "integrations.whatsappDesc",
        icon: `<img src="https://cdn.simpleicons.org/whatsapp/white" width="24" height="24" alt="WhatsApp" />`
    },
    {
        key: "github",
        name: "GitHub",
        color: "#24292F",
        descKey: "integrations.githubDesc",
        icon: `<img src="https://cdn.simpleicons.org/github/white" width="24" height="24" alt="GitHub" />`
    },
    {
        key: "gitlab",
        name: "GitLab",
        color: "#FC6D26",
        descKey: "integrations.gitlabDesc",
        icon: `<img src="https://cdn.simpleicons.org/gitlab/white" width="24" height="24" alt="GitLab" />`
    },
    {
        key: "google",
        name: "Google",
        color: "#4285F4",
        descKey: "integrations.googleDesc",
        icon: `<img src="https://cdn.simpleicons.org/google/white" width="24" height="24" alt="Google" />`
    },
    {
        key: "apple",
        name: "Apple",
        color: "#1C1C1E",
        descKey: "integrations.appleDesc",
        icon: `<img src="https://cdn.simpleicons.org/apple/white" width="24" height="24" alt="Apple" />`
    },
    {
        key: "meta",
        name: "Meta",
        color: "#0081FB",
        descKey: "integrations.metaDesc",
        icon: `<img src="https://cdn.simpleicons.org/meta/white" width="24" height="24" alt="Meta" />`
    },
    {
        key: "linkedin",
        name: "LinkedIn",
        color: "#0A66C2",
        descKey: "integrations.linkedinDesc",
        icon: `<img src="https://www.svgrepo.com/show/93637/linkedin-logo.svg" width="24" height="24" alt="LinkedIn" />`
    },
    {
        key: "slack",
        name: "Slack",
        color: "#4A154B",
        descKey: "integrations.slackDesc",
        icon: `<img src="https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/250px-Slack_icon_2019.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail&_=20200128081203" width="24" height="24" alt="Slack" />`
    }
];

async function loadIntegrations() {
    const { ok, data } = await api.getIntegrations();
    userIntegrations = ok && data ? data : [];
    renderIntegrations();
}

function renderIntegrations() {
    const grid = document.getElementById("integrations-grid");
    const countBadge = document.getElementById("integrations-count-badge");
    const searchVal = (document.getElementById("integrations-search")?.value || "").trim().toLowerCase();
    if (!grid) return;

    grid.innerHTML = "";

    const connectedMap = new Map();
    userIntegrations.forEach((item) => {
        connectedMap.set(item.provider.toLowerCase(), item);
    });

    if (countBadge) {
        countBadge.textContent = `${connectedMap.size}/${PROVIDERS.length}`;
        countBadge.style.display = connectedMap.size > 0 ? "inline-block" : "none";
    }

    const filtered = PROVIDERS.filter((p) => {
        if (!searchVal) return true;
        const nameMatch = p.name.toLowerCase().includes(searchVal);
        const descMatch = (translateI18n(p.descKey) || "").toLowerCase().includes(searchVal);
        return nameMatch || descMatch;
    });

    filtered.forEach((p) => {
        const connected = connectedMap.get(p.key.toLowerCase());
        const isConn = !!connected;

        const card = document.createElement("div");
        card.className = `integration-card ${isConn ? "is-connected" : ""}`;
        card.innerHTML = `
            <div class="integration-card-top">
                <div class="integration-card-icon" style="background-color: ${p.color};">
                    ${p.icon}
                </div>
                <div class="integration-card-info">
                    <div class="integration-card-title">
                        <span>${p.name}</span>
                        ${isConn ? `<span class="badge badge-success" data-i18n="integrations.connected">${translateI18n("integrations.connected")}</span>` : `<span class="badge" style="opacity: 0.7;" data-i18n="integrations.notConnected">${translateI18n("integrations.notConnected")}</span>`}
                    </div>
                    <div class="integration-card-desc" data-i18n="${p.descKey}">
                        ${translateI18n(p.descKey)}
                    </div>
                </div>
            </div>
            <div class="integration-card-bottom">
                <span class="integration-account-id">${isConn ? escapeHtml(connected.accountIdentifier || translateI18n("integrations.connected")) : ""}</span>
                <div>
                    ${isConn
                ? `<button type="button" class="btn btn-danger danger btn-sm" data-disconnect="${p.key}">${translateI18n("integrations.disconnect")}</button>`
                : `<button type="button" class="btn btn-secondary btn-sm" data-connect="${p.key}">${translateI18n("integrations.connect")}</button>`}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    grid.querySelectorAll("[data-connect]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const providerKey = btn.getAttribute("data-connect");
            openIntegrationModal(providerKey);
        });
    });

    grid.querySelectorAll("[data-disconnect]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const providerKey = btn.getAttribute("data-disconnect");
            const provider = PROVIDERS.find((p) => p.key === providerKey);
            const name = provider ? provider.name : providerKey;

            if (!confirm(translateI18n("integrations.disconnectConfirm").replace("{service}", name))) {
                return;
            }

            const { ok } = await api.disconnectIntegration(providerKey);
            if (ok) {
                userIntegrations = userIntegrations.filter((i) => i.provider.toLowerCase() !== providerKey.toLowerCase());
                renderIntegrations();
                setAlert("integrations-alert", translateI18n("integrations.disconnectedSuccess"), true);
                setTimeout(() => setAlert("integrations-alert", ""), 4000);
            }
        });
    });
}

document.getElementById("integrations-search")?.addEventListener("input", () => {
    renderIntegrations();
});

// Modal: Connect integration
function openIntegrationModal(providerKey) {
    const provider = PROVIDERS.find((p) => p.key === providerKey);
    if (!provider) return;

    setAlert("integration-modal-alert", "");
    document.getElementById("integration-provider-input").value = provider.key;
    document.getElementById("integration-modal-provider-name").textContent = provider.name;
    document.getElementById("integration-modal-provider-desc").textContent = translateI18n(provider.descKey);

    const iconBox = document.getElementById("integration-modal-icon");
    iconBox.style.backgroundColor = provider.color;
    iconBox.innerHTML = provider.icon;

    const input = document.getElementById("integration-account-input");
    input.value = "";
    input.placeholder = provider.key === "telegram" ? "@username" : (provider.key === "github" ? "github-username" : "account identifier");

    document.getElementById("integration-modal").style.display = "flex";
    input.focus();
}

function closeIntegrationModal() {
    document.getElementById("integration-modal").style.display = "none";
}

document.getElementById("integration-modal-close")?.addEventListener("click", closeIntegrationModal);
document.getElementById("integration-modal-cancel")?.addEventListener("click", closeIntegrationModal);

document.getElementById("integration-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "integration-modal") {
        closeIntegrationModal();
    }
});

document.getElementById("integration-modal-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("integration-modal-alert", "");

    const provider = document.getElementById("integration-provider-input").value;
    const accountIdentifier = document.getElementById("integration-account-input").value.trim();

    if (!accountIdentifier) {
        setAlert("integration-modal-alert", translateI18n("common.required"));
        return;
    }

    const { ok, data } = await api.updateIntegration({ provider, accountIdentifier });
    if (!ok) {
        setAlert("integration-modal-alert", typeof data === "string" ? data : translateI18n("common.errorGeneric"));
        return;
    }

    const existingIndex = userIntegrations.findIndex((i) => i.provider.toLowerCase() === provider.toLowerCase());
    if (existingIndex >= 0) {
        userIntegrations[existingIndex] = data;
    } else {
        userIntegrations.push(data);
    }

    closeIntegrationModal();
    renderIntegrations();
    setAlert("integrations-alert", translateI18n("integrations.connectedSuccess"), true);
    setTimeout(() => setAlert("integrations-alert", ""), 4000);
});

// ==========================================
// INITIALIZATION
// ==========================================

async function loadProfile() {
    const { ok, data } = await api.getMe();
    if (!ok) return;

    currentProfile = data;
    renderHeader();
    fillForm();
    renderContacts();
    renderSkills();
    loadTwoFaStatus();
}

async function init() {
    await loadProfile();
    await loadSkillsCatalog();
    initTabFromUrl();
}

init();
