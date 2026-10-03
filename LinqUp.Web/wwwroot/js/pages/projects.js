(function () {
    "use strict";

    let currentTab = "all";
    const projectsGrid = document.getElementById("projects-grid");
    const projectsLoading = document.getElementById("projects-loading");
    const projectsEmpty = document.getElementById("projects-empty");
    const projectsAlert = document.getElementById("projects-alert");

    const searchInput = document.getElementById("projects-search-input");
    const skillInput = document.getElementById("projects-skill-filter");
    const searchBtn = document.getElementById("projects-search-btn");
    const resetBtn = document.getElementById("projects-reset-btn");

    const tabAll = document.getElementById("tab-all-projects");
    const tabMy = document.getElementById("tab-my-projects");

    const createModal = document.getElementById("create-project-modal");
    const openCreateBtn = document.getElementById("open-create-modal-btn");
    const closeCreateBtn = document.getElementById("close-create-modal-btn");
    const cancelCreateBtn = document.getElementById("cancel-create-btn");
    const createForm = document.getElementById("create-project-form");
    const createAlert = document.getElementById("create-project-alert");
    const submitCreateBtn = document.getElementById("submit-create-btn");



    async function loadProjects() {
        projectsLoading.style.display = "block";
        projectsGrid.style.display = "none";
        projectsEmpty.style.display = "none";
        projectsAlert.style.display = "none";

        const culture = getLang();
        const search = searchInput ? searchInput.value.trim() : "";
        const skill = skillInput ? skillInput.value.trim() : "";

        let endpoint = currentTab === "my" ? "/api/projects/my" : "/api/projects";
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (skill) params.append("skill", skill);

        const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;

        try {
            const res = await apiFetch(url, { method: "GET" });
            if (!res.ok) {
                if (res.status === 401 && currentTab === "my") {
                    window.location.href = `/${culture}/Auth/Login`;
                    return;
                }
                throw new Error(translateI18n("teams.errorLoad", culture));
            }

            const projects = await res.json();
            projectsLoading.style.display = "none";

            if (!projects || projects.length === 0) {
                projectsEmpty.style.display = "block";
                return;
            }

            projectsGrid.innerHTML = "";
            projectsGrid.style.display = "grid";

            projects.forEach(project => {
                const card = createProjectCard(project, culture);
                projectsGrid.appendChild(card);
            });
        } catch (err) {
            projectsLoading.style.display = "none";
            projectsAlert.textContent = err.message || translateI18n("common.errorGeneric", culture);
            projectsAlert.style.display = "block";
        }
    }

    function createProjectCard(p, culture) {
        const div = document.createElement("div");
        div.className = "card project-card";
        div.style.padding = "20px";
        div.style.display = "flex";
        div.style.flexDirection = "column";
        div.style.justifyContent = "space-between";
        div.style.transition = "transform 0.2s ease, border-color 0.2s ease";

        const skills = (p.requiredSkills || "")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);

        const skillsHtml = skills.length > 0
            ? skills.map(s => `<span class="badge badge-secondary" style="font-size: 11px;">${escapeHtml(s)}</span>`).join(" ")
            : `<span style="font-size: 12px; color: var(--color-text-muted);">${translateI18n("teams.noSkills", culture)}</span>`;

        const avatarUrl = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(p.creatorAvatarPath) : p.creatorAvatarPath;
        const initial = escapeHtml((p.creatorNickname || p.creatorFullName || "?")[0].toUpperCase());
        const creatorAvatar = avatarUrl
            ? `<div class="avatar avatar-xs" style="background-image: url('${escapeHtml(avatarUrl)}');"></div>`
            : `<div class="avatar avatar-xs">${initial}</div>`;

        let statusClass = "badge-primary";
        if (p.status === "Active") statusClass = "badge-success";
        if (p.status === "Completed") statusClass = "badge-secondary";

        const statusLabel = translateI18n("teams.status" + p.status, culture) || p.status;
        const memberText = translateI18n("teams.memberBadge", culture);
        const roleText = p.userRole ? escapeHtml(p.userRole) : memberText;
        const isMemberBadge = p.isUserMember
            ? `<span class="badge badge-success" style="font-size: 11px; margin-left: 6px;">${memberText} (${roleText})</span>`
            : "";

        const projectInitial = escapeHtml((p.title || "P")[0].toUpperCase());
        const logoHtml = p.logoUrl
            ? `<img src="${escapeHtml(resolveMediaUrl(p.logoUrl))}" class="project-card-logo" alt="${escapeHtml(p.title)}" />`
            : `<div class="project-card-icon">${projectInitial}</div>`;

        const matchBadgeHtml = (!p.isUserMember && p.matchPercentage > 0)
            ? `<span class="badge badge-success project-card-match-badge">${p.matchPercentage}% Match</span>`
            : "";

        const actionLabel = p.isUserMember ? translateI18n("teams.openWorkspace", culture) : translateI18n("teams.viewTeam", culture);

        div.innerHTML = `
            <div>
                <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px;">
                    ${logoHtml}
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                            <h3 style="margin: 0; font-size: 17px; font-weight: 600; line-height: 1.3;">
                                <a href="/${culture}/Projects/${p.id}" style="color: var(--color-text-primary); text-decoration: none;">
                                    ${escapeHtml(p.title)}
                                </a>
                            </h3>
                            <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
                                ${matchBadgeHtml}
                                <span class="badge ${statusClass}" style="font-size: 11px;">${escapeHtml(statusLabel)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <p style="color: var(--color-text-secondary); font-size: 13px; line-height: 1.5; margin-bottom: 14px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                    ${escapeHtml(p.description)}
                </p>

                <div style="margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 6px;">
                    ${skillsHtml}
                </div>
            </div>

            <div style="border-top: 1px solid var(--color-border); padding-top: 14px; margin-top: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${creatorAvatar}
                        <span style="color: var(--color-text-muted);">@${escapeHtml(p.creatorNickname || "user")}</span>
                        ${isMemberBadge}
                    </div>
                    <div style="font-weight: 600; color: var(--color-brand);">
                        ${p.currentMembersCount} / ${p.maxMembers}
                    </div>
                </div>

                <a href="/${culture}/Projects/${p.id}" class="btn btn-secondary btn-sm" style="width: 100%; text-align: center; justify-content: center;">
                    ${actionLabel}
                </a>
            </div>
        `;

        return div;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Tab switching
    if (tabAll) {
        tabAll.addEventListener("click", () => {
            if (currentTab === "all") return;
            currentTab = "all";
            tabAll.classList.add("is-active");
            tabMy.classList.remove("is-active");
            loadProjects();
        });
    }

    if (tabMy) {
        tabMy.addEventListener("click", () => {
            if (currentTab === "my") return;
            currentTab = "my";
            tabMy.classList.add("is-active");
            tabAll.classList.remove("is-active");
            loadProjects();
        });
    }

    // Search and filter
    if (searchBtn) searchBtn.addEventListener("click", loadProjects);
    if (searchInput) {
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                loadProjects();
            }
        });
    }
    if (skillInput) {
        skillInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                loadProjects();
            }
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            if (skillInput) skillInput.value = "";
            loadProjects();
        });
    }

    // Modal Create Project
    if (openCreateBtn && createModal) {
        openCreateBtn.addEventListener("click", () => {
            createAlert.style.display = "none";
            createForm.reset();
            createModal.style.display = "flex";
        });
    }

    function closeCreateModal() {
        if (createModal) createModal.style.display = "none";
    }

    if (closeCreateBtn) closeCreateBtn.addEventListener("click", closeCreateModal);
    if (cancelCreateBtn) cancelCreateBtn.addEventListener("click", closeCreateModal);

    if (createForm) {
        createForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            createAlert.style.display = "none";
            const culture = getLang();

            const title = document.getElementById("project-title").value.trim();
            const description = document.getElementById("project-description").value.trim();
            const maxMembers = parseInt(document.getElementById("project-max-members").value, 10) || 5;
            const creatorRole = document.getElementById("project-creator-role").value.trim() || "Team Lead";
            const requiredSkills = document.getElementById("project-skills").value.trim();
            const repositoryUrl = document.getElementById("project-repo-url")?.value.trim() || null;

            if (!title || title.length < 3) {
                createAlert.textContent = translateI18n("teams.errorTitleLength", culture);
                createAlert.style.display = "block";
                return;
            }

            if (!description || description.length < 10) {
                createAlert.textContent = translateI18n("teams.errorDescLength", culture);
                createAlert.style.display = "block";
                return;
            }

            submitCreateBtn.disabled = true;
            submitCreateBtn.querySelector(".btn-text").style.display = "none";
            submitCreateBtn.querySelector(".btn-spinner").style.display = "inline-block";

            try {
                const { ok, data } = await apiJson("/api/projects", {
                    method: "POST",
                    body: JSON.stringify({
                        title,
                        description,
                        maxMembers,
                        creatorRole,
                        requiredSkills,
                        repositoryUrl
                    })
                });

                if (!ok) {
                    const errMsg = data?.message || (typeof data === "string" ? data : translateI18n("teams.errorCreate", culture));
                    throw new Error(errMsg);
                }

                closeCreateModal();
                window.location.href = `/${culture}/Projects/${data.id}`;
            } catch (err) {
                createAlert.textContent = err.message || translateI18n("teams.errorCreate", culture);
                createAlert.style.display = "block";
            } finally {
                submitCreateBtn.disabled = false;
                submitCreateBtn.querySelector(".btn-text").style.display = "inline-block";
                submitCreateBtn.querySelector(".btn-spinner").style.display = "none";
            }
        });
    }

    // Initial load
    loadProjects();
})();
