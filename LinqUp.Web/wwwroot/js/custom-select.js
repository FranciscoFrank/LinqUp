function escapeSelectHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderCustomSelectOptions(wrapper) {
    const select = wrapper.querySelector("select");
    const trigger = wrapper.querySelector(".custom-select-trigger");
    const list = wrapper.querySelector(".custom-select-options");

    list.innerHTML = "";

    const isGitBranch = select.classList.contains("git-branch-select") || select.dataset.icon === "git-branch";

    Array.from(select.options).forEach((option, index) => {
        const item = document.createElement("li");
        item.className = "custom-select-option";
        item.setAttribute("role", "option");
        item.setAttribute("data-index", String(index));

        if (isGitBranch) {
            const isDefault = option.dataset.isDefault === "true" || option.textContent.includes("(default)");
            const branchName = option.value || option.textContent.replace(/\s*\(default\)\s*$/, "");
            item.innerHTML = `
                <span class="custom-select-option-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>
                </span>
                <span class="custom-select-option-text">${escapeSelectHtml(branchName)}</span>
                ${isDefault ? '<span class="custom-select-badge-default">default</span>' : ''}
            `;
        } else {
            item.textContent = option.textContent;
        }

        if (option.disabled) {
            item.classList.add("is-disabled");
        }
        if (option.selected) {
            item.classList.add("is-selected");
        }

        item.addEventListener("click", () => {
            if (option.disabled) return;
            selectOption(wrapper, index);
            closeCustomSelect(wrapper);
        });

        list.appendChild(item);
    });

    updateTriggerLabel(wrapper);
}

function updateTriggerLabel(wrapper) {
    const select = wrapper.querySelector("select");
    const trigger = wrapper.querySelector(".custom-select-trigger");
    if (!select || !trigger) return;

    const selected = select.options[select.selectedIndex];
    let text = selected ? selected.textContent : "";
    if (select.classList.contains("git-branch-select") || select.dataset.icon === "git-branch") {
        text = selected ? (selected.value || text.replace(/\s*\(default\)\s*$/, "")) : "";
    }

    const textSpan = trigger.querySelector(".custom-select-text");
    if (textSpan) {
        textSpan.textContent = text;
        textSpan.title = text;
    } else {
        trigger.textContent = text;
        trigger.title = text;
    }
}

function selectOption(wrapper, index) {
    const select = wrapper.querySelector("select");
    if (select.selectedIndex === index) return;

    select.selectedIndex = index;
    select.dispatchEvent(new Event("change", { bubbles: true }));

    wrapper.querySelectorAll(".custom-select-option").forEach((el, i) => {
        el.classList.toggle("is-selected", i === index);
    });
    updateTriggerLabel(wrapper);
}

function openCustomSelect(wrapper) {
    document.querySelectorAll(".custom-select.is-open").forEach((el) => {
        if (el !== wrapper) closeCustomSelect(el);
    });
    wrapper.classList.add("is-open");

    const selected = wrapper.querySelector(".custom-select-option.is-selected");
    if (selected) {
        selected.scrollIntoView({ block: "nearest" });
    }
}

function closeCustomSelect(wrapper) {
    wrapper.classList.remove("is-open");
}

function moveCustomSelectSelection(wrapper, delta) {
    const select = wrapper.querySelector("select");
    let index = select.selectedIndex;
    const options = Array.from(select.options);

    for (let step = 0; step < options.length; step++) {
        index = Math.min(Math.max(index + delta, 0), options.length - 1);
        if (!options[index].disabled) {
            selectOption(wrapper, index);
            return;
        }
    }
}

function enhanceSelect(select) {
    if (!select) return;
    if (select.dataset.customSelectReady === "true") {
        const wrapper = select.closest(".custom-select");
        if (wrapper) renderCustomSelectOptions(wrapper);
        return;
    }
    select.dataset.customSelectReady = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";
    if (select.dataset.customClass) {
        select.dataset.customClass.split(" ").filter(Boolean).forEach(cls => wrapper.classList.add(cls));
    }
    if (select.classList.contains("git-branch-select")) {
        wrapper.classList.add("custom-select--branch");
    }

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";

    if (select.dataset.icon === "git-branch" || select.classList.contains("git-branch-select")) {
        const iconSpan = document.createElement("span");
        iconSpan.className = "custom-select-icon";
        iconSpan.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>`;
        trigger.appendChild(iconSpan);

        const textSpan = document.createElement("span");
        textSpan.className = "custom-select-text";
        trigger.appendChild(textSpan);
    }

    const list = document.createElement("ul");
    list.className = "custom-select-options";
    list.setAttribute("role", "listbox");

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(trigger);
    wrapper.appendChild(list);
    wrapper.appendChild(select);
    select.classList.add("custom-select-native");

    trigger.addEventListener("click", () => {
        wrapper.classList.contains("is-open") ? closeCustomSelect(wrapper) : openCustomSelect(wrapper);
    });

    trigger.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            wrapper.classList.contains("is-open") ? closeCustomSelect(wrapper) : openCustomSelect(wrapper);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            openCustomSelect(wrapper);
            moveCustomSelectSelection(wrapper, 1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            openCustomSelect(wrapper);
            moveCustomSelectSelection(wrapper, -1);
        } else if (e.key === "Escape") {
            closeCustomSelect(wrapper);
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const char = e.key.toLowerCase();
            const options = Array.from(select.options);
            const foundIndex = options.findIndex((opt, idx) => idx > select.selectedIndex && opt.textContent.trim().toLowerCase().startsWith(char));
            const targetIndex = foundIndex !== -1 ? foundIndex : options.findIndex(opt => opt.textContent.trim().toLowerCase().startsWith(char));
            if (targetIndex !== -1 && !options[targetIndex].disabled) {
                selectOption(wrapper, targetIndex);
                const items = wrapper.querySelectorAll(".custom-select-option");
                if (items[targetIndex]) items[targetIndex].scrollIntoView({ block: "nearest" });
            }
        }
    });

    select.addEventListener("change", () => {
        wrapper.querySelectorAll(".custom-select-option").forEach((el, i) => {
            el.classList.toggle("is-selected", i === select.selectedIndex);
        });
        updateTriggerLabel(wrapper);
    });

    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) {
            closeCustomSelect(wrapper);
        }
    });

    renderCustomSelectOptions(wrapper);
}

function refreshCustomSelect(select) {
    enhanceSelect(select);
}

window.enhanceSelect = enhanceSelect;
window.refreshCustomSelect = refreshCustomSelect;

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("select.select").forEach(enhanceSelect);
});
