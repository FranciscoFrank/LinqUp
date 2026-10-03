async function loadSessions() {
    const { ok, data } = await api.getSessions();
    const list = document.getElementById("sessions-list");
    const empty = document.getElementById("sessions-empty");
    list.innerHTML = "";

    if (!ok || !data.length) {
        empty.style.display = "block";
        return;
    }
    empty.style.display = "none";

    data.forEach((session) => {
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
            <div class="item-row-main">
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

document.getElementById("revoke-all-btn").addEventListener("click", async () => {
    await api.revokeAllSessions();
    loadSessions();
});

loadSessions();
