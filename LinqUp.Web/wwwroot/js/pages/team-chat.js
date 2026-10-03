(function () {
    "use strict";

    let hubConnection = null;
    let projectId = null;
    let currentUserId = null;
    let currentUserNickname = null;
    let teamMembers = [];
    let pendingAttachmentIds = [];
    let pendingAttachmentsData = [];
    let pendingCodeQuote = null;
    let pendingReplyTo = null;
    let oldestMessageTimestamp = null;

    // DOM Elements
    const chatContainer = document.getElementById("chat-container");
    const chatMessages = document.getElementById("chat-messages");
    const chatMessagesList = document.getElementById("chat-messages-list");
    const loadMoreContainer = document.getElementById("chat-load-more");
    const loadMoreBtn = document.getElementById("load-earlier-messages-btn");
    const connectionStatusBadge = document.getElementById("chat-connection-status");
    const typingIndicator = document.getElementById("chat-typing-indicator");

    const messageInput = document.getElementById("chat-message-input");
    const sendForm = document.getElementById("chat-send-form");
    const sendBtn = document.getElementById("chat-send-btn");
    const attachBtn = document.getElementById("chat-attach-btn");
    const fileInput = document.getElementById("chat-file-input");
    const pendingAttachmentsBar = document.getElementById("chat-pending-attachments");
    const chatDraftBar = document.getElementById("chat-draft-bar");
    const chatDraftText = document.getElementById("chat-draft-text");
    const chatDraftCancelBtn = document.getElementById("chat-draft-cancel-btn");

    const mentionsPopup = document.getElementById("mentions-popup");
    const mentionsList = document.getElementById("mentions-list");
    let activeMentionIndex = 0;
    let mentionSearchQuery = "";
    let mentionMatchStartIndex = -1;

    // Lightbox elements
    const lightbox = document.getElementById("image-lightbox");
    const lightboxImg = document.getElementById("lightbox-img");
    const lightboxCaption = document.getElementById("lightbox-caption");
    const lightboxDownload = document.getElementById("lightbox-download-link");
    const lightboxClose = document.getElementById("lightbox-close-btn");

    function formatBytes(bytes, decimals = 1) {
        const culture = getLang();
        const byteUnit = culture === "en" ? "B" : "Б";
        if (!bytes || bytes === 0) return `0 ${byteUnit}`;
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = culture === "en" ? ["B", "KB", "MB", "GB"] : ["Б", "КБ", "МБ", "ГБ"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
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

    function formatTime(isoString) {
        if (!isoString) return "";
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function formatDateSeparator(isoString) {
        if (!isoString) return "";
        const culture = getLang();
        const date = new Date(isoString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return culture === "uk" ? "Сьогодні" : "Today";
        if (date.toDateString() === yesterday.toDateString()) return culture === "uk" ? "Вчора" : "Yesterday";
        return date.toLocaleDateString(culture === "en" ? "en-US" : "uk-UA", { day: "numeric", month: "long" });
    }

    // Initialize once project data is available
    window.addEventListener("linqup:project-loaded", (e) => {
        const project = e.detail;
        if (!project || !project.isUserMember) return;

        projectId = project.id;
        teamMembers = project.members || [];

        // Identify current user
        const me = teamMembers.find(m => m.userId === project.creatorId && project.isUserLeader)
                || teamMembers.find(m => m.isLeader === project.isUserLeader)
                || teamMembers[0];
        if (me) {
            currentUserNickname = me.nickname;
            currentUserId = me.userId;
        }

        initSignalR();
        loadMessageHistory();
        setupInputHandlers();
        setupAttachmentHandlers();
        setupDraftBar();
        setupLightbox();
    });

    async function initSignalR() {
        if (typeof signalR === "undefined") {
            console.error("SignalR library not loaded");
            return;
        }

        const hubUrl = `${API_BASE}/hubs/team-chat`;

        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl, { withCredentials: true })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        // Hub events
        hubConnection.on("ReceiveMessage", (messageDto) => {
            appendMessage(messageDto, true);
            scrollToBottom();
        });

        hubConnection.on("ReactionToggled", (data) => {
            updateMessageReactions(data);
        });

        hubConnection.on("PullRequestApproved", (data) => {
            const announcementText = `@${data.approvedByNickname} схвалив Pull Request #${data.pullNumber}! ${data.comment ? `"${data.comment}"` : ""}`;
            appendAnnouncement(announcementText, "check");
            scrollToBottom();
        });

        hubConnection.on("MeetingActiveState", (data) => {
            window.dispatchEvent(new CustomEvent("linqup:meeting-broadcast", { detail: data }));
        });

        hubConnection.on("MeetingEnded", (data) => {
            window.dispatchEvent(new CustomEvent("linqup:meeting-broadcast", { detail: { isActive: false } }));
        });

        let typingTimeout = null;
        hubConnection.on("UserTyping", (typingDto) => {
            if (typingDto.userId === currentUserId) return;
            if (typingIndicator) {
                const culture = getLang();
                typingIndicator.textContent = culture === "uk" ? `@${typingDto.nickname} друкує...` : `@${typingDto.nickname} is typing...`;
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    typingIndicator.textContent = "";
                }, 3000);
            }
        });

        hubConnection.onreconnecting(() => {
            if (connectionStatusBadge) {
                connectionStatusBadge.textContent = "З'єднання...";
                connectionStatusBadge.className = "badge badge-warning";
            }
        });

        hubConnection.onreconnected(async () => {
            if (connectionStatusBadge) {
                connectionStatusBadge.textContent = "З'єднано";
                connectionStatusBadge.className = "badge badge-success";
            }
            if (projectId) {
                await hubConnection.invoke("JoinTeamChat", projectId).catch(console.error);
            }
        });

        hubConnection.onclose(() => {
            if (connectionStatusBadge) {
                connectionStatusBadge.textContent = "Відключено";
                connectionStatusBadge.className = "badge badge-danger";
            }
        });

        try {
            await hubConnection.start();
            if (connectionStatusBadge) {
                connectionStatusBadge.textContent = "З'єднано";
                connectionStatusBadge.className = "badge badge-success";
            }
            await hubConnection.invoke("JoinTeamChat", projectId);
        } catch (err) {
            console.error("SignalR connection error:", err);
            if (connectionStatusBadge) {
                connectionStatusBadge.textContent = "Помилка";
                connectionStatusBadge.className = "badge badge-danger";
            }
        }
    }

    async function loadMessageHistory(isOlder = false) {
        if (!projectId) return;

        let url = `/api/projects/${projectId}/chat/messages?limit=30`;
        if (isOlder && oldestMessageTimestamp) {
            url += `&before=${encodeURIComponent(oldestMessageTimestamp)}`;
        }

        try {
            const res = await apiFetch(url, { method: "GET" });
            if (!res.ok) return;

            const messages = await res.json();
            if (!messages || messages.length === 0) {
                if (loadMoreContainer) loadMoreContainer.style.display = "none";
                return;
            }

            if (messages.length >= 30 && loadMoreContainer) {
                loadMoreContainer.style.display = "block";
            } else if (loadMoreContainer) {
                loadMoreContainer.style.display = "none";
            }

            oldestMessageTimestamp = messages[0].createdAt;

            if (isOlder) {
                const prevHeight = chatMessages.scrollHeight;
                prependMessages(messages);
                chatMessages.scrollTop = chatMessages.scrollHeight - prevHeight;
            } else {
                chatMessagesList.innerHTML = "";
                renderMessagesGrouped(messages);
                scrollToBottom();
            }
        } catch (err) {
            console.error("Error loading chat messages:", err);
        }
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", () => {
            loadMessageHistory(true);
        });
    }

    function renderMessagesGrouped(messages) {
        let lastDateString = null;
        let lastSenderId = null;

        messages.forEach(msg => {
            const dateStr = formatDateSeparator(msg.createdAt);
            if (dateStr !== lastDateString) {
                lastDateString = dateStr;
                chatMessagesList.appendChild(createDateDivider(dateStr));
                lastSenderId = null;
            }
            const isGrouped = (lastSenderId === msg.senderId);
            lastSenderId = msg.senderId;

            chatMessagesList.appendChild(renderSingleMessage(msg, isGrouped));
        });
    }

    function prependMessages(messages) {
        const frag = document.createDocumentFragment();
        let lastDateString = null;
        let lastSenderId = null;

        messages.forEach(msg => {
            const dateStr = formatDateSeparator(msg.createdAt);
            if (dateStr !== lastDateString) {
                lastDateString = dateStr;
                frag.appendChild(createDateDivider(dateStr));
                lastSenderId = null;
            }
            const isGrouped = (lastSenderId === msg.senderId);
            lastSenderId = msg.senderId;

            frag.appendChild(renderSingleMessage(msg, isGrouped));
        });

        chatMessagesList.insertBefore(frag, chatMessagesList.firstChild);
    }

    function appendMessage(msg, checkDivider = false) {
        if (checkDivider) {
            const dateStr = formatDateSeparator(msg.createdAt);
            const lastChild = chatMessagesList.lastElementChild;
            const hasDividerToday = lastChild && lastChild.classList && lastChild.classList.contains("chat-date-divider");
            if (!hasDividerToday && chatMessagesList.children.length === 0) {
                chatMessagesList.appendChild(createDateDivider(dateStr));
            }
        }
        chatMessagesList.appendChild(renderSingleMessage(msg, false));
    }

    function appendAnnouncement(text, iconType = "info") {
        const div = document.createElement("div");
        div.className = "chat-announcement-row";
        const iconSvg = iconType === "check" 
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="chat-announcement-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chat-announcement-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

        div.innerHTML = `
            <span class="chat-announcement-pill">
                ${iconSvg}
                <span>${escapeHtml(text)}</span>
            </span>
        `;
        chatMessagesList.appendChild(div);
    }

    function createDateDivider(text) {
        const div = document.createElement("div");
        div.className = "chat-date-divider";
        div.style.textAlign = "center";
        div.style.margin = "14px 0";
        div.innerHTML = `
            <span style="background: var(--color-surface, #161b2c); border: 1px solid var(--color-border); padding: 3px 14px; border-radius: 12px; font-size: 11px; color: var(--color-text-muted); font-weight: 500;">
                ${escapeHtml(text)}
            </span>
        `;
        return div;
    }

    function renderSingleMessage(msg, isGrouped = false) {
        const culture = getLang();
        const isMe = currentUserId && msg.senderId === currentUserId;
        const isMentioned = currentUserNickname && msg.content.toLowerCase().includes(`@${currentUserNickname.toLowerCase()}`);

        const item = document.createElement("div");
        item.className = `chat-message-item ${isMe ? "chat-message-item--outgoing" : ""}`;
        item.id = `msg-${msg.id}`;
        item.dataset.msgId = msg.id;

        const sAvatarUrl = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(msg.senderAvatarPath) : msg.senderAvatarPath;
        const sInitial = escapeHtml((msg.senderNickname || "?")[0].toUpperCase());
        const avatar = sAvatarUrl
            ? `<div class="avatar avatar-sm" style="background-image: url('${escapeHtml(sAvatarUrl)}'); flex-shrink: 0;"></div>`
            : `<div class="avatar avatar-sm" style="flex-shrink: 0;">${sInitial}</div>`;

        // Parse @mentions
        let formattedContent = escapeHtml(msg.content);
        formattedContent = formattedContent.replace(/@([a-zA-Z0-9_]{3,30})/g, (match, nick) => {
            const isUser = currentUserNickname && nick.toLowerCase() === currentUserNickname.toLowerCase();
            return `<span class="chat-mention ${isUser ? "chat-mention--me" : ""}">@${nick}</span>`;
        });
        formattedContent = formattedContent.replace(/\n/g, "<br />");

        // Code Quote Card HTML
        let codeQuoteHtml = "";
        if (msg.codeQuote) {
            const q = msg.codeQuote;
            codeQuoteHtml = `
                <div class="code-quote-card">
                    <div class="code-quote-header">
                        <div class="code-quote-path">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                            <span>${escapeHtml(q.filePath)}</span>
                            <span class="badge badge-secondary" style="font-size: 10px;">L${q.startLine}-${q.endLine}</span>
                            <span style="font-size: 10px; color: var(--color-text-muted);">(${escapeHtml(q.branch || "main")})</span>
                        </div>
                        <button type="button" class="btn btn-ghost btn-xs code-quote-jump-btn" data-path="${escapeHtml(q.filePath)}" data-branch="${escapeHtml(q.branch)}" data-start="${q.startLine}" data-end="${q.endLine}">
                            ${culture === "uk" ? "Переглянути в коді ➔" : "Open in code ➔"}
                        </button>
                    </div>
                    <pre class="code-quote-snippet"><code>${escapeHtml(q.codeSnippet)}</code></pre>
                </div>
            `;
        }

        // Attachments HTML
        let attachmentsHtml = "";
        if (msg.attachments && msg.attachments.length > 0) {
            const images = msg.attachments.filter(a => a.isImage);
            const files = msg.attachments.filter(a => !a.isImage);

            if (images.length > 0) {
                attachmentsHtml += `<div class="chat-images-grid" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">`;
                images.forEach(img => {
                    attachmentsHtml += `
                        <div class="chat-image-item" style="position: relative; border-radius: 8px; overflow: hidden; max-width: 260px; max-height: 190px; border: 1px solid var(--color-border); cursor: pointer;"
                             data-view-url="${escapeHtml(img.viewUrl)}" data-download-url="${escapeHtml(img.downloadUrl)}" data-name="${escapeHtml(img.originalFileName)}">
                            <img src="${escapeHtml(img.viewUrl)}" alt="${escapeHtml(img.originalFileName)}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
                        </div>
                    `;
                });
                attachmentsHtml += `</div>`;
            }

            if (files.length > 0) {
                attachmentsHtml += `<div class="chat-files-list" style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">`;
                files.forEach(f => {
                    attachmentsHtml += `
                        <div class="chat-file-card" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; background: rgba(0,0,0,0.25); border: 1px solid var(--color-border); border-radius: 6px; font-size: 13px;">
                            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--color-brand); flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                <div style="min-width: 0;">
                                    <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;" title="${escapeHtml(f.originalFileName)}">${escapeHtml(f.originalFileName)}</div>
                                    <div style="font-size: 11px; color: var(--color-text-muted);">${formatBytes(f.fileSize)}</div>
                                </div>
                            </div>
                            <a href="${escapeHtml(f.downloadUrl)}" class="btn btn-ghost btn-sm" download title="Завантажити" style="padding: 4px 8px; flex-shrink: 0;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="3"></line></svg>
                            </a>
                        </div>
                    `;
                });
                attachmentsHtml += `</div>`;
            }
        }

        // Reactions HTML
        let reactionsHtml = `<div class="chat-reactions-row" id="reactions-${msg.id}">`;
        if (msg.reactions && msg.reactions.length > 0) {
            msg.reactions.forEach(r => {
                reactionsHtml += `
                    <button type="button" class="reaction-pill ${r.hasReacted ? "reaction-pill--active" : ""}" data-msg-id="${msg.id}" data-emoji="${escapeHtml(r.emoji)}">
                        <span>${escapeHtml(r.emoji)}</span>
                        <span>${r.count}</span>
                    </button>
                `;
            });
        }
        reactionsHtml += `</div>`;

        // Discord / Telegram Hover Action Bar
        const hoverActionsHtml = `
            <div class="chat-message-actions">
                <button type="button" class="msg-action-btn quick-react-btn" data-msg-id="${msg.id}" data-emoji="👍" title="👍">👍</button>
                <button type="button" class="msg-action-btn quick-react-btn" data-msg-id="${msg.id}" data-emoji="❤️" title="❤️">❤️</button>
                <button type="button" class="msg-action-btn quick-react-btn" data-msg-id="${msg.id}" data-emoji="🔥" title="🔥">🔥</button>
                <button type="button" class="msg-action-btn quick-react-btn" data-msg-id="${msg.id}" data-emoji="🚀" title="🚀">🚀</button>
                <button type="button" class="msg-action-btn quick-react-btn" data-msg-id="${msg.id}" data-emoji="👀" title="👀">👀</button>
                <button type="button" class="msg-action-btn reply-msg-btn" data-msg-id="${msg.id}" data-nick="${escapeHtml(msg.senderNickname)}" title="Відповісти">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
                </button>
                <button type="button" class="msg-action-btn copy-msg-btn" data-content="${escapeHtml(msg.content)}" title="Копіювати">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
            </div>
        `;

        item.innerHTML = `
            ${avatar}
            <div class="chat-message-body">
                <div class="chat-message-meta">
                    <a href="/${culture}/u/${escapeHtml(msg.senderNickname)}" class="chat-message-author">
                        ${escapeHtml(msg.senderFullName || msg.senderNickname)}
                    </a>
                    <span style="font-size: 11px; color: var(--color-text-muted);">@${escapeHtml(msg.senderNickname)}</span>
                    <span class="chat-message-time">${formatTime(msg.createdAt)}</span>
                </div>
                ${codeQuoteHtml}
                ${formattedContent ? `<div class="chat-message-text">${formattedContent}</div>` : ""}
                ${attachmentsHtml}
                ${reactionsHtml}
            </div>
            ${hoverActionsHtml}
        `;

        // Bind image zoom click
        item.querySelectorAll(".chat-image-item").forEach(el => {
            el.addEventListener("click", () => {
                openLightbox(el.dataset.viewUrl, el.dataset.name, el.dataset.downloadUrl);
            });
        });

        // Bind code quote jump button
        item.querySelectorAll(".code-quote-jump-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                if (window.LinqUpGitWorkspace && typeof window.LinqUpGitWorkspace.openFileAtLines === "function") {
                    window.LinqUpGitWorkspace.openFileAtLines(
                        btn.dataset.path,
                        btn.dataset.branch,
                        parseInt(btn.dataset.start, 10),
                        parseInt(btn.dataset.end, 10)
                    );
                }
            });
        });

        // Bind quick reactions and reaction pills
        bindReactionHandlers(item);

        return item;
    }

    function bindReactionHandlers(parentEl) {
        parentEl.querySelectorAll(".quick-react-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleReaction(btn.dataset.msgId, btn.dataset.emoji);
            });
        });

        parentEl.querySelectorAll(".reaction-pill").forEach(pill => {
            pill.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleReaction(pill.dataset.msgId, pill.dataset.emoji);
            });
        });

        parentEl.querySelectorAll(".reply-msg-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                setReply(btn.dataset.msgId, btn.dataset.nick);
            });
        });

        parentEl.querySelectorAll(".copy-msg-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                navigator.clipboard.writeText(btn.dataset.content || "");
                alert("Повідомлення скопійовано!");
            });
        });
    }

    async function toggleReaction(messageId, emoji) {
        if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) return;
        try {
            await hubConnection.invoke("ToggleReaction", {
                projectId: projectId,
                messageId: messageId,
                emoji: emoji
            });
        } catch (err) {
            console.error("ToggleReaction error:", err);
        }
    }

    function updateMessageReactions(data) {
        const reactionsRow = document.getElementById(`reactions-${data.messageId}`);
        if (!reactionsRow) return;

        let pill = reactionsRow.querySelector(`.reaction-pill[data-emoji="${data.emoji}"]`);

        if (data.count <= 0) {
            if (pill) pill.remove();
            return;
        }

        const isMe = currentUserId && data.userId === currentUserId;

        if (!pill) {
            pill = document.createElement("button");
            pill.type = "button";
            pill.className = `reaction-pill ${isMe && data.isAdded ? "reaction-pill--active" : ""}`;
            pill.dataset.msgId = data.messageId;
            pill.dataset.emoji = data.emoji;
            pill.innerHTML = `<span>${escapeHtml(data.emoji)}</span><span>${data.count}</span>`;

            pill.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleReaction(data.messageId, data.emoji);
            });

            reactionsRow.appendChild(pill);
        } else {
            pill.querySelector("span:last-child").textContent = data.count;
            if (isMe) {
                pill.classList.toggle("reaction-pill--active", data.isAdded);
            }
        }
    }

    function setReply(msgId, nick) {
        pendingReplyTo = { id: msgId, nickname: nick };
        renderDraftBar();
        if (messageInput) messageInput.focus();
    }

    function renderDraftBar() {
        if (!chatDraftBar || !chatDraftText) return;

        if (pendingCodeQuote) {
            chatDraftBar.style.display = "flex";
            chatDraftText.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                <span>Цитування коду: <strong>${escapeHtml(pendingCodeQuote.filePath)}</strong> (L${pendingCodeQuote.startLine}-L${pendingCodeQuote.endLine})</span>
            `;
        } else if (pendingReplyTo) {
            chatDraftBar.style.display = "flex";
            chatDraftText.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
                <span>Відповідь для <strong>@${escapeHtml(pendingReplyTo.nickname)}</strong></span>
            `;
        } else {
            chatDraftBar.style.display = "none";
            chatDraftText.innerHTML = "";
        }
    }

    function setupDraftBar() {
        if (chatDraftCancelBtn) {
            chatDraftCancelBtn.addEventListener("click", () => {
                pendingCodeQuote = null;
                pendingReplyTo = null;
                renderDraftBar();
            });
        }
    }

    function scrollToBottom() {
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // Input handlers
    function setupInputHandlers() {
        if (!messageInput) return;
        let lastTypingSent = 0;

        messageInput.addEventListener("input", () => {
            messageInput.style.height = "auto";
            messageInput.style.height = Math.min(messageInput.scrollHeight, 130) + "px";

            const now = Date.now();
            if (now - lastTypingSent > 2000 && hubConnection && hubConnection.state === signalR.HubConnectionState.Connected) {
                lastTypingSent = now;
                hubConnection.invoke("SendTyping", projectId).catch(() => {});
            }

            handleMentionAutocomplete();
        });

        messageInput.addEventListener("keydown", (e) => {
            if (mentionsPopup && mentionsPopup.style.display === "block") {
                const items = mentionsList.querySelectorAll(".mention-item");
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    activeMentionIndex = (activeMentionIndex + 1) % items.length;
                    highlightActiveMention(items);
                    return;
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    activeMentionIndex = (activeMentionIndex - 1 + items.length) % items.length;
                    highlightActiveMention(items);
                    return;
                } else if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    if (items[activeMentionIndex]) {
                        insertMention(items[activeMentionIndex].dataset.nickname);
                    }
                    return;
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    closeMentionsPopup();
                    return;
                }
            }

            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        if (sendBtn) {
            sendBtn.addEventListener("click", (e) => {
                e.preventDefault();
                sendMessage();
            });
        }
    }

    function handleMentionAutocomplete() {
        const cursorPos = messageInput.selectionStart;
        const textBeforeCursor = messageInput.value.substring(0, cursorPos);
        const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);

        if (match) {
            mentionSearchQuery = match[1].toLowerCase();
            mentionMatchStartIndex = match.index + (match[0].startsWith("@") ? 0 : 1);
            showMentionsPopup();
        } else {
            closeMentionsPopup();
        }
    }

    function showMentionsPopup() {
        const filtered = teamMembers.filter(m =>
            m.nickname.toLowerCase().includes(mentionSearchQuery) ||
            m.fullName.toLowerCase().includes(mentionSearchQuery)
        );

        if (filtered.length === 0) {
            closeMentionsPopup();
            return;
        }

        mentionsList.innerHTML = "";
        activeMentionIndex = 0;

        filtered.forEach((m, idx) => {
            const div = document.createElement("div");
            div.className = `mention-item ${idx === 0 ? "is-active" : ""}`;
            div.dataset.nickname = m.nickname;
            div.style.display = "flex";
            div.style.alignItems = "center";
            div.style.gap = "8px";
            div.style.padding = "7px 12px";
            div.style.cursor = "pointer";

            div.innerHTML = `
                <div style="font-weight: 500; font-size: 13px;">${escapeHtml(m.fullName)}</div>
                <div style="font-size: 11px; color: var(--color-text-muted);">@${escapeHtml(m.nickname)}</div>
            `;

            div.addEventListener("click", () => insertMention(m.nickname));
            mentionsList.appendChild(div);
        });

        mentionsPopup.style.display = "block";
    }

    function highlightActiveMention(items) {
        items.forEach((item, i) => {
            if (i === activeMentionIndex) {
                item.classList.add("is-active");
            } else {
                item.classList.remove("is-active");
            }
        });
    }

    function insertMention(nickname) {
        const text = messageInput.value;
        const before = text.substring(0, mentionMatchStartIndex);
        const after = text.substring(messageInput.selectionStart);
        const inserted = `@${nickname} `;

        messageInput.value = before + inserted + after;
        const newCursorPos = before.length + inserted.length;
        messageInput.setSelectionRange(newCursorPos, newCursorPos);
        messageInput.focus();
        closeMentionsPopup();
    }

    function closeMentionsPopup() {
        if (mentionsPopup) mentionsPopup.style.display = "none";
    }

    function setupAttachmentHandlers() {
        if (attachBtn && fileInput) {
            attachBtn.addEventListener("click", () => fileInput.click());
            fileInput.addEventListener("change", (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    uploadFiles(Array.from(e.target.files));
                    fileInput.value = "";
                }
            });
        }
    }

    async function uploadFiles(files) {
        if (!projectId) return;

        const formData = new FormData();
        files.forEach(f => formData.append("files", f));
        attachBtn.disabled = true;

        try {
            const res = await apiFetch(`/api/projects/${projectId}/chat/attachments`, {
                method: "POST",
                body: formData
            });

            if (!res.ok) throw new Error("Помилка завантаження файлів.");
            const attachments = await res.json();
            attachments.forEach(att => {
                pendingAttachmentIds.push(att.id);
                pendingAttachmentsData.push(att);
            });
            renderPendingAttachments();
        } catch (err) {
            alert(err.message);
        } finally {
            attachBtn.disabled = false;
        }
    }

    function renderPendingAttachments() {
        if (!pendingAttachmentsBar) return;

        if (pendingAttachmentsData.length === 0) {
            pendingAttachmentsBar.style.display = "none";
            pendingAttachmentsBar.innerHTML = "";
            return;
        }

        pendingAttachmentsBar.style.display = "flex";
        pendingAttachmentsBar.innerHTML = "";

        pendingAttachmentsData.forEach((att, idx) => {
            const chip = document.createElement("div");
            chip.className = "attachment-preview-chip";

            chip.innerHTML = `
                <span class="attachment-chip-name">${escapeHtml(att.originalFileName)}</span>
                <span class="attachment-chip-size">${formatBytes(att.fileSize)}</span>
                <button type="button" class="btn-icon btn-xs attachment-chip-remove" title="Видалити" aria-label="Видалити">×</button>
            `;

            chip.querySelector("button").addEventListener("click", () => {
                pendingAttachmentIds.splice(idx, 1);
                pendingAttachmentsData.splice(idx, 1);
                renderPendingAttachments();
            });

            pendingAttachmentsBar.appendChild(chip);
        });
    }

    async function sendMessage() {
        const content = messageInput.value.trim();
        if (!content && pendingAttachmentIds.length === 0 && !pendingCodeQuote) return;

        if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) {
            alert("Втрачено зв'язок з сервером.");
            return;
        }

        sendBtn.disabled = true;

        const payload = {
            projectId: projectId,
            content: content,
            attachmentIds: [...pendingAttachmentIds],
            codeQuote: pendingCodeQuote || null,
            replyToMessageId: pendingReplyTo ? pendingReplyTo.id : null
        };

        try {
            await hubConnection.invoke("SendMessage", payload);

            messageInput.value = "";
            messageInput.style.height = "auto";
            pendingAttachmentIds = [];
            pendingAttachmentsData = [];
            pendingCodeQuote = null;
            pendingReplyTo = null;
            renderPendingAttachments();
            renderDraftBar();
            closeMentionsPopup();
        } catch (err) {
            console.error("Failed to send message:", err);
            alert(err.message || "Не вдалося надіслати повідомлення.");
        } finally {
            sendBtn.disabled = false;
            messageInput.focus();
        }
    }

    function setupLightbox() {
        if (!lightbox) return;
        if (lightboxClose) {
            lightboxClose.addEventListener("click", () => { lightbox.style.display = "none"; });
        }
        lightbox.addEventListener("click", (e) => {
            if (e.target === lightbox) lightbox.style.display = "none";
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && lightbox.style.display !== "none") {
                lightbox.style.display = "none";
            }
        });
    }

    function openLightbox(viewUrl, fileName, downloadUrl) {
        if (!lightbox || !lightboxImg) return;
        lightboxImg.src = viewUrl;
        if (lightboxCaption) lightboxCaption.textContent = fileName || "";
        if (lightboxDownload) {
            lightboxDownload.href = downloadUrl || viewUrl;
            lightboxDownload.setAttribute("download", fileName || "image");
        }
        lightbox.style.display = "flex";
    }

    // Expose for Git Workspace code quoting
    window.LinqUpChat = {
        prepareCodeQuote: function (quote) {
            pendingCodeQuote = quote;
            renderDraftBar();
            if (messageInput) messageInput.focus();
        }
    };
})();
