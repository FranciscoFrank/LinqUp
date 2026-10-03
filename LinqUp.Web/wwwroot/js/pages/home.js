document.getElementById("hero-cta-primary").href = withCulture("/auth/register");

const contactSubmitBtn = document.getElementById("contact-submit");

document.getElementById("contact-form").addEventListener("submit", (e) => {
    e.preventDefault();
    withLoading(contactSubmitBtn, async () => {
        const successEl = document.getElementById("contact-success");
        const errorEl = document.getElementById("contact-error");
        successEl.textContent = "";
        errorEl.textContent = "";

        const payload = {
            name: document.getElementById("contact-name").value.trim(),
            email: document.getElementById("contact-email").value.trim(),
            subject: document.getElementById("contact-subject").value.trim(),
            message: document.getElementById("contact-message").value.trim()
        };

        try {
            const res = await fetch("/contact/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                errorEl.textContent = translateI18n("contact.formError");
                return;
            }

            successEl.textContent = translateI18n("contact.formSuccess");
            document.getElementById("contact-form").reset();
        } catch {
            errorEl.textContent = translateI18n("common.errorNetwork");
        }
    })();
});

// FAQ Accordion Toggle Interaction on Homepage
document.querySelectorAll(".home-faq-section .faq-card").forEach((card) => {
    const trigger = card.querySelector(".faq-trigger");
    if (!trigger) return;

    const toggle = () => {
        const isOpen = card.classList.contains("is-open");
        card.classList.toggle("is-open", !isOpen);
        trigger.setAttribute("aria-expanded", (!isOpen).toString());
    };

    trigger.addEventListener("click", toggle);
    trigger.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
        }
    });
});

