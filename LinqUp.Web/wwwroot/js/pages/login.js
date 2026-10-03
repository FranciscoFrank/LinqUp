function getDeviceName() {
    const match = navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/);
    const browser = match ? match[0].split("/")[0] : "Browser";
    return `Web · ${browser}`;
}

let twoFactorToken = null;
let isRecoveryMode = false;

function showAlert(id, message, isSuccess = false) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!message) {
        el.textContent = "";
        el.style.display = "none";
        return;
    }
    el.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${isSuccess 
                ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
                : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
        </svg>
        <span>${message}</span>
    `;
    el.style.display = "flex";
}

function goToStep(id) {
    document.querySelectorAll(".step").forEach((el) => el.classList.remove("is-active"));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add("is-active");
        const firstInput = target.querySelector("input:not([type=hidden])");
        if (firstInput) firstInput.focus();
    }
}

function completeLogin(data) {
    setTokens(data);
    location.href = withCulture("/profile/me");
}

document.getElementById("register-link").href = withCulture("/auth/register");
const forgotLink = document.getElementById("forgot-password-link");
if (forgotLink) {
    forgotLink.href = withCulture("/auth/forgot-password");
}

if (new URLSearchParams(location.search).get("registered") === "1") {
    showAlert("login-success", translateI18n("auth.registerSuccess"), true);
}

// Password toggle functionality
document.querySelectorAll(".btn-password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        const input = document.getElementById(targetId);
        if (!input) return;

        const isPassword = input.getAttribute("type") === "password";
        input.setAttribute("type", isPassword ? "text" : "password");

        const eye = btn.querySelector(".icon-eye");
        const eyeOff = btn.querySelector(".icon-eye-off");

        if (eye && eyeOff) {
            eye.style.display = isPassword ? "none" : "";
            eyeOff.style.display = isPassword ? "" : "none";
        }

        const labelKey = isPassword ? "auth.hidePassword" : "auth.showPassword";
        btn.setAttribute("aria-label", translateI18n(labelKey));
        btn.setAttribute("title", translateI18n(labelKey));
    });
});

// Social login stub handlers
document.getElementById("google-login-btn")?.addEventListener("click", () => {
    showAlert("login-alert", translateI18n("auth.socialComingSoon"));
});
document.getElementById("github-login-btn")?.addEventListener("click", () => {
    showAlert("login-alert", translateI18n("auth.socialComingSoon"));
});

// Back from 2FA
document.getElementById("twofa-back-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    showAlert("twofa-alert", "");
    goToStep("step-credentials");
});

// 2FA code input formatting
const codeInput = document.getElementById("code");
if (codeInput) {
    codeInput.addEventListener("input", (e) => {
        if (!isRecoveryMode) {
            e.target.value = e.target.value.replace(/[^0-9]/g, "");
        }
    });
}

const loginSubmitBtn = document.getElementById("login-submit");

document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    withLoading(loginSubmitBtn, async () => {
        showAlert("login-alert", "");

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const { ok, status, data } = await api.login({ email, password, deviceName: getDeviceName() });

        if (!ok) {
            const key = status === 423 ? "auth.errorLocked" : "auth.errorInvalid";
            showAlert("login-alert", translateI18n(key));
            return;
        }

        if (data.requiresTwoFactor) {
            twoFactorToken = data.twoFactorToken;
            goToStep("step-2fa");
            setTimeout(() => {
                totpInputs[0]?.focus();
            }, 60);
            return;
        }

        completeLogin(data);
    })();
});

const twofaSubmitBtn = document.getElementById("twofa-submit");
const totpContainer = document.getElementById("totp-input-container");
const recoveryContainer = document.getElementById("recovery-input-container");
const totpInputs = Array.from(document.querySelectorAll(".otp-digit-input"));
const recoveryInputs = Array.from(document.querySelectorAll(".recovery-block-input"));
const twofaAlert = document.getElementById("twofa-alert");
const twofaTitle = document.getElementById("twofa-title");
const twofaSubtitle = document.getElementById("twofa-subtitle");

function setupTwoFactorInputs() {
    // 6-digit TOTP input handlers (Item 30)
    totpInputs.forEach((input, idx) => {
        input.addEventListener("input", (e) => {
            const val = e.target.value.replace(/\D/g, "");
            e.target.value = val ? val[0] : "";
            e.target.classList.toggle("has-value", !!e.target.value);

            if (e.target.value && idx < totpInputs.length - 1) {
                totpInputs[idx + 1].focus();
            }

            checkAndAutoSubmit();
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !input.value && idx > 0) {
                totpInputs[idx - 1].focus();
            } else if (e.key === "ArrowLeft" && idx > 0) {
                totpInputs[idx - 1].focus();
            } else if (e.key === "ArrowRight" && idx < totpInputs.length - 1) {
                totpInputs[idx + 1].focus();
            }
        });

        input.addEventListener("paste", (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData("text");
            const digits = pasteData.replace(/\D/g, "").slice(0, 6);
            if (!digits) return;

            digits.split("").forEach((d, i) => {
                if (i < totpInputs.length) {
                    totpInputs[i].value = d;
                    totpInputs[i].classList.add("has-value");
                }
            });

            const nextFocusIndex = Math.min(digits.length, totpInputs.length - 1);
            totpInputs[nextFocusIndex].focus();
            checkAndAutoSubmit();
        });
    });

    // 3-block Recovery code handlers (Item 31)
    recoveryInputs.forEach((input, idx) => {
        input.addEventListener("input", (e) => {
            let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
            e.target.value = val;
            e.target.classList.toggle("has-value", !!val);

            if (val.length === 4 && idx < recoveryInputs.length - 1) {
                recoveryInputs[idx + 1].focus();
            }

            checkAndAutoSubmit();
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !input.value && idx > 0) {
                recoveryInputs[idx - 1].focus();
            } else if (e.key === "ArrowLeft" && idx > 0) {
                recoveryInputs[idx - 1].focus();
            } else if (e.key === "ArrowRight" && idx < recoveryInputs.length - 1) {
                recoveryInputs[idx + 1].focus();
            }
        });

        input.addEventListener("paste", (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData("text");
            const clean = pasteData.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
            if (!clean) return;

            for (let i = 0; i < 3; i++) {
                const part = clean.slice(i * 4, (i + 1) * 4);
                if (recoveryInputs[i]) {
                    recoveryInputs[i].value = part;
                    recoveryInputs[i].classList.toggle("has-value", !!part);
                }
            }

            const filledCount = Math.floor(clean.length / 4);
            const nextIdx = Math.min(filledCount, recoveryInputs.length - 1);
            recoveryInputs[nextIdx].focus();
            checkAndAutoSubmit();
        });
    });
}

function getEnteredCode() {
    if (isRecoveryMode) {
        const parts = recoveryInputs.map(i => i.value.trim());
        if (parts.every(p => p.length === 4)) {
            return parts.join("-");
        }
        return "";
    } else {
        const digits = totpInputs.map(i => i.value.trim()).join("");
        if (digits.length === 6) {
            return digits;
        }
        return "";
    }
}

function checkAndAutoSubmit() {
    const code = getEnteredCode();
    if (code) {
        submitTwoFactorForm();
    }
}

let isSubmittingTwoFa = false;

async function submitTwoFactorForm() {
    if (isSubmittingTwoFa) return;

    const code = getEnteredCode();
    if (!code) {
        showAlert("twofa-alert", translateI18n("auth.errorCode"));
        return;
    }

    isSubmittingTwoFa = true;
    showAlert("twofa-alert", "");

    await withLoading(twofaSubmitBtn, async () => {
        try {
            const { ok, data } = await api.loginTwoFactor({
                twoFactorToken,
                code,
                isRecoveryCode: isRecoveryMode,
                deviceName: getDeviceName()
            });

            if (!ok) {
                // Non-blocking error feedback (Item 32)
                showAlert("twofa-alert", translateI18n("auth.errorCode"));

                const activeRow = isRecoveryMode ? recoveryContainer : totpContainer;
                if (activeRow) {
                    activeRow.classList.remove("is-invalid-shake");
                    void activeRow.offsetWidth;
                    activeRow.classList.add("is-invalid-shake");
                    setTimeout(() => activeRow.classList.remove("is-invalid-shake"), 500);
                }

                if (isRecoveryMode) {
                    recoveryInputs.forEach(i => { i.value = ""; i.classList.remove("has-value"); });
                    recoveryInputs[0]?.focus();
                } else {
                    totpInputs.forEach(i => { i.value = ""; i.classList.remove("has-value"); });
                    totpInputs[0]?.focus();
                }
                return;
            }

            completeLogin(data);
        } finally {
            isSubmittingTwoFa = false;
        }
    })();
}

setupTwoFactorInputs();

document.getElementById("twofa-form").addEventListener("submit", (e) => {
    e.preventDefault();
    submitTwoFactorForm();
});

document.getElementById("toggle-recovery-mode").addEventListener("click", (e) => {
    e.preventDefault();
    isRecoveryMode = !isRecoveryMode;

    const toggle = document.getElementById("toggle-recovery-mode");
    const lang = getLang();

    toggle.textContent = isRecoveryMode ? translateI18n("auth.useCode", lang) : translateI18n("auth.useRecovery", lang);
    toggle.removeAttribute("data-i18n");

    if (twofaSubtitle) {
        twofaSubtitle.textContent = isRecoveryMode
            ? translateI18n("auth.recoverySubtitle", lang)
            : translateI18n("auth.twoFaSubtitle", lang);
    }

    if (isRecoveryMode) {
        if (totpContainer) totpContainer.style.display = "none";
        if (recoveryContainer) recoveryContainer.style.display = "block";
        recoveryInputs.forEach(i => { i.value = ""; i.classList.remove("has-value"); });
        setTimeout(() => recoveryInputs[0]?.focus(), 50);
    } else {
        if (recoveryContainer) recoveryContainer.style.display = "none";
        if (totpContainer) totpContainer.style.display = "block";
        totpInputs.forEach(i => { i.value = ""; i.classList.remove("has-value"); });
        setTimeout(() => totpInputs[0]?.focus(), 50);
    }
    showAlert("twofa-alert", "");
});
