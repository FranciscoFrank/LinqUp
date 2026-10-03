// ==========================================================================
// LinqUp FAQ Page Script (Search, Category Filters, Accordions, Deep-linking)
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("faq-search-input");
    const searchClearBtn = document.getElementById("faq-search-clear");
    const searchStatus = document.getElementById("faq-search-status");
    const searchCountEl = document.getElementById("faq-search-count");
    const emptyState = document.getElementById("faq-empty-state");
    const categoryBtns = document.querySelectorAll(".faq-category-btn");
    const expandAllBtn = document.getElementById("faq-expand-all");
    const collapseAllBtn = document.getElementById("faq-collapse-all");
    const faqCards = document.querySelectorAll(".faq-card");

    let currentCategory = "all";
    let searchQuery = "";

    // ----------------------------------------------------------------------
    // 1. Accordion Toggle Logic
    // ----------------------------------------------------------------------
    faqCards.forEach((card) => {
        const trigger = card.querySelector(".faq-trigger");
        if (!trigger) return;

        trigger.addEventListener("click", () => {
            const isOpen = card.classList.contains("is-open");
            toggleCard(card, !isOpen);
        });

        trigger.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const isOpen = card.classList.contains("is-open");
                toggleCard(card, !isOpen);
            }
        });
    });

    function toggleCard(card, open) {
        const trigger = card.querySelector(".faq-trigger");
        if (open) {
            card.classList.add("is-open");
            if (trigger) trigger.setAttribute("aria-expanded", "true");
        } else {
            card.classList.remove("is-open");
            if (trigger) trigger.setAttribute("aria-expanded", "false");
        }
    }

    // ----------------------------------------------------------------------
    // 2. Expand All / Collapse All
    // ----------------------------------------------------------------------
    if (expandAllBtn) {
        expandAllBtn.addEventListener("click", () => {
            faqCards.forEach((card) => {
                if (card.style.display !== "none") {
                    toggleCard(card, true);
                }
            });
        });
    }

    if (collapseAllBtn) {
        collapseAllBtn.addEventListener("click", () => {
            faqCards.forEach((card) => {
                toggleCard(card, false);
            });
        });
    }

    // ----------------------------------------------------------------------
    // 3. Filtering & Search Integration
    // ----------------------------------------------------------------------
    function applyFilters() {
        let visibleCount = 0;
        const normalizedQuery = searchQuery.trim().toLowerCase();

        faqCards.forEach((card) => {
            const cardCategory = card.getAttribute("data-category") || "general";
            const questionText = card.querySelector(".faq-question-text")?.textContent?.toLowerCase() || "";
            const bodyText = card.querySelector(".faq-body")?.textContent?.toLowerCase() || "";

            const matchesCategory = currentCategory === "all" || cardCategory === currentCategory;
            const matchesSearch = !normalizedQuery || 
                                  questionText.includes(normalizedQuery) || 
                                  bodyText.includes(normalizedQuery);

            if (matchesCategory && matchesSearch) {
                card.style.display = "";
                visibleCount++;
                // If filtering by search, auto-expand matching cards
                if (normalizedQuery.length >= 3) {
                    toggleCard(card, true);
                }
            } else {
                card.style.display = "none";
            }
        });

        // Search status & counter
        if (searchStatus && searchCountEl) {
            if (normalizedQuery) {
                searchStatus.classList.add("is-visible");
                searchCountEl.textContent = visibleCount;
            } else {
                searchStatus.classList.remove("is-visible");
            }
        }

        // Empty state
        if (emptyState) {
            if (visibleCount === 0) {
                emptyState.classList.add("is-visible");
            } else {
                emptyState.classList.remove("is-visible");
            }
        }
    }

    // Category button clicks
    categoryBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            categoryBtns.forEach((b) => b.classList.remove("is-active"));
            btn.classList.add("is-active");
            currentCategory = btn.getAttribute("data-category") || "all";
            applyFilters();
        });
    });

    // Search input
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            searchQuery = searchInput.value;
            if (searchClearBtn) {
                searchClearBtn.classList.toggle("is-visible", searchQuery.length > 0);
            }
            applyFilters();
        });

        if (searchClearBtn) {
            searchClearBtn.addEventListener("click", () => {
                searchInput.value = "";
                searchQuery = "";
                searchClearBtn.classList.remove("is-visible");
                searchInput.focus();
                applyFilters();
            });
        }
    }

    // ----------------------------------------------------------------------
    // 4. URL Hash Deep-linking
    // ----------------------------------------------------------------------
    function checkHashDeepLink() {
        const hash = window.location.hash.replace("#", "");
        if (!hash) return;

        const targetCard = document.getElementById(hash);
        if (targetCard && targetCard.classList.contains("faq-card")) {
            // Ensure card is visible even if category was filtered
            currentCategory = "all";
            categoryBtns.forEach((b) => {
                b.classList.toggle("is-active", b.getAttribute("data-category") === "all");
            });
            applyFilters();

            toggleCard(targetCard, true);
            setTimeout(() => {
                targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
        }
    }

    window.addEventListener("hashchange", checkHashDeepLink);
    checkHashDeepLink();
});
