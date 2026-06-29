const API_BASE = "https://jobs.fieldlines.org";

const $ = (id) => document.getElementById(id);
let pageData = null;
let fullPostingText = "";

async function clipPage() {
  $("loading").style.display = "block";
  $("form").style.display = "none";
  $("statusMsg").style.display = "none";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    pageData = results?.[0]?.result;
    if (!pageData?.text) throw new Error("No content extracted");

    const quick = extractLocally(pageData);
    fillForm(quick);
    $("loading").style.display = "none";
    $("form").style.display = "block";

    const hasBasics = quick.company && quick.title;
    if (!hasBasics) {
      extractWithAI(pageData);
    }
  } catch (err) {
    showStatus("error", err.message || "Failed to read the page.");
    $("loading").style.display = "none";
  }
}

async function init() {
  const clipBtn = $("clipBtn");
  if (clipBtn) {
    // Side panel mode — wait for user to click "Clip this page"
    clipBtn.addEventListener("click", clipPage);
  } else {
    // Popup mode — clip immediately
    clipPage();
  }
}

function extractLocally(data) {
  const result = {
    company: "",
    title: "",
    location: "",
    remoteType: "",
    salary: "",
    url: data.url || "",
    postingText: data.text || "",
  };

  // From JSON-LD (most reliable)
  if (data.jsonLd) {
    const jl = data.jsonLd;
    result.title = jl.title || jl.name || "";
    if (jl.hiringOrganization) {
      result.company =
        typeof jl.hiringOrganization === "string"
          ? jl.hiringOrganization
          : jl.hiringOrganization.name || "";
    }
    if (jl.jobLocation) {
      const loc = Array.isArray(jl.jobLocation) ? jl.jobLocation[0] : jl.jobLocation;
      if (loc?.address) {
        const a = loc.address;
        result.location = [a.addressLocality, a.addressRegion].filter(Boolean).join(", ");
      }
    }
    if (jl.jobLocationType === "TELECOMMUTE") result.remoteType = "remote";
    if (jl.baseSalary) {
      const s = jl.baseSalary;
      if (s.value) {
        const v = s.value;
        const unit = s.currency === "USD" ? "$" : (s.currency || "$");
        if (v.minValue && v.maxValue) {
          result.salary = `${unit}${Math.round(v.minValue / 1000)}k–${unit}${Math.round(v.maxValue / 1000)}k`;
        } else if (v.value) {
          result.salary = `${unit}${Math.round(v.value / 1000)}k`;
        }
      }
    }
    if (jl.description) {
      result.postingText = jl.description
        .replace(/<[^>]+>/g, "\n")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
  }

  // Title: h1 is usually the job title on posting pages
  if (!result.title && data.h1) {
    result.title = data.h1;
  }

  // Company: og:site_name is very reliable
  if (!result.company && data.ogCompany) {
    result.company = data.ogCompany;
  }

  // Fallback: parse company and title from page title or og:title
  if (!result.company || !result.title) {
    const candidates = [data.ogTitle, data.title].filter(Boolean);
    const patterns = [
      /^(.+?)\s+at\s+(.+?)(?:\s*[-–|·]|$)/i,
      /^(.+?)\s*[-–|]\s*(.+?)(?:\s*[-–|]|$)/,
      /^(.+?)\s*·\s*(.+)/,
    ];
    for (const text of candidates) {
      let matched = false;
      for (const p of patterns) {
        const m = text.match(p);
        if (m) {
          if (!result.title) result.title = m[1].trim();
          if (!result.company) result.company = m[2].trim();
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
  }

  // Scan text for salary range
  if (!result.salary && data.text) {
    const salaryMatch = data.text.match(
      /\$[\d,]+(?:\.\d+)?(?:k)?\s*[-–—to]+\s*\$[\d,]+(?:\.\d+)?(?:k)?(?:\s*(?:per\s+)?(?:year|annually|yr|pa))?/i
    );
    if (salaryMatch) result.salary = salaryMatch[0];
  }

  // Scan for remote/hybrid/onsite
  if (!result.remoteType && data.text) {
    const t = data.text.slice(0, 3000).toLowerCase();
    if (/\b(?:fully\s+)?remote\b/.test(t)) result.remoteType = "remote";
    else if (/\bhybrid\b/.test(t)) result.remoteType = "hybrid";
    else if (/\bon[\s-]?site\b|\bin[\s-]?office\b/.test(t)) result.remoteType = "onsite";
  }

  // Scan for location from common patterns in first ~2000 chars
  if (!result.location && data.text) {
    const locMatch = data.text.slice(0, 2000).match(
      /(?:(?:San\s+Francisco|New\s+York|Los\s+Angeles|Mountain\s+View|Palo\s+Alto|San\s+Jose|Cupertino|Seattle|Austin|Chicago|Boston|Denver|Portland|Atlanta|Miami|Dallas|Houston|Phoenix|Minneapolis|Salt\s+Lake\s+City|Washington|San\s+Diego|Sunnyvale|Menlo\s+Park|Santa\s+Clara|Redwood\s+City|San\s+Mateo)[,\s]+(?:CA|NY|WA|TX|IL|MA|CO|OR|GA|FL|AZ|MN|UT|DC|[A-Z]{2}))/
    );
    if (locMatch) result.location = locMatch[0].trim();
  }

  return result;
}

function fillForm(data) {
  $("company").value = data.company || "";
  $("title").value = data.title || "";
  $("location").value = data.location || "";
  $("remoteType").value = data.remoteType || "";
  $("salary").value = data.salary || "";
  $("url").value = data.url || "";
  fullPostingText = data.postingText || "";
  $("postingPreview").textContent =
    fullPostingText.slice(0, 500) + (fullPostingText.length > 500 ? "…" : "");
  $("charCount").textContent = `${fullPostingText.length.toLocaleString()} chars`;
}

async function extractWithAI(data) {
  $("extractBtn").disabled = true;
  $("extractBtn").textContent = "Extracting…";
  try {
    const res = await fetch(`${API_BASE}/api/jobs/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: data.text, url: data.url }),
    });
    if (!res.ok) {
      $("extractBtn").textContent = "Re-extract with AI";
      $("extractBtn").disabled = false;
      return;
    }
    const result = await res.json();
    // Only overwrite fields that AI found and the user hasn't manually changed
    if (result.company && !$("company").value) $("company").value = result.company;
    if (result.jobTitle && !$("title").value) $("title").value = result.jobTitle;
    if (result.location && !$("location").value) $("location").value = result.location;
    if (result.remoteType && !$("remoteType").value) $("remoteType").value = result.remoteType;
    if (result.salaryText && !$("salary").value) $("salary").value = trimSalary(result.salaryText);
    if (result.jobDescription) {
      fullPostingText = result.jobDescription;
      $("postingPreview").textContent =
        fullPostingText.slice(0, 500) + (fullPostingText.length > 500 ? "…" : "");
      $("charCount").textContent = `${fullPostingText.length.toLocaleString()} chars`;
    }
    $("extractBtn").textContent = "Re-extract with AI";
    $("extractBtn").disabled = false;
  } catch {
    $("extractBtn").textContent = "Re-extract with AI";
    $("extractBtn").disabled = false;
  }
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("saveBtn").disabled = true;
  $("saveBtn").textContent = "Saving…";
  try {
    const res = await fetch(`${API_BASE}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: $("company").value,
        title: $("title").value,
        url: $("url").value,
        location: $("location").value,
        remote_type: $("remoteType").value,
        salary_text: $("salary").value,
        posting_text: fullPostingText,
        source: "extension",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = typeof data?.error === "string" ? data.error : JSON.stringify(data?.error ?? data);
      throw new Error(msg.length > 200 ? "Validation failed — check the fields and try again." : msg);
    }
    const verb = data.merged ? "Updated existing job" : "Saved";
    showStatus("success", `${verb}! <a href="${API_BASE}/jobs/${data.job.id}" target="_blank" style="color:inherit;text-decoration:underline">View job →</a>`);
    $("form").style.display = "none";
    $("saveBtn").disabled = false;
    $("saveBtn").textContent = "Save Job";
  } catch (err) {
    showStatus("error", err.message);
    $("saveBtn").disabled = false;
    $("saveBtn").textContent = "Save Job";
  }
});

$("extractBtn").addEventListener("click", () => {
  if (pageData) extractWithAI(pageData);
});

function trimSalary(text) {
  if (!text || text.length <= 100) return text;
  // Try to extract just a salary range like "$175,600 – $327,800"
  const m = text.match(/\$[\d,]+(?:\.\d+)?(?:k)?\s*[-–—to]+\s*\$[\d,]+(?:\.\d+)?(?:k)?/i);
  if (m) return m[0];
  // Truncate to first sentence
  const dot = text.indexOf(".");
  if (dot > 0 && dot < 150) return text.slice(0, dot + 1);
  return text.slice(0, 100);
}

async function fillApplication() {
  const fillBtn = $("fillBtn");
  if (!fillBtn) return;
  fillBtn.disabled = true;
  fillBtn.textContent = "Filling…";

  try {
    const res = await fetch(`${API_BASE}/api/profile/autofill`, { credentials: "include" });
    if (!res.ok) throw new Error("No profile data — add a resume on the Profile page first.");
    const profileData = await res.json();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [profileData],
      func: autofillPage,
    });

    const count = results?.[0]?.result ?? 0;
    showStatus("success", `Filled ${count} field${count !== 1 ? "s" : ""}. Review before submitting.`);
  } catch (err) {
    showStatus("error", err.message || "Failed to fill form.");
  } finally {
    fillBtn.disabled = false;
    fillBtn.textContent = "Fill application";
  }
}

function autofillPage(data) {
  let filled = 0;

  const matchers = [
    { keys: ["first_name", "first name", "firstname", "given name", "fname", "preferred first name", "preferred name"], value: data.first_name },
    { keys: ["last_name", "last name", "lastname", "family name", "surname", "lname"], value: data.last_name },
    { keys: ["full_name", "full name", "legal full name", "legal name", "your name", "candidate name", "applicant name"], value: data.full_name },
    { keys: ["email", "e-mail", "email address"], value: data.email },
    { keys: ["phone", "phone number", "mobile", "telephone", "cell", "contact number"], value: data.phone },
    { keys: ["linkedin", "linkedin profile", "linkedin url"], value: data.linkedin },
    { keys: ["github", "github profile", "github url"], value: data.github },
    { keys: ["website", "portfolio", "personal website", "portfolio url", "personal site", "blog"], value: data.website || data.substack },
    { keys: ["city", "current city"], value: data.city },
    { keys: ["state", "province"], value: data.state },
    { keys: ["location", "current location", "address"], value: data.location },
    { keys: ["current title", "job title", "current role", "current position"], value: data.current_title },
    { keys: ["current company", "company", "current employer", "employer", "organization"], value: data.current_company },
  ];

  function normalize(str) {
    return (str || "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  }

  function getFieldLabel(el) {
    const texts = [];
    if (el.id) {
      const label = document.querySelector("label[for='" + CSS.escape(el.id) + "']");
      if (label) texts.push(label.textContent);
    }
    const parentLabel = el.closest("label");
    if (parentLabel) texts.push(parentLabel.textContent);
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
    texts.push(el.name, el.placeholder, el.id);
    return texts.filter(Boolean).map(normalize).join(" ");
  }

  function setVal(el, value) {
    if (!value || !el || el.disabled || el.readOnly) return false;
    if (el.value && el.value.trim()) return false;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value");
    if (setter && setter.set) { setter.set.call(el, value); } else { el.value = value; }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const fields = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input:not([type]), textarea');
  for (const el of fields) {
    const label = getFieldLabel(el);
    if (!label) continue;
    // "name" alone is too generic — only match if it's the only word or clearly a name field
    for (const matcher of matchers) {
      if (matcher.value && matcher.keys.some((k) => label.includes(k))) {
        if (setVal(el, matcher.value)) {
          filled++;
          el.style.outline = "2px solid #34d399";
          setTimeout(() => { el.style.outline = ""; }, 2000);
        }
        break;
      }
    }
  }

  // Yes/No buttons for work authorization
  function clickYesNo(questionWords, answer) {
    const buttons = document.querySelectorAll('button, [role="button"], [role="option"], label, input[type="radio"]');
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || "").trim().toLowerCase();
      const container = btn.closest("[class*='question'], [class*='field'], fieldset, [data-qa], [class*='group']");
      const question = (container?.textContent || "").toLowerCase();
      if (questionWords.some((w) => question.includes(w)) && text === answer) {
        btn.click();
        filled++;
        return;
      }
    }
  }

  clickYesNo(["eligible to work", "authorized to work", "legally authorized"], "yes");
  clickYesNo(["sponsorship", "visa sponsorship"], "no");

  return filled;
}

if ($("fillBtn")) {
  $("fillBtn").addEventListener("click", fillApplication);
}

function showStatus(type, msg) {
  const el = $("statusMsg");
  el.className = `status ${type}`;
  el.innerHTML = msg;
  el.style.display = "block";
}

init();
