const twoFaViews = ["twofa-status-view", "twofa-setup-view", "recovery-codes-view", "disable-form-view"];

function showTwoFaView(id) {
    twoFaViews.forEach((v) => {
        const el = document.getElementById(v);
        if (el) el.style.display = v === id ? "block" : "none";
    });
}

function setAlert(id, message) {
    document.getElementById(id).textContent = message || "";
}

async function loadStatus() {
    const { data } = await api.getMe();
    const badge = document.getElementById("twofa-status-badge");
    const enableBtn = document.getElementById("twofa-enable-btn");
    const disableBlock = document.getElementById("twofa-disable-block");

    if (data.twoFactorEnabled) {
        badge.textContent = translateI18n("security.enabled");
        badge.className = "badge badge-success";
        enableBtn.style.display = "none";
        disableBlock.style.display = "block";
    } else {
        badge.textContent = translateI18n("security.disabled");
        badge.className = "badge badge-warning";
        enableBtn.style.display = "block";
        disableBlock.style.display = "none";
    }
}

document.getElementById("twofa-enable-btn").addEventListener("click", async () => {
    const { ok, data } = await api.setupTwoFactor();
    if (!ok) return;

    document.getElementById("qr-box").innerHTML = "";
    new QRCode(document.getElementById("qr-box"), {
        text: data.otpauthUri,
        width: 180,
        height: 180
    });
    document.getElementById("manual-key").textContent = data.manualEntryKey;
    setAlert("setup-alert", "");
    document.getElementById("setup-form").reset();
    showTwoFaView("twofa-setup-view");
});

document.getElementById("setup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("setup-alert", "");

    const code = document.getElementById("setup-code").value.trim();
    const { ok, data } = await api.enableTwoFactor(code);

    if (!ok) {
        setAlert("setup-alert", translateI18n("auth.errorCode"));
        return;
    }

    renderRecoveryCodes(data.recoveryCodes);
    showTwoFaView("recovery-codes-view");
});

let currentRecoveryCodes = [];

function renderRecoveryCodes(codes) {
    currentRecoveryCodes = codes || [];
    const grid = document.getElementById("recovery-codes-grid");
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

document.getElementById("recovery-done-btn").addEventListener("click", () => {
    showTwoFaView("twofa-status-view");
    loadStatus();
});

document.getElementById("twofa-regenerate-btn").addEventListener("click", async () => {
    const { ok, data } = await api.regenerateRecoveryCodes();
    if (!ok) return;
    renderRecoveryCodes(data.recoveryCodes);
    showTwoFaView("recovery-codes-view");
});

document.getElementById("twofa-disable-btn").addEventListener("click", () => {
    setAlert("disable-alert", "");
    document.getElementById("disable-form").reset();
    showTwoFaView("disable-form-view");
});

document.getElementById("disable-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("disable-alert", "");

    const password = document.getElementById("disable-password").value;
    const { ok } = await api.disableTwoFactor(password);

    if (!ok) {
        setAlert("disable-alert", translateI18n("common.errorGeneric"));
        return;
    }

    showTwoFaView("twofa-status-view");
    loadStatus();
});

loadStatus();
