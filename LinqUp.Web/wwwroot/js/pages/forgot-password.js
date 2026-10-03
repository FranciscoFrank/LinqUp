document.getElementById("back-login-link").href = withCulture("/auth/login");

const form = document.getElementById("forgot-form");
const alertEl = document.getElementById("forgot-alert");
const submitBtn = document.getElementById("forgot-submit");
const successEl = document.getElementById("forgot-success");
const backWrap = document.getElementById("forgot-back-wrap");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("forgot-alert");

    const email = document.getElementById("email").value.trim();
    if (!email) {
        showAlert("forgot-alert", translateI18n("validation.emailRequired"));
        return;
    }

    if (!isValidEmail(email)) {
        showAlert("forgot-alert", translateI18n("validation.emailInvalid"));
        return;
    }

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = translateI18n("common.loading");

    try {
        const { ok, data } = await api.forgotPassword(email);
        if (ok) {
            form.style.display = "none";
            successEl.style.display = "block";
            backWrap.style.display = "none";
            const successText = document.getElementById("forgot-success-text");
            if (data?.message) {
                successText.textContent = data.message;
            }
        } else {
            const err = typeof data === "string" ? data : (data?.message || translateI18n("common.genericError"));
            showAlert("forgot-alert", err);
        }
    } catch {
        showAlert("forgot-alert", translateI18n("common.networkError"));
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});
