(function () {
  const header = document.querySelector("[data-header]");
  const menuButton = document.querySelector("[data-menu-button]");
  const dropdownButton = document.querySelector("[data-dropdown-button]");
  const dropdown = dropdownButton ? dropdownButton.closest(".nav-dropdown") : null;

  function setMenu(open) {
    if (!header || !menuButton) return;
    header.classList.toggle("nav-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
  }

  function setDropdown(open) {
    if (!dropdown || !dropdownButton) return;
    dropdown.classList.toggle("is-open", open);
    dropdownButton.setAttribute("aria-expanded", String(open));
  }

  if (menuButton) {
    menuButton.addEventListener("click", function () {
      setMenu(!header.classList.contains("nav-open"));
    });
  }

  if (dropdownButton) {
    dropdownButton.addEventListener("click", function (event) {
      event.preventDefault();
      setDropdown(!dropdown.classList.contains("is-open"));
    });
  }

  document.addEventListener("click", function (event) {
    if (header && !header.contains(event.target)) {
      setMenu(false);
      setDropdown(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setMenu(false);
      setDropdown(false);
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 920) {
      setMenu(false);
      setDropdown(false);
    }
  });

  document.querySelectorAll("[data-backend-form]").forEach(function (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      const honeypot = form.querySelector("[data-honeypot]");
      const successMessage = form.querySelector("[data-success-message]");
      const errorMessage = form.querySelector("[data-error-message]");
      const submitButton = form.querySelector("[type='submit']");
      const endpoint = form.getAttribute("action");
      const originalButtonHtml = submitButton ? submitButton.innerHTML : "";

      if (honeypot && honeypot.value.trim()) {
        return;
      }

      if (!endpoint) {
        if (errorMessage) {
          errorMessage.hidden = false;
        }
        return;
      }

      if (errorMessage) {
        errorMessage.hidden = true;
      }
      if (successMessage) {
        successMessage.hidden = true;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: new FormData(form),
          headers: {
            Accept: "application/json"
          }
        });
        const data = await response.json().catch(function () {
          return {};
        });

        if (!response.ok || !data.ok) {
          throw new Error(data.message || "Submission failed. Please try again.");
        }

        form.reset();
        if (successMessage) {
          successMessage.hidden = false;
        }
      } catch (error) {
        if (errorMessage) {
          errorMessage.textContent = error.message || "Submission failed. Please try again or contact Bloompath directly.";
          errorMessage.hidden = false;
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = originalButtonHtml;
        }

        if (window.lucide) {
          window.lucide.createIcons({
            attrs: {
              "aria-hidden": "true"
            }
          });
        }
      }
    });
  });

  if (window.lucide) {
    window.lucide.createIcons({
      attrs: {
        "aria-hidden": "true"
      }
    });
  }
}());
