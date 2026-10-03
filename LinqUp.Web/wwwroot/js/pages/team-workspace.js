(function () {
    "use strict";

    const workspacePage = document.querySelector(".team-workspace-page");
    if (!workspacePage) return;

    const projectId = workspacePage.dataset.projectId;
    if (!projectId) return;

    const projectTitle = document.getElementById("project-title");
    const projectStatusBadge = document.getElementById("project-status-badge");
    const projectDescription = document.getElementById("project-description");
    const projectSkillsList = document.getElementById("project-skills-list");
    const projectMembersCount = document.getElementById("project-members-count");
    const projectMembershipState = document.getElementById("project-membership-state");
    const projectHeaderActions = document.getElementById("project-header-actions");

    const teamMembersList = document.getElementById("team-members-list");
    const membersCountBadge = document.getElementById("members-count-badge");

    const joinRequestsCard = document.getElementById("join-requests-card");
    const joinRequestsList = document.getElementById("join-requests-list");
    const requestsCountBadge = document.getElementById("requests-count-badge");

    const teamManagementCard = document.getElementById("team-management-card");
    const openEditBtn = document.getElementById("open-edit-project-modal-btn");
    const leaveTeamBtn = document.getElementById("leave-team-btn");

    const chatLockOverlay = document.getElementById("chat-lock-overlay");
    const openJoinOverlayBtn = document.getElementById("open-join-modal-overlay-btn");

    const joinModal = document.getElementById("join-project-modal");
    const closeJoinBtn = document.getElementById("close-join-modal-btn");
    const cancelJoinBtn = document.getElementById("cancel-join-btn");
    const joinForm = document.getElementById("join-project-form");
    const joinAlert = document.getElementById("join-project-alert");

    const editModal = document.getElementById("edit-project-modal");
    const closeEditBtn = document.getElementById("close-edit-modal-btn");
    const cancelEditBtn = document.getElementById("cancel-edit-btn");
    const editForm = document.getElementById("edit-project-form");
    const editAlert = document.getElementById("edit-project-alert");

    const workspaceAlert = document.getElementById("workspace-alert");
    const workspaceSuccess = document.getElementById("workspace-success");

    let currentProjectData = null;



    function showSuccess(msg) {
        if (!workspaceSuccess) return;
        workspaceSuccess.textContent = msg;
        workspaceSuccess.style.display = "block";
        setTimeout(() => { workspaceSuccess.style.display = "none"; }, 4000);
    }

    function showError(msg) {
        if (!workspaceAlert) return;
        workspaceAlert.textContent = msg;
        workspaceAlert.style.display = "block";
        setTimeout(() => { workspaceAlert.style.display = "none"; }, 5000);
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

    async function loadProjectDetails() {
        const culture = getLang();
        try {
            const res = await apiFetch(`/api/projects/${projectId}`, { method: "GET" });
            if (!res.ok) {
                if (res.status === 404) {
                    showError(translateI18n("teams.projectNotFound", culture));
                    return;
                }
                throw new Error(translateI18n("teams.errorLoad", culture));
            }

            const data = await res.json();
            currentProjectData = data;
            renderWorkspace(data);

            // Expose project data to chat script
            window.LinqUpTeamWorkspace = {
                projectId: data.id,
                isMember: data.isUserMember,
                members: data.members
            };

            // Trigger custom event for chat component
            window.dispatchEvent(new CustomEvent("linqup:project-loaded", { detail: data }));
        } catch (err) {
            showError(err.message || translateI18n("teams.errorLoad", culture));
        }
    }

    function renderWorkspace(p) {
        const culture = getLang();
        if (projectTitle) projectTitle.textContent = p.title;
        if (projectDescription) projectDescription.textContent = p.description;

        const sidebarTitle = document.getElementById("sidebar-project-title");
        if (sidebarTitle) sidebarTitle.textContent = p.title;

        const sidebarMeta = document.getElementById("sidebar-project-meta");
        if (sidebarMeta) {
            sidebarMeta.textContent = `${p.members.length} / ${p.maxMembers} ${translateI18n("teams.teamMembers", culture)}`;
        }

        // Logo in hero and sidebar
        const logoImg = document.getElementById("project-logo-img");
        const logoFallback = document.getElementById("project-logo-fallback");
        const sidebarLogo = document.getElementById("sidebar-project-logo");
        const sidebarFallback = document.getElementById("sidebar-project-fallback");
        const initial = (p.title || "?")[0].toUpperCase();

        if (p.logoUrl) {
            const resolvedLogo = resolveMediaUrl(p.logoUrl);
            if (logoImg) {
                logoImg.src = resolvedLogo;
                logoImg.style.display = "block";
            }
            if (logoFallback) logoFallback.style.display = "none";

            if (sidebarLogo) {
                sidebarLogo.src = resolvedLogo;
                sidebarLogo.style.display = "block";
            }
            if (sidebarFallback) sidebarFallback.style.display = "none";
        } else {
            if (logoImg) logoImg.style.display = "none";
            if (logoFallback) {
                logoFallback.textContent = initial;
                logoFallback.style.display = "flex";
            }
            if (sidebarLogo) sidebarLogo.style.display = "none";
            if (sidebarFallback) {
                sidebarFallback.textContent = initial;
                sidebarFallback.style.display = "flex";
            }
        }

        // Match Percentage badge in hero for non-members
        const matchBadge = document.getElementById("project-match-badge");
        if (matchBadge) {
            if (!p.isUserMember && p.matchPercentage > 0) {
                matchBadge.textContent = `${p.matchPercentage}% Match`;
                matchBadge.style.display = "inline-flex";
            } else {
                matchBadge.style.display = "none";
            }
        }

        // Status badge
        if (projectStatusBadge) {
            const statusText = translateI18n("teams.status" + p.status, culture) || p.status;
            projectStatusBadge.textContent = statusText;
            projectStatusBadge.className = `badge ${p.status === "Active" ? "badge-success" : p.status === "Completed" ? "badge-secondary" : "badge-primary"}`;
        }

        // Members meter
        if (projectMembersCount) {
            projectMembersCount.textContent = `${p.members.length} / ${p.maxMembers}`;
        }

        // Skills list
        if (projectSkillsList) {
            projectSkillsList.innerHTML = "";
            const skills = (p.requiredSkills || "").split(",").map(s => s.trim()).filter(Boolean);
            if (skills.length > 0) {
                skills.forEach(skill => {
                    const sp = document.createElement("span");
                    sp.className = "badge badge-secondary";
                    sp.style.fontSize = "12px";
                    sp.textContent = skill;
                    projectSkillsList.appendChild(sp);
                });
            }
        }

        // Membership state in hero
        if (projectMembershipState) {
            projectMembershipState.innerHTML = "";
            if (p.isUserMember) {
                const roleBadge = document.createElement("span");
                roleBadge.className = "badge badge-success";
                const memberText = translateI18n("teams.memberBadge", culture);
                const roleText = p.isUserLeader 
                    ? translateI18n("teams.roleLeader", culture) 
                    : (p.userRole ? `${memberText} (${escapeHtml(p.userRole)})` : memberText);
                roleBadge.textContent = roleText;
                projectMembershipState.appendChild(roleBadge);
            } else if (p.hasPendingJoinRequest) {
                const pendingBadge = document.createElement("span");
                pendingBadge.className = "badge badge-warning";
                pendingBadge.textContent = translateI18n("teams.pendingApproval", culture);
                projectMembershipState.appendChild(pendingBadge);
            } else if (p.isLookingForMembers && p.members.length < p.maxMembers) {
                const joinBtn = document.createElement("button");
                joinBtn.className = "btn btn-primary btn-sm";
                joinBtn.textContent = translateI18n("teams.applyToJoin", culture);
                joinBtn.addEventListener("click", openJoinModal);
                projectMembershipState.appendChild(joinBtn);
            }
        }

        // Members list in sidebar
        if (teamMembersList) {
            teamMembersList.innerHTML = "";
            if (membersCountBadge) membersCountBadge.textContent = p.members.length;

            p.members.forEach(m => {
                const item = document.createElement("div");
                item.style.display = "flex";
                item.style.alignItems = "center";
                item.style.justifyContent = "space-between";
                item.style.gap = "10px";

                const mAvatarUrl = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(m.avatarPath) : m.avatarPath;
                const mInitial = escapeHtml((m.nickname || m.fullName || "?")[0].toUpperCase());
                const avatar = mAvatarUrl
                    ? `<div class="avatar avatar-sm" style="background-image: url('${escapeHtml(mAvatarUrl)}');"></div>`
                    : `<div class="avatar avatar-sm">${mInitial}</div>`;

                const leaderBadge = m.isLeader
                    ? `<span title="${escapeHtml(translateI18n("teams.roleLeader", culture))}" style="color: #f59e0b; margin-left: 4px; display: inline-flex; vertical-align: middle;"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span>`
                    : "";

                let kickBtnHtml = "";
                if (p.isUserLeader && !m.isLeader) {
                    kickBtnHtml = `
                        <button type="button" class="btn-icon btn-sm text-danger danger kick-member-btn" data-member-id="${m.id}" data-member-name="${escapeHtml(m.fullName)}" title="${escapeHtml(translateI18n("teams.kickMember", culture))}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    `;
                }

                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                        ${avatar}
                        <div style="min-width: 0;">
                            <div style="font-weight: 500; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                <a href="/${culture}/u/${escapeHtml(m.nickname)}" style="color: inherit; text-decoration: none;">
                                    ${escapeHtml(m.fullName)}
                                </a>
                                ${leaderBadge}
                            </div>
                            <div style="font-size: 12px; color: var(--color-text-muted);">
                                @${escapeHtml(m.nickname)} · <span class="badge badge-secondary" style="font-size: 10px; padding: 1px 5px;">${escapeHtml(m.role)}</span>
                            </div>
                        </div>
                    </div>
                    ${kickBtnHtml}
                `;

                teamMembersList.appendChild(item);
            });

            // Bind kick member buttons
            teamMembersList.querySelectorAll(".kick-member-btn").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const mId = btn.dataset.memberId;
                    const mName = btn.dataset.memberName;
                    if (confirm(translateI18n("teams.kickConfirm", culture, { name: mName }))) {
                        await removeMember(mId);
                    }
                });
            });
        }

        // Leader: Join requests list
        if (joinRequestsCard && joinRequestsList) {
            if (p.isUserLeader) {
                joinRequestsCard.style.display = "block";
                if (requestsCountBadge) requestsCountBadge.textContent = p.pendingRequests.length;
                joinRequestsList.innerHTML = "";

                if (p.pendingRequests.length === 0) {
                    joinRequestsList.innerHTML = `<p style="font-size: 13px; color: var(--color-text-muted); margin: 0;">${escapeHtml(translateI18n("teams.noJoinRequests", culture))}</p>`;
                } else {
                    p.pendingRequests.forEach(req => {
                        const item = document.createElement("div");
                        item.className = "card";
                        item.style.padding = "12px";
                        item.style.background = "var(--color-surface-elevated, rgba(255,255,255,0.03))";

                        const reqAvatarUrl = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(req.avatarPath) : req.avatarPath;
                        const reqInitial = escapeHtml((req.nickname || "?")[0].toUpperCase());
                        const avatar = reqAvatarUrl
                            ? `<div class="avatar avatar-xs" style="background-image: url('${escapeHtml(reqAvatarUrl)}');"></div>`
                            : `<div class="avatar avatar-xs">${reqInitial}</div>`;

                        item.innerHTML = `
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    ${avatar}
                                    <span style="font-weight: 600; font-size: 13px;">${escapeHtml(req.fullName)}</span>
                                    <span style="font-size: 11px; color: var(--color-text-muted);">@${escapeHtml(req.nickname)}</span>
                                </div>
                                <span class="badge badge-primary" style="font-size: 10px;">${escapeHtml(req.requestedRole)}</span>
                            </div>
                            ${req.coverMessage ? `<p style="font-size: 12px; color: var(--color-text-secondary); margin: 6px 0 10px; line-height: 1.4;">${escapeHtml(req.coverMessage)}</p>` : ""}
                            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                                <button type="button" class="btn btn-ghost btn-sm text-danger danger reject-request-btn" data-req-id="${req.id}">
                                    ${escapeHtml(translateI18n("teams.reject", culture))}
                                </button>
                                <button type="button" class="btn btn-primary btn-sm accept-request-btn" data-req-id="${req.id}" data-role="${escapeHtml(req.requestedRole)}">
                                    ${escapeHtml(translateI18n("teams.accept", culture))}
                                </button>
                            </div>
                        `;

                        joinRequestsList.appendChild(item);
                    });

                    // Bind accept/reject buttons
                    joinRequestsList.querySelectorAll(".accept-request-btn").forEach(btn => {
                        btn.addEventListener("click", () => respondToRequest(btn.dataset.reqId, true, btn.dataset.role));
                    });
                    joinRequestsList.querySelectorAll(".reject-request-btn").forEach(btn => {
                        btn.addEventListener("click", () => respondToRequest(btn.dataset.reqId, false));
                    });
                }
            } else {
                joinRequestsCard.style.display = "none";
            }
        }

        // Management controls
        if (teamManagementCard) {
            if (p.isUserMember) {
                teamManagementCard.style.display = "block";
                if (openEditBtn) openEditBtn.style.display = p.isUserLeader ? "block" : "none";
                if (leaveTeamBtn) leaveTeamBtn.style.display = !p.isUserLeader ? "block" : "none";
            } else {
                teamManagementCard.style.display = "none";
            }
        }

        // Chat lock overlay
        if (chatLockOverlay) {
            chatLockOverlay.style.display = p.isUserMember ? "none" : "flex";
        }
    }

    async function respondToRequest(requestId, accept, role) {
        const culture = getLang();
        try {
            const { ok, data } = await apiJson(`/api/projects/${projectId}/requests/${requestId}/respond`, {
                method: "POST",
                body: JSON.stringify({ accept, assignedRole: role })
            });

            if (!ok) {
                throw new Error(data?.message || (accept ? translateI18n("teams.candidateAccepted", culture) : translateI18n("teams.candidateRejected", culture)));
            }

            showSuccess(accept ? translateI18n("teams.candidateAccepted", culture) : translateI18n("teams.candidateRejected", culture));
            await loadProjectDetails();
        } catch (err) {
            showError(err.message);
        }
    }

    async function removeMember(memberId) {
        const culture = getLang();
        try {
            const res = await apiFetch(`/api/projects/${projectId}/members/${memberId}`, {
                method: "DELETE"
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || translateI18n("teams.memberKicked", culture));
            }

            showSuccess(translateI18n("teams.memberKicked", culture));
            await loadProjectDetails();
        } catch (err) {
            showError(err.message);
        }
    }

    // Leave team
    if (leaveTeamBtn) {
        leaveTeamBtn.addEventListener("click", async () => {
            if (!currentProjectData) return;
            const currentUserId = (typeof getTokens === "function" && getTokens().userId) || null;
            const myMembership = currentProjectData.members.find(m => m.isLeader === false);
            if (!myMembership) return;

            const culture = getLang();
            if (confirm(translateI18n("teams.leaveConfirm", culture))) {
                try {
                    const res = await apiFetch(`/api/projects/${projectId}/members/${myMembership.id}`, {
                        method: "DELETE"
                    });
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.message || "Failed to leave team.");
                    }
                    window.location.href = `/${culture}/Projects`;
                } catch (err) {
                    showError(err.message);
                }
            }
        });
    }

    // Join modal handlers
    function openJoinModal() {
        if (!joinModal) return;
        joinAlert.style.display = "none";
        joinForm.reset();
        joinModal.style.display = "flex";
    }

    function closeJoinModal() {
        if (joinModal) joinModal.style.display = "none";
    }

    if (openJoinOverlayBtn) openJoinOverlayBtn.addEventListener("click", openJoinModal);
    if (closeJoinBtn) closeJoinBtn.addEventListener("click", closeJoinModal);
    if (cancelJoinBtn) cancelJoinBtn.addEventListener("click", closeJoinModal);

    if (joinForm) {
        joinForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            joinAlert.style.display = "none";

            const culture = getLang();
            const requestedRole = document.getElementById("join-requested-role").value.trim();
            const coverMessage = document.getElementById("join-cover-message").value.trim();

            if (!requestedRole) {
                joinAlert.textContent = translateI18n("teams.roleRequired", culture);
                joinAlert.style.display = "block";
                return;
            }

            const submitBtn = document.getElementById("submit-join-btn");
            submitBtn.disabled = true;

            try {
                const { ok, data } = await apiJson(`/api/projects/${projectId}/join`, {
                    method: "POST",
                    body: JSON.stringify({ requestedRole, coverMessage })
                });

                if (!ok) {
                    throw new Error(data?.message || (typeof data === "string" ? data : "Failed to submit request"));
                }

                closeJoinModal();
                showSuccess(translateI18n("teams.joinSuccess", culture));
                await loadProjectDetails();
            } catch (err) {
                joinAlert.textContent = err.message || translateI18n("teams.errorCreate", culture);
                joinAlert.style.display = "block";
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    function updateEditModalLogoPreview() {
        const preview = document.getElementById("edit-project-logo-preview");
        const fallback = document.getElementById("edit-project-logo-fallback");
        const removeBtn = document.getElementById("edit-project-logo-remove");
        const initial = (currentProjectData?.title || "?")[0].toUpperCase();

        if (currentProjectData?.logoUrl) {
            const url = resolveMediaUrl(currentProjectData.logoUrl);
            if (preview) {
                preview.src = url;
                preview.style.display = "block";
            }
            if (fallback) fallback.style.display = "none";
            if (removeBtn) removeBtn.style.display = "inline-block";
        } else {
            if (preview) preview.style.display = "none";
            if (fallback) {
                fallback.textContent = initial;
                fallback.style.display = "flex";
            }
            if (removeBtn) removeBtn.style.display = "none";
        }
    }

    // Edit modal handlers
    if (openEditBtn) {
        openEditBtn.addEventListener("click", () => {
            if (!currentProjectData) return;
            document.getElementById("edit-project-title").value = currentProjectData.title || "";
            document.getElementById("edit-project-description").value = currentProjectData.description || "";
            document.getElementById("edit-project-max-members").value = currentProjectData.maxMembers || 5;
            document.getElementById("edit-project-status").value = currentProjectData.status || "Recruiting";
            document.getElementById("edit-project-skills").value = currentProjectData.requiredSkills || "";
            document.getElementById("edit-project-repo").value = currentProjectData.repositoryUrl || "";
            document.getElementById("edit-project-looking").checked = !!currentProjectData.isLookingForMembers;
            updateEditModalLogoPreview();
            editAlert.style.display = "none";
            editModal.style.display = "flex";
        });
    }

    const logoInput = document.getElementById("edit-project-logo-input");
    const logoRemoveBtn = document.getElementById("edit-project-logo-remove");

    if (logoInput) {
        logoInput.addEventListener("change", async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            logoInput.value = "";

            const culture = getLang();
            const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
            if (!allowedTypes.includes(file.type.toLowerCase())) {
                editAlert.textContent = translateI18n("projects.logoSquareError", culture) || "Only PNG, JPG, WebP images are allowed.";
                editAlert.style.display = "block";
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                editAlert.textContent = translateI18n("profile.avatarSizeError", culture) || "File size exceeds 5 MB.";
                editAlert.style.display = "block";
                return;
            }

            // Client-side square dimension validation (<= 512x512 square)
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = async () => {
                URL.revokeObjectURL(objectUrl);
                if (img.width !== img.height || img.width > 512 || img.height > 512) {
                    editAlert.textContent = translateI18n("projects.logoSquareError", culture) || "Logo must be a square image (max 512x512 px).";
                    editAlert.style.display = "block";
                    return;
                }

                try {
                    const res = await api.uploadProjectLogo(projectId, file);
                    if (!res.ok) {
                        throw new Error(res.data?.message || (typeof res.data === "string" ? res.data : "Failed to upload logo"));
                    }
                    if (res.data?.logoUrl) {
                        currentProjectData.logoUrl = res.data.logoUrl;
                    }
                    updateEditModalLogoPreview();
                    renderWorkspace(currentProjectData);
                    showSuccess(translateI18n("projects.logoSuccess", culture) || "Team logo updated!");
                } catch (err) {
                    editAlert.textContent = err.message;
                    editAlert.style.display = "block";
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                editAlert.textContent = translateI18n("projects.logoSquareError", culture) || "Invalid image file.";
                editAlert.style.display = "block";
            };
            img.src = objectUrl;
        });
    }

    if (logoRemoveBtn) {
        logoRemoveBtn.addEventListener("click", async () => {
            const culture = getLang();
            try {
                const res = await api.deleteProjectLogo(projectId);
                if (!res.ok) {
                    throw new Error("Failed to remove logo");
                }
                currentProjectData.logoUrl = null;
                updateEditModalLogoPreview();
                renderWorkspace(currentProjectData);
                showSuccess("Logo removed");
            } catch (err) {
                editAlert.textContent = err.message;
                editAlert.style.display = "block";
            }
        });
    }

    function closeEditModal() {
        if (editModal) editModal.style.display = "none";
    }

    if (closeEditBtn) closeEditBtn.addEventListener("click", closeEditModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener("click", closeEditModal);

    if (editForm) {
        editForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            editAlert.style.display = "none";

            const title = document.getElementById("edit-project-title").value.trim();
            const description = document.getElementById("edit-project-description").value.trim();
            const maxMembers = parseInt(document.getElementById("edit-project-max-members").value, 10);
            const status = document.getElementById("edit-project-status").value;
            const requiredSkills = document.getElementById("edit-project-skills").value.trim();
            const repositoryUrl = document.getElementById("edit-project-repo").value.trim() || null;
            const isLookingForMembers = document.getElementById("edit-project-looking").checked;

            const culture = getLang();
            try {
                const { ok, data } = await apiJson(`/api/projects/${projectId}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        title,
                        description,
                        maxMembers,
                        status,
                        requiredSkills,
                        repositoryUrl,
                        isLookingForMembers
                    })
                });

                if (!ok) {
                    throw new Error(data?.message || "Failed to update settings");
                }

                closeEditModal();
                showSuccess(translateI18n("teams.settingsSuccess", culture));
                await loadProjectDetails();
            } catch (err) {
                editAlert.textContent = err.message;
                editAlert.style.display = "block";
            }
        });
    }


    function setupWorkspaceNavigation() {
        const navButtons = document.querySelectorAll(".workspace-nav-btn");
        const tabViews = document.querySelectorAll(".workspace-tab-view");

        navButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const targetView = btn.dataset.view;
                if (!targetView) return;

                navButtons.forEach(b => b.classList.remove("is-active"));
                btn.classList.add("is-active");

                tabViews.forEach(view => {
                    if (view.id === `view-${targetView}`) {
                        view.classList.add("is-active");
                    } else {
                        view.classList.remove("is-active");
                    }
                });

                // Scroll to top of active view
                const activeViewEl = document.getElementById(`view-${targetView}`);
                if (activeViewEl) activeViewEl.scrollTop = 0;

                window.dispatchEvent(new CustomEvent("linqup:view-changed", { detail: { view: targetView } }));
            });
        });
    }

    // Initial setup
    setupWorkspaceNavigation();
    loadProjectDetails();
})();
