const params = new URLSearchParams(window.location.search);
const userId = params.get("userId");
const token = params.get("token");

const form = document.getElementById("reset-form");
const alertEl = document.getElementById("reset-alert");
const submitBtn = document.getElementById("reset-submit");
const successEl = document.getElementById("reset-success");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");

if (!userId || !token) {
    showAlert("reset-alert", translateI18n("auth.invalidResetLink") || "Посилання для відновлення паролю є недійсним або неповним.");
    form.style.display = "none";
}

const reqLength = document.getElementById("req-length");
const reqUpper = document.getElementById("req-uppercase");
const reqNum = document.getElementById("req-number");
const reqSpec = document.getElementById("req-special");

function updatePasswordChecklist(val) {
    const hasLen = val.length >= 8;
    const hasUp = /[A-Z]/.test(val);
    const hasNum = /[0-9]/.test(val);
    const hasSp = /[^a-zA-Z0-9]/.test(val);

    reqLength.classList.toggle("is-met", hasLen);
    reqUpper.classList.toggle("is-met", hasUp);
    reqNum.classList.toggle("is-met", hasNum);
    reqSpec.classList.toggle("is-met", hasSp);

    return hasLen && hasUp && hasNum && hasSp;
}

passwordInput?.addEventListener("input", (e) => {
    updatePasswordChecklist(e.target.value);
});

form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("reset-alert");

    const pass = passwordInput.value;
    const conf = confirmInput.value;

    if (!updatePasswordChecklist(pass)) {
        showAlert("reset-alert", translateI18n("validation.passwordWeak") || "Пароль не відповідає всім вимогам безпеки.");
        return;
    }

    if (pass !== conf) {
        showAlert("reset-alert", translateI18n("validation.passwordsMismatch") || "Паролі не співпадають.");
        return;
    }

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = translateI18n("common.loading");

    try {
        const { ok, data } = await api.resetPassword({
            userId,
            token,
            newPassword: pass
        });

        if (ok) {
            form.style.display = "none";
            successEl.style.display = "block";
            const successText = document.getElementById("reset-success-text");
            if (data?.message) {
                successText.textContent = data.message;
            }
        } else {
            const err = typeof data === "string" ? data : (data?.message || translateI18n("common.genericError"));
            showAlert("reset-alert", err);
        }
    } catch {
        showAlert("reset-alert", translateI18n("common.networkError"));
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});
