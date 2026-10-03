function renderPublicContacts(profile) {
    const list = document.getElementById("pp-contacts");
    const empty = document.getElementById("pp-contacts-empty");
    list.innerHTML = "";

    if (!profile.contactMethods.length) {
        empty.style.display = "block";
        return;
    }
    empty.style.display = "none";

    profile.contactMethods.forEach((contact) => {
        const row = document.createElement("div");
        row.className = "item-row";
        const href = contactHref(contact.type, contact.value);
        const valueHtml = href
            ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(contact.value)}</a>`
            : escapeHtml(contact.value);

        row.innerHTML = `
            <div class="item-row-main">
                <span class="contact-method-icon">${contactIcon(contact.type)}</span>
                <div class="item-row-text">
                    <span class="item-row-title">${contact.type}</span>
                    <span class="item-row-subtitle">${valueHtml}</span>
                </div>
            </div>
        `;
        list.appendChild(row);
    });
}

function renderPublicSkills(profile) {
    const list = document.getElementById("pp-skills");
    const empty = document.getElementById("pp-skills-empty");
    list.innerHTML = "";

    if (!profile.skills.length) {
        empty.style.display = "block";
        return;
    }
    empty.style.display = "none";

    profile.skills.forEach((skill) => {
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
            <div class="item-row-main">
                <div class="item-row-text">
                    <span class="item-row-title">${escapeHtml(skill.skillName)}</span>
                    <span class="item-row-subtitle">${formatExperience(skill.experienceMonths)}</span>
                </div>
            </div>
        `;
        list.appendChild(row);
    });
}

async function loadPublicProfile() {
    const { ok, data } = await api.getPublicProfile(publicProfileNickname);

    if (!ok) {
        document.getElementById("public-not-found").style.display = "block";
        return;
    }

    document.getElementById("public-profile").style.display = "block";
    document.getElementById("pp-fullname").textContent = `${data.firstName} ${data.lastName}`.trim();
    document.getElementById("pp-nickname").textContent = `@${data.nickname}`;

    const avatarUrl = resolveAvatarUrl(data.avatarUrl);
    if (avatarUrl) {
        document.getElementById("pp-avatar-img").src = avatarUrl;
        document.getElementById("pp-avatar-img").style.display = "block";
        document.getElementById("pp-avatar-fallback").style.display = "none";
    } else {
        document.getElementById("pp-avatar-fallback").textContent = initials(data.firstName, data.lastName);
    }

    if (data.bio) {
        document.getElementById("pp-bio").textContent = data.bio;
        document.getElementById("pp-bio-card").style.display = "block";
    }

    const goalBadge = document.getElementById("pp-goal-badge");
    if (goalBadge) {
        if (data.goal) {
            const goalSvgs = {
                Project: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="goal-badge-svg"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>`,
                Hackathon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="goal-badge-svg"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
                OpenSource: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="goal-badge-svg"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
                FirstExperience: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="goal-badge-svg"><path d="M7 20h10"></path><path d="M10 20c5.5-2.5.8-6.4 3-10"></path><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"></path><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"></path></svg>`
            };
            const svgIcon = goalSvgs[data.goal] || "";
            const label = translateI18n(`profile.goal${data.goal}`) || data.goal;
            goalBadge.innerHTML = `${svgIcon}<span>${escapeHtml(label)}</span>`;
            goalBadge.className = `user-goal-badge user-goal-badge--${(data.goal || "").toLowerCase()}`;
            goalBadge.style.display = "inline-flex";
        } else {
            goalBadge.style.display = "none";
        }
    }

    renderPublicContacts(data);
    renderPublicSkills(data);
}

loadPublicProfile();
