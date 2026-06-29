// Content script injected to auto-fill job application forms
// Matches form field labels/names/placeholders to profile data

(function (profileData) {
  const data = profileData;
  let filled = 0;

  const matchers = [
    { keys: ["first_name", "first name", "firstname", "given name", "fname", "preferred first name", "preferred name"], value: data.first_name },
    { keys: ["last_name", "last name", "lastname", "family name", "surname", "lname"], value: data.last_name },
    { keys: ["full_name", "full name", "legal full name", "legal name", "name", "your name", "candidate name", "applicant name"], value: data.full_name },
    { keys: ["email", "e-mail", "email address"], value: data.email },
    { keys: ["phone", "phone number", "mobile", "telephone", "cell", "contact number"], value: data.phone },
    { keys: ["linkedin", "linkedin profile", "linkedin url"], value: data.linkedin },
    { keys: ["github", "github profile", "github url"], value: data.github },
    { keys: ["website", "portfolio", "personal website", "portfolio url", "personal site", "blog"], value: data.website || data.substack },
    { keys: ["city", "current city"], value: data.city },
    { keys: ["state", "province"], value: data.state },
    { keys: ["location", "current location", "address"], value: data.location },
    { keys: ["current title", "job title", "current role", "title", "current position"], value: data.current_title },
    { keys: ["current company", "company", "current employer", "employer", "organization"], value: data.current_company },
  ];

  function normalize(str) {
    return (str || "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  }

  function getFieldLabel(el) {
    const texts = [];

    // Explicit label via for=
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) texts.push(label.textContent);
    }

    // Wrapping label
    const parentLabel = el.closest("label");
    if (parentLabel) texts.push(parentLabel.textContent);

    // aria-label / aria-labelledby
    if (el.getAttribute("aria-label")) texts.push(el.getAttribute("aria-label"));
    if (el.getAttribute("aria-labelledby")) {
      const ref = document.getElementById(el.getAttribute("aria-labelledby"));
      if (ref) texts.push(ref.textContent);
    }

    // Walk up to find the nearest container with a label-like element
    let container = el.parentElement;
    for (let i = 0; i < 5 && container; i++) {
      const labelEl = container.querySelector("label, legend, [class*='label'], h3, h4");
      if (labelEl && labelEl !== el && !labelEl.contains(el)) {
        texts.push(labelEl.textContent);
        break;
      }
      container = container.parentElement;
    }

    // Check preceding sibling elements for label text
    let prev = el.previousElementSibling;
    for (let i = 0; i < 3 && prev; i++) {
      const tag = prev.tagName;
      if (tag === "LABEL" || tag === "P" || tag === "SPAN" || tag === "DIV" || tag === "H3" || tag === "H4") {
        const t = prev.textContent.trim();
        if (t.length > 0 && t.length < 100) { texts.push(t); break; }
      }
      prev = prev.previousElementSibling;
    }

    // Attributes
    texts.push(el.name, el.placeholder, el.id);

    return texts.filter(Boolean).map(normalize).join(" ");
  }

  function setInputValue(el, value) {
    if (!value || !el || el.disabled || el.readOnly) return false;
    if (el.value && el.value.trim()) return false; // Don't overwrite

    const nativeSet = Object.getOwnPropertyDescriptor(
      el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value"
    )?.set;
    if (nativeSet) {
      nativeSet.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // Fill text inputs and textareas
  const fields = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input:not([type]), textarea');
  for (const el of fields) {
    const label = getFieldLabel(el);
    if (!label) continue;

    for (const matcher of matchers) {
      if (matcher.value && matcher.keys.some((k) => label.includes(k))) {
        if (setInputValue(el, matcher.value)) {
          filled++;
          el.style.outline = "2px solid #34d399";
          setTimeout(() => { el.style.outline = ""; }, 2000);
        }
        break;
      }
    }
  }

  // Handle yes/no buttons for work authorization
  const allText = document.body.innerText.toLowerCase();
  if (allText.includes("eligible to work") || allText.includes("authorized to work") || allText.includes("legally authorized")) {
    const buttons = document.querySelectorAll('button, [role="button"], [role="option"], label');
    for (const btn of buttons) {
      const text = btn.textContent.trim().toLowerCase();
      const container = btn.closest("[class*='question'], [class*='field'], fieldset, [data-qa]");
      const question = container?.textContent?.toLowerCase() ?? "";
      if ((question.includes("eligible") || question.includes("authorized")) && text === "yes") {
        btn.click();
        filled++;
        break;
      }
    }
  }

  if (allText.includes("sponsorship") || allText.includes("visa sponsorship")) {
    const buttons = document.querySelectorAll('button, [role="button"], [role="option"], label');
    for (const btn of buttons) {
      const text = btn.textContent.trim().toLowerCase();
      const container = btn.closest("[class*='question'], [class*='field'], fieldset, [data-qa]");
      const question = container?.textContent?.toLowerCase() ?? "";
      if (question.includes("sponsorship") && text === "no") {
        btn.click();
        filled++;
        break;
      }
    }
  }

  return filled;
})(__PROFILE_DATA__);
