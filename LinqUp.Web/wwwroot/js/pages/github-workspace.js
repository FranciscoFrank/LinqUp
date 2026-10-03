(function () {
    "use strict";

    let projectId = null;
    let repoInfo = null;
    let currentBranch = "main";
    let currentPath = "";
    let currentDirectoryItems = [];
    let selectedFileContent = null;
    let selectedStartLine = null;
    let selectedEndLine = null;
    let currentViewMode = "preview";

    // DOM Elements
    const gitRepoTitle = document.getElementById("git-repo-title");
    const gitRepoMeta = document.getElementById("git-repo-meta");
    const gitRepoLink = document.getElementById("git-repo-link");
    const gitBranchSelect = document.getElementById("git-branch-select");
    const gitBreadcrumbs = document.getElementById("git-breadcrumbs");
    const gitTreeList = document.getElementById("git-tree-list");
    const gitTreeSearchInput = document.getElementById("git-tree-search");
    const gitCodeContainer = document.getElementById("git-code-container");
    const gitMarkdownPreview = document.getElementById("git-markdown-preview");
    const gitCodeToolbar = document.getElementById("git-code-toolbar");
    const gitFloatingQuoteBtn = document.getElementById("git-floating-quote-btn");

    const gitNoRepoCard = document.getElementById("git-no-repo-card");
    const gitActiveRepoCard = document.getElementById("git-active-repo-card");
    const openSetRepoBtn = document.getElementById("open-set-repo-btn");
    const setRepoModal = document.getElementById("set-repo-modal");
    const closeSetRepoBtn = document.getElementById("close-set-repo-btn");
    const setRepoForm = document.getElementById("set-repo-form");
    const setRepoInput = document.getElementById("set-repo-input");
    const setRepoAlert = document.getElementById("set-repo-alert");

    // Sub-tab panes
    const subtabButtons = document.querySelectorAll(".git-subtab-btn");
    const subtabPanes = {
        code: document.getElementById("git-pane-code"),
        prs: document.getElementById("git-pane-prs"),
        branches: document.getElementById("git-pane-branches"),
        commits: document.getElementById("git-pane-commits")
    };

    // PR view elements (read-only)
    const prsList = document.getElementById("git-prs-list");
    const prDetailsModal = document.getElementById("git-pr-details-modal");
    const closePrDetailsBtn = document.getElementById("close-pr-details-btn");
    const prDetailsBody = document.getElementById("git-pr-details-body");
    const prFilterButtons = document.querySelectorAll(".pr-filter-btn");
    const prsLoadMoreContainer = document.getElementById("git-prs-load-more-container");
    const prsLoadMoreBtn = document.getElementById("git-prs-load-more-btn");
    let currentActivePrNumber = null;
    let currentPrState = "open";
    let prsPage = 1;

    // Branches elements
    const branchesList = document.getElementById("git-branches-list");
    const branchesLoadMoreContainer = document.getElementById("git-branches-load-more-container");
    const branchesLoadMoreBtn = document.getElementById("git-branches-load-more-btn");
    let branchesPage = 1;

    // Commits elements
    const commitsList = document.getElementById("git-commits-list");
    const commitsLoadMoreContainer = document.getElementById("git-commits-load-more-container");
    const commitsLoadMoreBtn = document.getElementById("git-commits-load-more-btn");
    let commitsPage = 1;

    const PAGE_SIZE = 10;

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatTimeAgo(isoString) {
        if (!isoString) return "";
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        const culture = getLang();
        if (diffMins < 2) return culture === "uk" ? "щойно" : "just now";
        if (diffMins < 60) return culture === "uk" ? `${diffMins} хв тому` : `${diffMins}m ago`;
        if (diffHours < 24) return culture === "uk" ? `${diffHours} год тому` : `${diffHours}h ago`;
        if (diffDays < 30) return culture === "uk" ? `${diffDays} дн тому` : `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    // Initialize once project is loaded
    window.addEventListener("linqup:project-loaded", (e) => {
        const project = e.detail;
        if (!project) return;
        projectId = project.id;

        setupSubtabNavigation();
        setupSetRepoHandlers(project.isUserLeader);
        setupPrModals();
        setupTreeSearch();
        setupPaginationHandlers();

        if (project.repositoryUrl && project.repositoryUrl.trim()) {
            showActiveRepoView();
            loadRepoInfo();
        } else {
            showNoRepoView(project.isUserLeader);
        }
    });

    function showNoRepoView(isLeader) {
        if (gitNoRepoCard) gitNoRepoCard.style.display = "flex";
        if (gitActiveRepoCard) gitActiveRepoCard.style.display = "none";
        if (openSetRepoBtn) openSetRepoBtn.style.display = isLeader ? "inline-flex" : "none";
    }

    function showActiveRepoView() {
        if (gitNoRepoCard) gitNoRepoCard.style.display = "none";
        if (gitActiveRepoCard) gitActiveRepoCard.style.display = "flex";
    }

    function setupSubtabNavigation() {
        subtabButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const target = btn.dataset.subtab;
                subtabButtons.forEach(b => b.classList.remove("is-active"));
                btn.classList.add("is-active");

                Object.keys(subtabPanes).forEach(k => {
                    if (subtabPanes[k]) {
                        subtabPanes[k].style.display = k === target ? "flex" : "none";
                    }
                });

                if (target === "prs") loadPullRequests(currentPrState, false);
                if (target === "branches") loadBranchesTab(false);
                if (target === "commits") loadCommitsTab(false);
            });
        });
    }

    function setupPaginationHandlers() {
        // PR status filter buttons (Open / Closed / All)
        prFilterButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const state = btn.dataset.state || "open";
                prFilterButtons.forEach(b => {
                    b.classList.remove("is-active", "btn-secondary");
                    b.classList.add("btn-ghost");
                });
                btn.classList.add("is-active", "btn-secondary");
                btn.classList.remove("btn-ghost");
                currentPrState = state;
                loadPullRequests(currentPrState, false);
            });
        });

        // PRs Load More
        if (prsLoadMoreBtn) {
            prsLoadMoreBtn.addEventListener("click", () => {
                prsPage++;
                loadPullRequests(currentPrState, true);
            });
        }

        // Branches Load More
        if (branchesLoadMoreBtn) {
            branchesLoadMoreBtn.addEventListener("click", () => {
                branchesPage++;
                loadBranchesTab(true);
            });
        }

        // Commits Load More
        if (commitsLoadMoreBtn) {
            commitsLoadMoreBtn.addEventListener("click", () => {
                commitsPage++;
                loadCommitsTab(true);
            });
        }
    }

    async function loadRepoInfo() {
        if (!projectId) return;
        const culture = getLang();

        try {
            const res = await apiFetch(`/api/projects/${projectId}/github/repo-info`, { method: "GET" });
            if (!res.ok) {
                showNoRepoView(true);
                return;
            }

            repoInfo = await res.json();
            currentBranch = repoInfo.defaultBranch || "main";

            if (gitRepoTitle) gitRepoTitle.textContent = repoInfo.fullName;
            if (gitRepoMeta) {
                const metaItems = [
                    `<span class="git-meta-item" title="${culture === 'uk' ? 'Зірки' : 'Stars'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="git-icon-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><span>${(repoInfo.starsCount ?? 0).toLocaleString()}</span></span>`,
                    `<span class="git-meta-item" title="${culture === 'uk' ? 'Форки' : 'Forks'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="git-icon-fork"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"></path><path d="M12 12v3"></path></svg><span>${(repoInfo.forksCount ?? 0).toLocaleString()}</span></span>`,
                    `<span class="git-meta-item" title="${culture === 'uk' ? 'Гілка за замовчуванням' : 'Default branch'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="git-icon-branch"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg><span>${escapeHtml(repoInfo.defaultBranch || "main")}</span></span>`
                ];

                if (repoInfo.language) {
                    metaItems.push(
                        `<span class="git-meta-item" title="${culture === 'uk' ? 'Основна мова' : 'Primary language'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="git-icon-code"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg><span>${escapeHtml(repoInfo.language)}</span></span>`
                    );
                }

                gitRepoMeta.innerHTML = `<span class="git-meta-divider"></span>` + metaItems.join(`<span class="git-meta-divider"></span>`);
            }
            if (gitRepoLink) {
                gitRepoLink.href = repoInfo.htmlUrl;
                gitRepoLink.style.display = "inline-flex";
            }

            loadBranchesDropdown();
            loadDirectoryTree(currentBranch, "");
        } catch (err) {
            console.error("Error loading repo info:", err);
        }
    }

    async function loadBranchesDropdown() {
        if (!gitBranchSelect || !projectId) return;

        try {
            const res = await apiFetch(`/api/projects/${projectId}/github/branches`, { method: "GET" });
            if (!res.ok) return;

            const branches = await res.json();
            gitBranchSelect.innerHTML = "";

            branches.forEach(b => {
                const opt = document.createElement("option");
                opt.value = b.name;
                opt.textContent = b.name + (b.isDefault ? " (default)" : "");
                if (b.name === currentBranch) opt.selected = true;
                gitBranchSelect.appendChild(opt);
            });

            gitBranchSelect.onchange = (e) => {
                currentBranch = e.target.value;
                currentPath = "";
                loadDirectoryTree(currentBranch, "");
                if (subtabPanes.commits && subtabPanes.commits.style.display !== "none") {
                    loadCommitsTab(false);
                }
            };

            if (typeof refreshCustomSelect === "function") {
                refreshCustomSelect(gitBranchSelect);
            } else if (window.refreshCustomSelect) {
                window.refreshCustomSelect(gitBranchSelect);
            }
        } catch (err) {
            console.error("Error loading branches dropdown:", err);
        }
    }

    function setupTreeSearch() {
        if (!gitTreeSearchInput) return;
        gitTreeSearchInput.addEventListener("input", (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (!query) {
                renderTreeItems(currentDirectoryItems, currentPath);
                return;
            }
            const filtered = currentDirectoryItems.filter(item => {
                const name = item.path.split("/").pop();
                return name.toLowerCase().includes(query);
            });
            renderTreeItems(filtered, currentPath, true);
        });
    }

    async function loadDirectoryTree(branch, path) {
        if (!projectId || !gitTreeList) return;
        currentPath = path || "";
        if (gitTreeSearchInput) gitTreeSearchInput.value = "";
        gitTreeList.innerHTML = `<div style="padding: 14px 12px; color: var(--color-text-muted); font-size: 12px;"><div class="spinner" style="margin-right: 6px;"></div>Завантаження структури...</div>`;
        renderBreadcrumbs(path);

        try {
            const url = `/api/projects/${projectId}/github/tree?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path || "")}`;
            const res = await apiFetch(url, { method: "GET" });
            if (!res.ok) {
                gitTreeList.innerHTML = `<div style="padding: 12px; color: var(--color-danger-base); font-size: 12px;">Не вдалося завантажити теку.</div>`;
                return;
            }

            const items = await res.json();
            currentDirectoryItems = items || [];
            renderTreeItems(currentDirectoryItems, path);

            // Automatically open README.md or first file if on root
            if (!path && items && items.length > 0) {
                const readme = items.find(i => i.path.toLowerCase() === "readme.md" || i.path.toLowerCase().endsWith("/readme.md"));
                if (readme) {
                    loadFileContent(branch, readme.path);
                } else {
                    const firstFile = items.find(i => i.type !== "tree");
                    if (firstFile) loadFileContent(branch, firstFile.path);
                }
            }
        } catch (err) {
            console.error("Error loading directory tree:", err);
            gitTreeList.innerHTML = `<div style="padding: 12px; color: var(--color-danger-base); font-size: 12px;">Помилка завантаження теки.</div>`;
        }
    }

    function renderTreeItems(items, path, isFiltered = false) {
        if (!gitTreeList) return;
        gitTreeList.innerHTML = "";

        if (path && !isFiltered) {
            // Back / parent item
            const upItem = document.createElement("div");
            upItem.className = "git-tree-item";
            upItem.innerHTML = `
                <span class="git-item-icon-box">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </span>
                <span>..</span>
            `;
            upItem.addEventListener("click", () => {
                const parts = path.split("/").filter(Boolean);
                parts.pop();
                const parentPath = parts.join("/");
                loadDirectoryTree(currentBranch, parentPath);
            });
            gitTreeList.appendChild(upItem);
        }

        if (!items || items.length === 0) {
            const emptyText = isFiltered ? "Нічого не знайдено" : "Тека порожня";
            gitTreeList.innerHTML += `<div style="padding: 12px; color: var(--color-text-muted); font-size: 12px; text-align: center;">${emptyText}</div>`;
            return;
        }

        items.forEach(item => {
            const el = document.createElement("div");
            el.className = "git-tree-item";
            const isDir = item.type === "tree";
            const name = item.path.split("/").pop();

            const icon = isDir
                ? `<span class="git-item-icon-box"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color: #f59e0b; flex-shrink: 0;"><path d="M20 5h-8.586L9.707 3.293A1 1 0 0 0 9 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/></svg></span>`
                : getFileIcon(name);

            el.innerHTML = `
                ${icon}
                <span title="${escapeHtml(name)}" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(name)}</span>
            `;

            el.addEventListener("click", () => {
                if (isDir) {
                    currentPath = item.path;
                    loadDirectoryTree(currentBranch, item.path);
                } else {
                    document.querySelectorAll(".git-tree-item").forEach(i => i.classList.remove("is-selected"));
                    el.classList.add("is-selected");
                    loadFileContent(currentBranch, item.path);
                }
            });

            gitTreeList.appendChild(el);
        });
    }

    function renderBreadcrumbs(path) {
        if (!gitBreadcrumbs) return;
        gitBreadcrumbs.innerHTML = "";

        const rootName = (repoInfo && repoInfo.name) || "root";
        const rootCrumb = document.createElement("span");
        rootCrumb.className = "git-breadcrumb-crumb" + (!path ? " is-current" : "");
        rootCrumb.textContent = rootName;
        rootCrumb.addEventListener("click", () => {
            if (currentPath !== "") {
                loadDirectoryTree(currentBranch, "");
            }
        });
        gitBreadcrumbs.appendChild(rootCrumb);

        if (!path) return;

        const parts = path.split("/").filter(Boolean);
        let accumulated = "";

        parts.forEach((part, idx) => {
            accumulated += (accumulated ? "/" : "") + part;
            const currentAcc = accumulated;

            const sep = document.createElement("span");
            sep.style.color = "var(--color-text-muted)";
            sep.style.userSelect = "none";
            sep.textContent = " / ";
            gitBreadcrumbs.appendChild(sep);

            const seg = document.createElement("span");
            const isLast = (idx === parts.length - 1);
            seg.className = "git-breadcrumb-crumb" + (isLast ? " is-current" : "");
            seg.textContent = part;

            if (!isLast) {
                seg.addEventListener("click", () => {
                    loadDirectoryTree(currentBranch, currentAcc);
                });
            }

            gitBreadcrumbs.appendChild(seg);
        });
    }

    function resolveLanguage(fileName, langHint) {
        if (langHint && langHint !== "Text" && langHint !== "Plain Text") {
            const h = langHint.toLowerCase();
            if (h === "c#" || h === "csharp") return "csharp";
            if (h === "javascript") return "javascript";
            if (h === "typescript") return "typescript";
            if (h === "json") return "json";
            if (h === "markdown") return "markdown";
            if (h === "html" || h === "xml") return "xml";
            if (h === "css") return "css";
            if (h === "bash" || h === "shell") return "bash";
            if (h === "yaml") return "yaml";
            if (h === "python") return "python";
            if (h === "sql") return "sql";
        }
        if (!fileName) return "plaintext";
        const lower = fileName.toLowerCase();
        if (lower.endsWith(".cs")) return "csharp";
        if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
        if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs")) return "javascript";
        if (lower.endsWith(".json")) return "json";
        if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
        if (lower.endsWith(".html") || lower.endsWith(".cshtml")) return "xml";
        if (lower.endsWith(".xml") || lower.endsWith(".props") || lower.endsWith(".targets") || lower.endsWith(".csproj") || lower.endsWith(".slnx")) return "xml";
        if (lower.endsWith(".css") || lower.endsWith(".scss")) return "css";
        if (lower.endsWith(".sh") || lower.endsWith(".ps1") || lower.endsWith(".cmd") || lower.endsWith(".bat")) return "bash";
        if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
        if (lower.endsWith(".py")) return "python";
        if (lower.endsWith(".sql")) return "sql";
        if (lower === "dockerfile" || lower.endsWith(".dockerfile")) return "dockerfile";
        return "plaintext";
    }

    function highlightEntireCode(content, lang) {
        if (!content) return "";
        if (typeof hljs === "undefined" || lang === "plaintext" || !lang) {
            return escapeHtml(content);
        }

        try {
            if (hljs.getLanguage(lang)) {
                return hljs.highlight(content, { language: lang, ignoreIllegals: true }).value;
            }
            return escapeHtml(content);
        } catch (e) {
            console.warn("hljs highlight error:", e);
            return escapeHtml(content);
        }
    }

    function splitHighlightedHtmlIntoLines(html) {
        if (!html) return [];
        const rawLines = html.split("\n");
        const lines = [];
        let openTags = [];

        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            let lineHtml = openTags.join("") + line;

            const tagRegex = /<\/?span[^>]*>/g;
            let match;
            while ((match = tagRegex.exec(line)) !== null) {
                const tag = match[0];
                if (tag.startsWith("</")) {
                    openTags.pop();
                } else {
                    openTags.push(tag);
                }
            }

            for (let j = 0; j < openTags.length; j++) {
                lineHtml += "</span>";
            }

            lines.push(lineHtml);
        }

        return lines;
    }

    async function loadFileContent(branch, path, highlightRange = null) {
        if (!projectId || !gitCodeContainer) return;
        gitCodeContainer.innerHTML = `<div style="padding: 32px; text-align: center; color: var(--color-text-muted);"><div class="spinner" style="margin-bottom: 8px;"></div>Завантаження файлу...</div>`;
        if (gitMarkdownPreview) gitMarkdownPreview.innerHTML = "";
        hideFloatingQuoteBtn();
        selectedStartLine = null;
        selectedEndLine = null;

        try {
            const url = `/api/projects/${projectId}/github/file?path=${encodeURIComponent(path)}&branch=${encodeURIComponent(branch)}`;
            const res = await apiFetch(url, { method: "GET" });
            if (!res.ok) {
                gitCodeContainer.innerHTML = `<div style="padding: 24px; color: var(--color-danger-base);">Не вдалося завантажити вміст файлу.</div>`;
                return;
            }

            const file = await res.json();
            selectedFileContent = file;

            const isMarkdown = file.name.toLowerCase().endsWith(".md") || file.name.toLowerCase().endsWith(".markdown");
            if (isMarkdown && !currentViewMode) {
                currentViewMode = "preview";
            } else if (!isMarkdown) {
                currentViewMode = "code";
            }

            renderCodeToolbar(file, branch);
            renderCodeViewer(file, highlightRange);
            if (isMarkdown) {
                renderMarkdownPreview(file.content);
            }
            updateViewModeDisplay();
        } catch (err) {
            console.error("Error loading file content:", err);
            gitCodeContainer.innerHTML = `<div style="padding: 24px; color: var(--color-danger-base);">Помилка: ${escapeHtml(err.message)}</div>`;
        }
    }

    function renderCodeToolbar(file, branch) {
        if (!gitCodeToolbar) return;
        const culture = getLang();
        const isMarkdown = file.name.toLowerCase().endsWith(".md") || file.name.toLowerCase().endsWith(".markdown");

        const viewToggleHtml = isMarkdown ? `
            <div class="git-view-mode-toggle" id="git-md-toggle">
                <button type="button" class="git-mode-btn ${currentViewMode === 'preview' ? 'is-active active' : ''}" data-mode="preview">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <span>${culture === "uk" ? "Прев'ю" : "Preview"}</span>
                </button>
                <span class="git-view-mode-divider"></span>
                <button type="button" class="git-mode-btn ${currentViewMode === 'code' ? 'is-active active' : ''}" data-mode="code">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                    <span>${culture === "uk" ? "Код" : "Code"}</span>
                </button>
            </div>
        ` : "";

        gitCodeToolbar.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-family: var(--font-mono); font-size: 13px; min-width: 0; flex: 1;">
                ${getFileIcon(file.name)}
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(file.path)}</span>
                <span class="git-meta-divider"></span>
                <span class="badge badge-secondary" style="font-size: 10px; flex-shrink: 0;">${escapeHtml(file.language || "text")}</span>
                <span class="git-meta-divider"></span>
                <span style="font-size: 11px; color: var(--color-text-muted); font-weight: normal; flex-shrink: 0;">${file.totalLines} lines</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                ${viewToggleHtml}
                ${viewToggleHtml ? `<span class="git-meta-divider"></span>` : ""}
                <button type="button" class="btn btn-primary btn-sm" id="quote-entire-file-btn" style="gap: 5px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span>${culture === "uk" ? "Цитувати в чат" : "Quote in chat"}</span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" id="copy-file-btn" title="Копіювати код">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
                ${file.htmlUrl ? `<a href="${escapeHtml(file.htmlUrl)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" title="GitHub"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>` : ""}
            </div>
        `;

        if (isMarkdown) {
            document.querySelectorAll("#git-md-toggle .git-mode-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    currentViewMode = btn.dataset.mode;
                    document.querySelectorAll("#git-md-toggle .git-mode-btn").forEach(b => {
                        b.classList.remove("active");
                        b.classList.remove("is-active");
                    });
                    btn.classList.add("active");
                    btn.classList.add("is-active");
                    updateViewModeDisplay();
                });
            });
        }

        document.getElementById("quote-entire-file-btn")?.addEventListener("click", () => {
            triggerQuoteToChat(file, 1, Math.min(file.totalLines, 30));
        });

        document.getElementById("copy-file-btn")?.addEventListener("click", () => {
            navigator.clipboard.writeText(file.content);
            alert("Вміст скопійовано в буфер обміну!");
        });
    }

    function updateViewModeDisplay() {
        if (!selectedFileContent) return;
        const isMarkdown = selectedFileContent.name.toLowerCase().endsWith(".md") || selectedFileContent.name.toLowerCase().endsWith(".markdown");

        if (isMarkdown && currentViewMode === "preview") {
            if (gitMarkdownPreview) gitMarkdownPreview.style.display = "block";
            if (gitCodeContainer) gitCodeContainer.style.display = "none";
            hideFloatingQuoteBtn();
        } else {
            if (gitMarkdownPreview) gitMarkdownPreview.style.display = "none";
            if (gitCodeContainer) gitCodeContainer.style.display = "block";
        }
    }

    function renderMarkdownPreview(markdownText) {
        if (!gitMarkdownPreview) return;
        if (!markdownText) {
            const culture = getLang();
            gitMarkdownPreview.innerHTML = `<div style="color: var(--color-text-muted); padding: 32px; text-align: center;">${culture === 'uk' ? 'Файл порожній.' : 'File is empty.'}</div>`;
            return;
        }

        try {
            gitMarkdownPreview.innerHTML = renderMarkdownContent(markdownText);

            if (typeof hljs !== "undefined") {
                gitMarkdownPreview.querySelectorAll("pre code").forEach(block => {
                    try { hljs.highlightElement(block); } catch (e) { }
                });
            }
        } catch (e) {
            console.error("Markdown rendering error:", e);
            gitMarkdownPreview.innerHTML = `<pre style="white-space: pre-wrap;">${escapeHtml(markdownText)}</pre>`;
        }
    }

    function renderCodeViewer(file, highlightRange = null) {
        if (!gitCodeContainer) return;

        if (file.isBinary) {
            gitCodeContainer.innerHTML = `
                <div style="padding: 48px; text-align: center; color: var(--color-text-muted);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    <h4>Бінарний файл</h4>
                    <p style="font-size: 13px; margin-bottom: 16px;">Цей файл не є текстовим.</p>
                    ${file.downloadUrl ? `<a href="${escapeHtml(file.downloadUrl)}" download class="btn btn-secondary btn-sm">Завантажити файл</a>` : ""}
                </div>
            `;
            return;
        }

        const lang = resolveLanguage(file.name, file.language);
        const highlightedHtml = highlightEntireCode(file.content, lang);
        const lines = splitHighlightedHtmlIntoLines(highlightedHtml);

        let tableHtml = `<table class="git-code-table"><tbody>`;
        const startH = highlightRange ? highlightRange.start : -1;
        const endH = highlightRange ? highlightRange.end : -1;

        lines.forEach((lineContent, idx) => {
            const lineNum = idx + 1;
            const isHighlighted = (lineNum >= startH && lineNum <= endH);

            tableHtml += `
                <tr class="git-line-row ${isHighlighted ? "is-highlighted" : ""}" data-line="${lineNum}">
                    <td class="git-line-num" data-line="${lineNum}">${lineNum}</td>
                    <td class="git-line-code">${lineContent || "&nbsp;"}</td>
                </tr>
            `;
        });

        tableHtml += `</tbody></table>`;
        gitCodeContainer.innerHTML = tableHtml;

        // Scroll to highlighted line if present
        if (highlightRange && startH > 0) {
            const row = gitCodeContainer.querySelector(`tr[data-line="${startH}"]`);
            if (row) {
                row.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }

        // Line selection & Range clicks
        gitCodeContainer.querySelectorAll(".git-line-num").forEach(numCell => {
            numCell.addEventListener("click", (e) => {
                const clickedLine = parseInt(numCell.dataset.line, 10);
                if (e.shiftKey && selectedStartLine !== null) {
                    selectedEndLine = clickedLine;
                } else {
                    selectedStartLine = clickedLine;
                    selectedEndLine = clickedLine;
                }

                updateLineHighlights();
                showFloatingQuoteBtn();
            });
        });
    }

    function updateLineHighlights() {
        if (selectedStartLine === null) return;
        const low = Math.min(selectedStartLine, selectedEndLine || selectedStartLine);
        const high = Math.max(selectedStartLine, selectedEndLine || selectedStartLine);

        gitCodeContainer.querySelectorAll(".git-line-row").forEach(row => {
            const line = parseInt(row.dataset.line, 10);
            if (line >= low && line <= high) {
                row.classList.add("is-highlighted");
            } else {
                row.classList.remove("is-highlighted");
            }
        });
    }

    function showFloatingQuoteBtn() {
        if (!gitFloatingQuoteBtn || !selectedFileContent) return;
        const low = Math.min(selectedStartLine, selectedEndLine || selectedStartLine);
        const high = Math.max(selectedStartLine, selectedEndLine || selectedStartLine);
        const culture = getLang();

        const text = culture === "uk"
            ? (low === high ? `Цитувати рядок ${low} в чат` : `Цитувати рядки ${low}-${high} в чат`)
            : (low === high ? `Quote line ${low} in chat` : `Quote lines ${low}-${high} in chat`);

        gitFloatingQuoteBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>${text}</span>
        `;
        gitFloatingQuoteBtn.style.display = "inline-flex";

        gitFloatingQuoteBtn.onclick = () => {
            triggerQuoteToChat(selectedFileContent, low, high);
        };
    }

    function hideFloatingQuoteBtn() {
        if (gitFloatingQuoteBtn) gitFloatingQuoteBtn.style.display = "none";
    }

    function triggerQuoteToChat(file, startLine, endLine) {
        const lines = file.content.split("\n");
        const low = Math.max(1, Math.min(startLine, endLine));
        const high = Math.min(lines.length, Math.max(startLine, endLine));

        const snippetLines = lines.slice(low - 1, high);
        const snippetText = snippetLines.join("\n");

        const quoteObj = {
            repo: (repoInfo && repoInfo.fullName) || "",
            filePath: file.path,
            branch: currentBranch,
            startLine: low,
            endLine: high,
            codeSnippet: snippetText,
            language: file.language || "text"
        };

        if (window.LinqUpChat && typeof window.LinqUpChat.prepareCodeQuote === "function") {
            window.LinqUpChat.prepareCodeQuote(quoteObj);
        }

        // Switch to chat tab
        const chatTabBtn = document.querySelector('.workspace-nav-btn[data-view="chat"]');
        if (chatTabBtn) chatTabBtn.click();
    }

    // ==========================================================================
    // Pull Requests (MR) Management
    // ==========================================================================
    async function loadPullRequests(state = "open", isLoadMore = false) {
        if (!projectId || !prsList) return;
        const culture = getLang();

        if (!isLoadMore) {
            prsPage = 1;
            currentPrState = state;
            prsList.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--color-text-muted);"><div class="spinner"></div></div>`;
            if (prsLoadMoreContainer) prsLoadMoreContainer.style.display = "none";
        } else if (prsLoadMoreBtn) {
            prsLoadMoreBtn.disabled = true;
            prsLoadMoreBtn.classList.add("is-loading");
        }

        try {
            const res = await apiFetch(`/api/projects/${projectId}/github/pulls?state=${encodeURIComponent(currentPrState)}&page=${prsPage}&pageSize=${PAGE_SIZE}`, { method: "GET" });
            if (!res.ok) {
                if (!isLoadMore) {
                    prsList.innerHTML = `<div style="padding: 20px; color: var(--color-danger-base);">${culture === "uk" ? "Не вдалося завантажити Pull Requests." : "Failed to load Pull Requests."}</div>`;
                }
                return;
            }

            const pulls = await res.json();

            if (!isLoadMore) {
                prsList.innerHTML = "";
                if (!pulls || pulls.length === 0) {
                    prsList.innerHTML = `<div style="padding: 36px; text-align: center; color: var(--color-text-muted);">${culture === "uk" ? "Pull Requests відсутні." : "No Pull Requests found."}</div>`;
                    if (prsLoadMoreContainer) prsLoadMoreContainer.style.display = "none";
                    return;
                }
            }

            if (pulls && pulls.length > 0) {
                pulls.forEach(pr => {
                    const item = document.createElement("div");
                    item.className = "git-pr-card";

                    const stateBadge = pr.state === "open"
                        ? `<span class="badge badge-success" style="font-size: 11px;">${culture === "uk" ? "Відкрито" : "Open"}</span>`
                        : (pr.isMerged ? `<span class="badge badge-secondary" style="font-size: 11px; background: #8b5cf6; color: #fff;">Merged</span>` : `<span class="badge badge-danger" style="font-size: 11px;">${culture === "uk" ? "Закрито" : "Closed"}</span>`);

                    const commentBadge = (pr.commentsCount && pr.commentsCount > 0)
                        ? `<span title="${culture === 'uk' ? 'Коментарі' : 'Comments'}" style="display: inline-flex; align-items: center; gap: 4px; color: var(--color-text-muted); font-size: 12px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            <span>${pr.commentsCount}</span>
                           </span>`
                        : "";

                    const approvedBadge = pr.isApproved
                        ? `<span class="badge badge-success" style="font-size: 10.5px; padding: 1px 6px;">✓ ${culture === "uk" ? "Схвалено" : "Approved"}</span>`
                        : "";

                    item.innerHTML = `
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                                ${stateBadge}
                                ${approvedBadge}
                                <span style="font-weight: 600; font-size: 14px; color: var(--color-text);">${escapeHtml(pr.title)}</span>
                                <span style="color: var(--color-text-muted); font-size: 12px;">#${pr.number}</span>
                            </div>
                            <div style="font-size: 12px; color: var(--color-text-muted); display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <span>${culture === "uk" ? "від" : "by"} <strong>${escapeHtml(pr.userLogin)}</strong></span>
                                <span>•</span>
                                <span>${formatTimeAgo(pr.createdAt)}</span>
                                <span>•</span>
                                <span style="font-family: var(--font-mono); font-size: 11px; background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 4px;">${escapeHtml(pr.headRef)} ➔ ${escapeHtml(pr.baseRef)}</span>
                                ${commentBadge ? `<span>•</span>${commentBadge}` : ""}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <button type="button" class="btn btn-secondary btn-sm view-pr-btn" data-num="${pr.number}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                ${culture === "uk" ? "Деталі та Диф" : "Details & Diff"}
                            </button>
                        </div>
                    `;

                    item.querySelector(".view-pr-btn").addEventListener("click", () => {
                        openPullRequestDetails(pr.number);
                    });

                    prsList.appendChild(item);
                });
            }

            if (prsLoadMoreContainer) {
                if (pulls && pulls.length === PAGE_SIZE) {
                    prsLoadMoreContainer.style.display = "block";
                } else {
                    prsLoadMoreContainer.style.display = "none";
                }
            }
        } catch (err) {
            console.error("Error loading PRs:", err);
            if (!isLoadMore) {
                prsList.innerHTML = `<div style="padding: 20px; color: var(--color-danger-base);">${escapeHtml(err.message)}</div>`;
            }
        } finally {
            if (prsLoadMoreBtn) {
                prsLoadMoreBtn.disabled = false;
                prsLoadMoreBtn.classList.remove("is-loading");
            }
        }
    }

    function renderMarkdownContent(rawText) {
        if (!rawText) return "";
        try {
            // Strip HTML comments so template comments or instructions don't render as ugly text
            let text = rawText.replace(/<!--[\s\S]*?-->/g, "").trim();
            if (!text) return "";

            let renderedHtml = "";
            if (typeof marked !== "undefined" && typeof marked.parse === "function") {
                renderedHtml = marked.parse(text, { gfm: true, breaks: true });
            } else {
                renderedHtml = `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
            }

            if (typeof DOMPurify !== "undefined" && typeof DOMPurify.sanitize === "function") {
                renderedHtml = DOMPurify.sanitize(renderedHtml);
            }
            return renderedHtml;
        } catch (e) {
            console.error("Markdown rendering error:", e);
            return `<p>${escapeHtml(rawText).replace(/\n/g, "<br>")}</p>`;
        }
    }

    async function openPullRequestDetails(pullNumber) {
        if (!projectId || !prDetailsModal || !prDetailsBody) return;
        currentActivePrNumber = pullNumber;
        prDetailsBody.innerHTML = `<div style="padding: 60px; text-align: center;"><div class="spinner"></div></div>`;
        prDetailsModal.style.display = "flex";

        try {
            const [prRes, filesRes, commentsRes] = await Promise.all([
                apiFetch(`/api/projects/${projectId}/github/pulls/${pullNumber}`, { method: "GET" }),
                apiFetch(`/api/projects/${projectId}/github/pulls/${pullNumber}/files`, { method: "GET" }),
                apiFetch(`/api/projects/${projectId}/github/pulls/${pullNumber}/comments`, { method: "GET" })
            ]);

            if (!prRes.ok) {
                const errText = await prRes.text();
                throw new Error(errText || "Не вдалося завантажити деталі PR.");
            }
            const pr = await prRes.json();
            const files = filesRes.ok ? await filesRes.json() : [];
            const comments = commentsRes.ok ? await commentsRes.json() : [];

            renderPrDetailsContent(pr, files, comments);
        } catch (err) {
            prDetailsBody.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
        }
    }

    function renderPrDetailsContent(pr, files, comments = []) {
        const culture = getLang();

        // 1. Changed Files & Diff HTML
        let filesDiffHtml = "";
        if (files && files.length > 0) {
            filesDiffHtml = `
                <div style="margin-top: 24px;">
                    <div class="git-section-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        <span>${culture === "uk" ? "Змінені файли" : "Changed Files"} (${files.length})</span>
                    </div>
            `;
            files.forEach(f => {
                filesDiffHtml += `
                    <div class="git-diff-block">
                        <div class="git-diff-header">
                            <span><strong>${escapeHtml(f.filename)}</strong></span>
                            <span style="display: flex; gap: 8px;">
                                <span style="color: #3fb950; font-weight: 600;">+${f.additions}</span>
                                <span style="color: #f85149; font-weight: 600;">-${f.deletions}</span>
                            </span>
                        </div>
                        <pre class="git-diff-content">${formatDiffPatch(f.patch)}</pre>
                    </div>
                `;
            });
            filesDiffHtml += `</div>`;
        }

        // 2. Approvals Summary HTML
        let approvalsHtml = "";
        if (pr.approvals && pr.approvals.length > 0) {
            approvalsHtml = `
                <div style="margin-bottom: 20px; padding: 14px 18px; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: var(--radius-md, 10px);">
                    <div style="font-weight: 600; font-size: 13.5px; color: #22c55e; display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <span>${culture === "uk" ? "Схвалення команди" : "Team Approvals"} (${pr.approvals.length})</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${pr.approvals.map(a => `
                            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--color-text);">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <strong>${escapeHtml(a.userFullName || a.userNickname)}</strong>
                                    <span style="color: var(--color-text-muted); font-size: 12px;">(@${escapeHtml(a.userNickname)})</span>
                                    ${a.comment ? `<span style="color: var(--color-text-muted); font-style: italic;">— "${escapeHtml(a.comment)}"</span>` : ""}
                                </div>
                                <span style="color: var(--color-text-muted); font-size: 11px;">${formatTimeAgo(a.approvedAt)}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
        }

        // 3. Comments List HTML
        let commentsListHtml = "";
        if (comments && comments.length > 0) {
            commentsListHtml = `<div class="git-comments-list" id="pr-modal-comments-list">`;
            comments.forEach(c => {
                const avatarHtml = c.userAvatarUrl
                    ? `<img src="${escapeHtml(c.userAvatarUrl)}" alt="${escapeHtml(c.userLogin)}" class="git-comment-avatar" />`
                    : `<span class="git-comment-avatar-fallback">${escapeHtml(c.userLogin ? c.userLogin.charAt(0).toUpperCase() : "U")}</span>`;

                const badgeHtml = c.authorAssociation && c.authorAssociation !== "NONE"
                    ? `<span class="git-comment-badge">${escapeHtml(c.authorAssociation)}</span>`
                    : "";

                let reviewContextHtml = "";
                if (c.isReviewComment) {
                    reviewContextHtml = `
                        <div class="git-comment-review-context">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            <span>${culture === "uk" ? "Коментар до файлу" : "Comment on file"}: <strong>${escapeHtml(c.path)}</strong>${c.line ? ` (${culture === 'uk' ? 'рядок' : 'line'} ${c.line})` : ""}</span>
                        </div>
                    `;
                    if (c.diffHunk) {
                        reviewContextHtml += `<pre class="git-comment-diff-snippet git-diff-content">${formatDiffPatch(c.diffHunk)}</pre>`;
                    }
                }

                commentsListHtml += `
                    <div class="git-comment-card">
                        <div class="git-comment-header">
                            <div class="git-comment-author-info">
                                ${avatarHtml}
                                <span class="git-comment-author-name">${escapeHtml(c.userLogin)}</span>
                                ${badgeHtml}
                                <span class="git-comment-time">${formatTimeAgo(c.createdAt)}</span>
                            </div>
                            ${c.htmlUrl ? `<a href="${escapeHtml(c.htmlUrl)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="font-size: 11px; padding: 2px 8px;">GitHub</a>` : ""}
                        </div>
                        ${reviewContextHtml}
                        <div class="git-comment-body git-pr-markdown">
                            ${renderMarkdownContent(c.body)}
                        </div>
                    </div>
                `;
            });
            commentsListHtml += `</div>`;
        } else {
            commentsListHtml = `
                <div id="pr-modal-no-comments" style="padding: 24px; text-align: center; color: var(--color-text-muted); background: var(--color-surface, rgba(255,255,255,0.02)); border: 1px dashed var(--color-border); border-radius: var(--radius-md, 10px); margin-bottom: 20px;">
                    ${culture === "uk" ? "Коментарів до цього MR ще немає." : "No comments on this MR yet."}
                </div>
                <div class="git-comments-list" id="pr-modal-comments-list" style="display: none;"></div>
            `;
        }

        const stateBadge = pr.state === "open"
            ? `<span class="badge badge-success">${culture === "uk" ? "Відкрито" : "Open"}</span>`
            : (pr.isMerged ? `<span class="badge badge-secondary" style="background: #8b5cf6; color: #fff;">Merged</span>` : `<span class="badge badge-danger">${culture === "uk" ? "Закрито" : "Closed"}</span>`);

        const approvedChip = pr.isApproved
            ? `<span class="badge badge-success" style="font-size: 11px;">✓ ${culture === "uk" ? "Схвалено командою" : "Team Approved"}</span>`
            : "";

        const commentsCount = comments ? comments.length : (pr.commentsCount || 0);

        prDetailsBody.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 260px;">
                    <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; line-height: 1.3;">${escapeHtml(pr.title)} <span style="color: var(--color-text-muted); font-weight: normal;">#${pr.number}</span></h2>
                    <div style="font-size: 13px; color: var(--color-text-muted); display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        ${stateBadge}
                        ${approvedChip}
                        <span>${culture === "uk" ? "Автор" : "Author"}: <strong>${escapeHtml(pr.userLogin)}</strong></span>
                        <span>•</span>
                        <span style="font-family: var(--font-mono); background: rgba(255,255,255,0.06); padding: 2px 7px; border-radius: 4px;">${escapeHtml(pr.headRef)} ➔ ${escapeHtml(pr.baseRef)}</span>
                        <span>•</span>
                        <span title="${culture === 'uk' ? 'Коментарі' : 'Comments'}" style="display: inline-flex; align-items: center; gap: 4px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            <span id="pr-header-comments-count">${commentsCount}</span>
                        </span>
                        <span>•</span>
                        <span style="color: #3fb950; font-weight: 600;">+${pr.additions}</span>
                        <span style="color: #f85149; font-weight: 600;">-${pr.deletions}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <button type="button" class="btn btn-secondary" id="pr-approve-btn" style="display: inline-flex; align-items: center; gap: 6px;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <span>${culture === "uk" ? "Схвалити MR" : "Approve MR"}</span>
                    </button>
                    ${pr.htmlUrl ? `<a href="${escapeHtml(pr.htmlUrl)}" target="_blank" rel="noopener" class="btn btn-ghost" style="display: inline-flex; align-items: center; gap: 6px;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        <span>${culture === "uk" ? "Відкрити в GitHub" : "Open in GitHub"}</span>
                    </a>` : ""}
                </div>
            </div>

            <!-- Inline Approval Form (initially hidden) -->
            <div id="pr-inline-approve-box" style="display: none; margin-bottom: 20px; padding: 14px 18px; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: var(--radius-md, 10px);">
                <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #22c55e;">
                    ${culture === "uk" ? "Схвалення Pull Request" : "Approve Pull Request"}
                </div>
                <input type="text" id="pr-approve-comment-input" class="input" placeholder="${culture === 'uk' ? 'Коментар до схвалення (необов’язково, наприклад: LGTM!)...' : 'Approval comment (optional, e.g. LGTM!)...'}" style="margin-bottom: 10px; width: 100%;" maxlength="500" />
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button type="button" class="btn btn-ghost btn-sm" id="pr-cancel-approve-btn">${culture === "uk" ? "Скасувати" : "Cancel"}</button>
                    <button type="button" class="btn btn-primary btn-sm" id="pr-submit-approve-btn">${culture === "uk" ? "Підтвердити схвалення" : "Confirm Approval"}</button>
                </div>
            </div>

            ${approvalsHtml}

            <!-- PR Description (Markdown rendered) -->
            <div class="git-pr-desc-card">
                <div class="git-pr-desc-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    <span>${culture === "uk" ? "Опис Pull Request" : "Pull Request Description"}</span>
                </div>
                <div class="git-pr-markdown">
                    ${pr.body && pr.body.trim() ? renderMarkdownContent(pr.body) : `<span style="color: var(--color-text-muted); font-style: italic;">${culture === "uk" ? "Опис відсутній." : "No description provided."}</span>`}
                </div>
            </div>

            <!-- Changed Files & Diff -->
            ${filesDiffHtml}

            <!-- Discussion & Comments Section -->
            <div class="git-comments-section">
                <div class="git-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span>${culture === "uk" ? "Обговорення та коментарі" : "Discussion & Comments"} (<span id="pr-comments-title-count">${commentsCount}</span>)</span>
                </div>

                ${commentsListHtml}

                <!-- Add Comment Form -->
                <div class="git-add-comment-card">
                    <div style="font-weight: 600; font-size: 13.5px; margin-bottom: 8px; color: var(--color-text);">
                        ${culture === "uk" ? "Залишити коментар" : "Leave a comment"}
                    </div>
                    <textarea id="pr-new-comment-input" class="git-add-comment-textarea" placeholder="${culture === 'uk' ? 'Напишіть коментар до цього MR (підтримується Markdown)...' : 'Write a comment on this MR (Markdown supported)...'}"></textarea>
                    <div id="pr-comment-alert" class="alert alert-danger" style="display: none; margin-top: 10px;"></div>
                    <div class="git-add-comment-footer">
                        <button type="button" class="btn btn-primary btn-sm" id="pr-submit-comment-btn" style="display: inline-flex; align-items: center; gap: 6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            <span>${culture === "uk" ? "Надіслати коментар" : "Post Comment"}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Syntax highlighting for code blocks in rendered markdown
        if (typeof hljs !== "undefined") {
            prDetailsBody.querySelectorAll(".git-pr-markdown pre code").forEach(block => {
                try { hljs.highlightElement(block); } catch (e) { }
            });
        }

        // Attach comment submission handler
        const commentBtn = document.getElementById("pr-submit-comment-btn");
        const commentInput = document.getElementById("pr-new-comment-input");
        const commentAlert = document.getElementById("pr-comment-alert");
        if (commentBtn && commentInput) {
            commentBtn.addEventListener("click", async () => {
                const bodyText = commentInput.value.trim();
                if (!bodyText) return;

                commentBtn.disabled = true;
                if (commentAlert) commentAlert.style.display = "none";

                try {
                    const res = await apiFetch(`/api/projects/${projectId}/github/pulls/${pr.number}/comments`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ body: bodyText })
                    });

                    if (!res.ok) {
                        const err = await res.text();
                        throw new Error(err || "Не вдалося надіслати коментар.");
                    }

                    const newComment = await res.json();
                    commentInput.value = "";

                    // Append new comment to list
                    const commentsListEl = document.getElementById("pr-modal-comments-list");
                    const noCommentsEl = document.getElementById("pr-modal-no-comments");
                    if (noCommentsEl) noCommentsEl.style.display = "none";
                    if (commentsListEl) {
                        commentsListEl.style.display = "flex";
                        const itemCard = document.createElement("div");
                        itemCard.className = "git-comment-card";
                        itemCard.innerHTML = `
                            <div class="git-comment-header">
                                <div class="git-comment-author-info">
                                    <span class="git-comment-avatar-fallback">${escapeHtml(newComment.userLogin ? newComment.userLogin.charAt(0).toUpperCase() : "U")}</span>
                                    <span class="git-comment-author-name">${escapeHtml(newComment.userLogin)}</span>
                                    <span class="git-comment-badge">${escapeHtml(newComment.authorAssociation || "Team Member")}</span>
                                    <span class="git-comment-time">${culture === "uk" ? "щойно" : "just now"}</span>
                                </div>
                            </div>
                            <div class="git-comment-body git-pr-markdown">
                                ${renderMarkdownContent(newComment.body)}
                            </div>
                        `;
                        commentsListEl.appendChild(itemCard);
                        if (typeof hljs !== "undefined") {
                            itemCard.querySelectorAll("pre code").forEach(block => {
                                try { hljs.highlightElement(block); } catch (e) { }
                            });
                        }
                    }

                    // Update count in header
                    const titleCount = document.getElementById("pr-comments-title-count");
                    const headerCount = document.getElementById("pr-header-comments-count");
                    const currentCount = parseInt(titleCount ? titleCount.textContent : "0", 10) || 0;
                    if (titleCount) titleCount.textContent = currentCount + 1;
                    if (headerCount) headerCount.textContent = currentCount + 1;
                } catch (err) {
                    if (commentAlert) {
                        commentAlert.textContent = err.message;
                        commentAlert.style.display = "block";
                    }
                } finally {
                    commentBtn.disabled = false;
                }
            });
        }

        // Attach approve handlers
        const approveBtn = document.getElementById("pr-approve-btn");
        const inlineApproveBox = document.getElementById("pr-inline-approve-box");
        const cancelApproveBtn = document.getElementById("pr-cancel-approve-btn");
        const submitApproveBtn = document.getElementById("pr-submit-approve-btn");
        const approveCommentInput = document.getElementById("pr-approve-comment-input");

        if (approveBtn && inlineApproveBox) {
            approveBtn.addEventListener("click", () => {
                inlineApproveBox.style.display = inlineApproveBox.style.display === "none" ? "block" : "none";
                if (approveCommentInput) approveCommentInput.focus();
            });
        }

        if (cancelApproveBtn && inlineApproveBox) {
            cancelApproveBtn.addEventListener("click", () => {
                inlineApproveBox.style.display = "none";
            });
        }

        if (submitApproveBtn && approveCommentInput) {
            submitApproveBtn.addEventListener("click", async () => {
                submitApproveBtn.disabled = true;
                try {
                    const comment = approveCommentInput.value.trim();
                    const res = await apiFetch(`/api/projects/${projectId}/github/pulls/${pr.number}/approve`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ comment: comment || null })
                    });

                    if (!res.ok) {
                        const err = await res.text();
                        throw new Error(err || "Не вдалося схвалити MR.");
                    }

                    // Refresh details to show updated approval state
                    openPullRequestDetails(pr.number);
                } catch (err) {
                    alert(err.message);
                } finally {
                    submitApproveBtn.disabled = false;
                }
            });
        }
    }

    function formatDiffPatch(patch) {
        if (!patch) {
            const culture = typeof getLang === "function" ? getLang() : "uk";
            const noChangesText = culture === "uk" ? "Зміни відсутні або бінарні дані" : "No changes or binary data";
            return `<span style="color: var(--color-text-muted);">${noChangesText}</span>`;
        }
        const lines = patch.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        return lines.map(line => {
            const escaped = escapeHtml(line);
            const content = escaped || "&nbsp;";
            if (line.startsWith("+") && !line.startsWith("+++")) {
                return `<div class="git-diff-line git-diff-line-add">${content}</div>`;
            } else if (line.startsWith("-") && !line.startsWith("---")) {
                return `<div class="git-diff-line git-diff-line-del">${content}</div>`;
            } else if (line.startsWith("@@")) {
                return `<div class="git-diff-line git-diff-line-hunk">${content}</div>`;
            }
            return `<div class="git-diff-line git-diff-line-context">${content}</div>`;
        }).join("");
    }

    function setupPrModals() {
        if (closePrDetailsBtn) {
            closePrDetailsBtn.addEventListener("click", () => {
                if (prDetailsModal) prDetailsModal.style.display = "none";
            });
        }

        if (prDetailsModal) {
            prDetailsModal.addEventListener("click", (e) => {
                if (e.target === prDetailsModal) {
                    prDetailsModal.style.display = "none";
                }
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && prDetailsModal && prDetailsModal.style.display === "flex") {
                prDetailsModal.style.display = "none";
            }
        });
    }

    // ==========================================================================
    // Branches & Commits tabs
    // ==========================================================================
    async function loadBranchesTab(isLoadMore = false) {
        if (!projectId || !branchesList) return;
        const culture = getLang();

        if (!isLoadMore) {
            branchesPage = 1;
            branchesList.innerHTML = `<div style="padding: 24px; text-align: center;"><div class="spinner"></div></div>`;
            if (branchesLoadMoreContainer) branchesLoadMoreContainer.style.display = "none";
        } else if (branchesLoadMoreBtn) {
            branchesLoadMoreBtn.disabled = true;
            branchesLoadMoreBtn.classList.add("is-loading");
        }

        try {
            const res = await apiFetch(`/api/projects/${projectId}/github/branches?page=${branchesPage}&pageSize=${PAGE_SIZE}`, { method: "GET" });
            if (!res.ok) {
                if (!isLoadMore) {
                    branchesList.innerHTML = `<div style="padding: 20px; color: var(--color-danger-base);">${culture === "uk" ? "Не вдалося завантажити гілки." : "Failed to load branches."}</div>`;
                }
                return;
            }

            const branches = await res.json();

            if (!isLoadMore) {
                branchesList.innerHTML = "";
                if (!branches || branches.length === 0) {
                    branchesList.innerHTML = `<div style="padding: 36px; text-align: center; color: var(--color-text-muted);">${culture === "uk" ? "Гілки відсутні." : "No branches found."}</div>`;
                    if (branchesLoadMoreContainer) branchesLoadMoreContainer.style.display = "none";
                    return;
                }
            }

            if (branches && branches.length > 0) {
                branches.forEach(b => {
                    const item = document.createElement("div");
                    item.className = "git-branch-card";
                    item.style.display = "flex";
                    item.style.alignItems = "center";
                    item.style.justifyContent = "space-between";

                    item.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--color-brand);"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>
                            <span style="font-weight: 600; font-size: 14px;">${escapeHtml(b.name)}</span>
                            ${b.isDefault ? `<span class="badge badge-primary" style="font-size: 10px;">Default</span>` : ""}
                            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted);">${escapeHtml(b.commitSha ? b.commitSha.substring(0, 7) : "")}</span>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm switch-branch-btn" data-branch="${escapeHtml(b.name)}">
                            ${culture === "uk" ? "Переглянути код" : "Browse code"}
                        </button>
                    `;

                    item.querySelector(".switch-branch-btn").addEventListener("click", () => {
                        currentBranch = b.name;
                        if (gitBranchSelect) {
                            gitBranchSelect.value = b.name;
                            if (typeof refreshCustomSelect === "function") {
                                refreshCustomSelect(gitBranchSelect);
                            } else if (window.refreshCustomSelect) {
                                window.refreshCustomSelect(gitBranchSelect);
                            }
                        }
                        document.querySelector('.git-subtab-btn[data-subtab="code"]')?.click();
                        loadDirectoryTree(currentBranch, "");
                    });

                    branchesList.appendChild(item);
                });
            }

            if (branchesLoadMoreContainer) {
                if (branches && branches.length === PAGE_SIZE) {
                    branchesLoadMoreContainer.style.display = "block";
                } else {
                    branchesLoadMoreContainer.style.display = "none";
                }
            }
        } catch (err) {
            console.error("Error loading branches tab:", err);
            if (!isLoadMore) {
                branchesList.innerHTML = `<div style="padding: 20px; color: var(--color-danger-base);">${escapeHtml(err.message)}</div>`;
            }
        } finally {
            if (branchesLoadMoreBtn) {
                branchesLoadMoreBtn.disabled = false;
                branchesLoadMoreBtn.classList.remove("is-loading");
            }
        }
    }

    async function loadCommitsTab(isLoadMore = false) {
        if (!projectId || !commitsList) return;
        const culture = getLang();

        if (!isLoadMore) {
            commitsPage = 1;
            commitsList.innerHTML = `<div style="padding: 24px; text-align: center;"><div class="spinner"></div></div>`;
            if (commitsLoadMoreContainer) commitsLoadMoreContainer.style.display = "none";
        } else if (commitsLoadMoreBtn) {
            commitsLoadMoreBtn.disabled = true;
            commitsLoadMoreBtn.classList.add("is-loading");
        }

        try {
            const res = await apiFetch(`/api/projects/${projectId}/github/commits?branch=${encodeURIComponent(currentBranch)}&page=${commitsPage}&pageSize=${PAGE_SIZE}`, { method: "GET" });
            if (!res.ok) {
                if (!isLoadMore) {
                    commitsList.innerHTML = `<div style="padding: 20px; color: var(--color-danger-base);">${culture === "uk" ? "Не вдалося завантажити коміти." : "Failed to load commits."}</div>`;
                }
                return;
            }

            const commits = await res.json();

            if (!isLoadMore) {
                commitsList.innerHTML = "";
                if (!commits || commits.length === 0) {
                    commitsList.innerHTML = `<div style="padding: 36px; text-align: center; color: var(--color-text-muted);">${culture === "uk" ? "Коміти відсутні." : "No commits found."}</div>`;
                    if (commitsLoadMoreContainer) commitsLoadMoreContainer.style.display = "none";
                    return;
                }
            }

            if (commits && commits.length > 0) {
                commits.forEach(c => {
                    const item = document.createElement("div");
                    item.className = "git-commit-card";
                    item.style.display = "flex";
                    item.style.alignItems = "center";
                    item.style.justifyContent = "space-between";
                    item.style.gap = "14px";

                    const shortSha = c.shortSha || (c.sha ? c.sha.substring(0, 7) : "");

                    item.innerHTML = `
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${escapeHtml(c.message)}
                            </div>
                            <div style="font-size: 12px; color: var(--color-text-muted); display: flex; align-items: center; gap: 8px;">
                                <span>${escapeHtml(c.authorName)}</span>
                                <span>•</span>
                                <span>${formatTimeAgo(c.date)}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="badge badge-secondary" style="font-family: var(--font-mono); font-size: 11px;">${escapeHtml(shortSha)}</span>
                            ${c.htmlUrl ? `<a href="${escapeHtml(c.htmlUrl)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">GitHub</a>` : ""}
                        </div>
                    `;

                    commitsList.appendChild(item);
                });
            }

            if (commitsLoadMoreContainer) {
                if (commits && commits.length === PAGE_SIZE) {
                    commitsLoadMoreContainer.style.display = "block";
                } else {
                    commitsLoadMoreContainer.style.display = "none";
                }
            }
        } catch (err) {
            console.error("Error loading commits tab:", err);
            if (!isLoadMore) {
                commitsList.innerHTML = `<div style="padding: 20px; color: var(--color-danger-base);">${escapeHtml(err.message)}</div>`;
            }
        } finally {
            if (commitsLoadMoreBtn) {
                commitsLoadMoreBtn.disabled = false;
                commitsLoadMoreBtn.classList.remove("is-loading");
            }
        }
    }

    // ==========================================================================
    // Set / Change GitHub Repo
    // ==========================================================================
    function setupSetRepoHandlers(isLeader) {
        if (openSetRepoBtn) {
            openSetRepoBtn.addEventListener("click", () => {
                if (setRepoModal) {
                    if (setRepoAlert) setRepoAlert.style.display = "none";
                    if (setRepoInput && repoInfo) setRepoInput.value = repoInfo.htmlUrl || "";
                    setRepoModal.style.display = "flex";
                }
            });
        }

        if (closeSetRepoBtn) {
            closeSetRepoBtn.addEventListener("click", () => {
                if (setRepoModal) setRepoModal.style.display = "none";
            });
        }

        if (setRepoForm) {
            setRepoForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const url = setRepoInput ? setRepoInput.value.trim() : "";
                if (!url) return;

                if (setRepoAlert) setRepoAlert.style.display = "none";
                const submitBtn = setRepoForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;

                try {
                    const res = await apiFetch(`/api/projects/${projectId}/github/repo-url`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ repositoryUrl: url })
                    });

                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.message || "Не вдалося прив'язати репозиторій.");
                    }

                    if (setRepoModal) setRepoModal.style.display = "none";
                    showActiveRepoView();
                    await loadRepoInfo();
                } catch (err) {
                    if (setRepoAlert) {
                        setRepoAlert.textContent = err.message;
                        setRepoAlert.style.display = "block";
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }
    }

    function getFileIcon(name) {
        if (!name) return `<span class="git-item-icon-box"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></span>`;

        const lower = name.toLowerCase();

        // Exact file names & dotfiles
        if (lower.startsWith(".git") || lower === ".gitmodules" || lower === ".gitattributes" || lower === ".gitignore") {
            return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--git">GIT</span></span>`;
        }
        if (lower.startsWith(".editorconfig") || lower.startsWith(".prettier") || lower.startsWith(".eslint") || lower === ".config") {
            return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--cfg">CFG</span></span>`;
        }
        if (lower === "dockerfile" || lower.endsWith(".dockerfile")) {
            return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--docker">DOCK</span></span>`;
        }
        if (lower === "package.json" || lower === "package-lock.json") {
            return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--npm">NPM</span></span>`;
        }
        if (lower.includes("license") || lower.includes("security") || lower.includes("notice") || lower.includes("code_of_conduct")) {
            return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--info">LIC</span></span>`;
        }

        const ext = lower.includes(".") ? lower.split(".").pop() : "";

        if (ext === "cs") return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--cs">C#</span></span>`;
        if (ext === "ts" || ext === "tsx") return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--ts">TS</span></span>`;
        if (ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--js">JS</span></span>`;
        if (ext === "json") return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--json">JSON</span></span>`;
        if (ext === "md" || ext === "markdown") return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--md">MD</span></span>`;
        if (ext === "sh" || ext === "ps1" || ext === "cmd" || ext === "bat") return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--sh">SH</span></span>`;
        if (ext === "yml" || ext === "yaml") return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--yaml">YML</span></span>`;
        if (ext === "css" || ext === "scss" || ext === "less") return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--css">CSS</span></span>`;
        if (ext === "html" || ext === "htm" || ext === "cshtml") return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--html">HTML</span></span>`;
        if (ext === "xml" || ext === "props" || ext === "targets" || ext === "slnx" || ext === "sln" || ext === "csproj") {
            return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--xml">XML</span></span>`;
        }
        if (ext === "py") return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--py">PY</span></span>`;
        if (ext === "sql") return `<span class="git-item-icon-box"><span class="git-file-badge git-file-badge--sql">SQL</span></span>`;

        return `<span class="git-item-icon-box"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></span>`;
    }

    // Expose jump-to-code function for chat code quote cards
    window.LinqUpGitWorkspace = {
        openFileAtLines: function (path, branch, startLine, endLine) {
            const gitNavBtn = document.querySelector('.workspace-nav-btn[data-view="github"]');
            if (gitNavBtn) gitNavBtn.click();

            const codeTabBtn = document.querySelector('.git-subtab-btn[data-subtab="code"]');
            if (codeTabBtn) codeTabBtn.click();

            currentBranch = branch || currentBranch;
            if (gitBranchSelect) {
                gitBranchSelect.value = currentBranch;
                if (typeof refreshCustomSelect === "function") {
                    refreshCustomSelect(gitBranchSelect);
                } else if (window.refreshCustomSelect) {
                    window.refreshCustomSelect(gitBranchSelect);
                }
            }

            loadFileContent(currentBranch, path, { start: startLine, end: endLine });
        }
    };
})();
