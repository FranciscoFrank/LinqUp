document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("userId");
    const token = params.get("token");

    const loadingEl = document.getElementById("confirm-loading");
    const alertEl = document.getElementById("confirm-alert");
    const successEl = document.getElementById("confirm-success");
    const retryEl = document.getElementById("confirm-retry");
    const subtitleEl = document.getElementById("confirm-status-subtitle");

    if (!userId || !token) {
        loadingEl.style.display = "none";
        showAlert("confirm-alert", translateI18n("auth.invalidConfirmLink") || "Посилання для підтвердження email є недійсним або неповним.");
        retryEl.style.display = "block";
        if (subtitleEl) subtitleEl.textContent = "";
        return;
    }

    try {
        const { ok, data } = await api.confirmEmail({ userId, token });
        loadingEl.style.display = "none";

        if (ok) {
            successEl.style.display = "block";
            if (subtitleEl) subtitleEl.style.display = "none";
        } else {
            const err = typeof data === "string" ? data : (data?.message || translateI18n("auth.confirmEmailFailed") || "Не вдалося підтвердити email адресу.");
            showAlert("confirm-alert", err);
            retryEl.style.display = "block";
            if (subtitleEl) subtitleEl.textContent = "";
        }
    } catch {
        loadingEl.style.display = "none";
        showAlert("confirm-alert", translateI18n("common.networkError"));
        retryEl.style.display = "block";
        if (subtitleEl) subtitleEl.textContent = "";
    }
});
