document.getElementById("login-link").href = withCulture("/auth/login");

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

// Social registration stub handlers
document.getElementById("google-register-btn")?.addEventListener("click", () => {
    showAlert("register-alert", translateI18n("auth.socialComingSoon"));
});
document.getElementById("github-register-btn")?.addEventListener("click", () => {
    showAlert("register-alert", translateI18n("auth.socialComingSoon"));
});

// Dynamic password checklist
const passwordInput = document.getElementById("password");
const checkmarkSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

function updateRequirement(id, isMet) {
    const el = document.getElementById(id);
    if (!el) return;
    const iconEl = el.querySelector(".req-item-icon");

    if (isMet) {
        el.classList.add("is-met");
        if (iconEl && !iconEl.innerHTML) {
            iconEl.innerHTML = checkmarkSvg;
        }
    } else {
        el.classList.remove("is-met");
        if (iconEl) {
            iconEl.innerHTML = "";
        }
    }
}

if (passwordInput) {
    passwordInput.addEventListener("input", (e) => {
        const val = e.target.value;

        updateRequirement("req-length", val.length >= 8);
        updateRequirement("req-uppercase", /[A-ZА-ЯҐЄІЇ]/.test(val));
        updateRequirement("req-number", /[0-9]/.test(val));
        updateRequirement("req-special", /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val));
    });
}

// Inline blur validation for email
const emailInput = document.getElementById("email");
if (emailInput) {
    emailInput.addEventListener("blur", () => {
        const val = emailInput.value.trim();
        const errorEl = document.querySelector('[data-error-for="email"]');
        if (!errorEl) return;

        if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            emailInput.classList.add("is-invalid");
            errorEl.textContent = translateI18n("common.errorEmailInvalid");
        } else {
            emailInput.classList.remove("is-invalid");
            errorEl.textContent = "";
        }
    });
}

const registerSubmitBtn = document.getElementById("register-submit");

document.getElementById("register-form").addEventListener("submit", (e) => {
    e.preventDefault();
    withLoading(registerSubmitBtn, async () => {
        showAlert("register-alert", "");

        const firstName = document.getElementById("firstName").value.trim();
        const lastName = document.getElementById("lastName").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!firstName || !lastName || !email || !password) {
            showAlert("register-alert", translateI18n("common.required"));
            return;
        }

        const payload = { firstName, lastName, email, password };

        const { ok, data } = await api.register(payload);

        if (!ok) {
            const message = Array.isArray(data) ? data.join(" ") : (data?.title || translateI18n("common.errorGeneric"));
            showAlert("register-alert", message);
            return;
        }

        location.href = `${withCulture("/auth/login")}?registered=1`;
    })();
});
