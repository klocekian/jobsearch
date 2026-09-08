// Content script injected into the active tab to extract job posting data.
// Runs in the page context so it has full DOM access — no bot detection issues.

(function () {
  const result = {
    url: location.href,
    title: "",
    ogTitle: "",
    ogCompany: "",
    ogDesc: "",
    metaDesc: "",
    h1: "",
    text: "",
    jsonLd: null,
    extractedFrom: "walk",
  };

  // ---------------------------------------------------------------------
  // Site-specific extractors.
  //
  // On job-board apps the posting is one panel inside a full application
  // shell. LinkedIn is the worst offender: <main> also contains the results
  // list, applicant insights, "People also viewed" and similar-jobs rails, so
  // a whole-page text walk captures several other postings plus the viewer's
  // own profile data.
  //
  // Selectors are ordered most- to least-specific and treated as best-effort:
  // LinkedIn changes class names regularly, so a miss falls through to the
  // generic walk rather than failing.
  // ---------------------------------------------------------------------
  const SITE_EXTRACTORS = [
    {
      match: /(^|\.)linkedin\.com$/i,
      description: [
        "#job-details",
        ".jobs-description__content .jobs-box__html-content",
        ".jobs-description-content__text",
        ".jobs-box__html-content",
        ".jobs-description__container",
        ".show-more-less-html__markup",
        ".description__text",
      ],
      title: [
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title",
        ".top-card-layout__title",
        "h1",
      ],
      company: [
        ".job-details-jobs-unified-top-card__company-name a",
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name",
        ".topcard__org-name-link",
        ".topcard__flavor",
      ],
    },
  ];

  // Text-boundary trimming.
  //
  // Class-name selectors are the clean path but LinkedIn renames them often —
  // as of this writing every previously-working selector below misses. Visible
  // headings change far less, so when the selectors fail we trim the walked
  // text between user-visible landmarks instead. Markup-independent, and it
  // degrades to "keep everything" rather than to "keep nothing".
  const SITE_TEXT_BOUNDS = [
    {
      match: /(^|\.)linkedin\.com$/i,
      start: [/^About the job$/i],
      // Prefix matches, not exact: LinkedIn pads these labels ("Set alert for
      // similar jobs"). The earliest one that appears wins.
      end: [
        /^set alert\b/i,
        /^see more jobs like this/i,
        /^similar jobs\b/i,
        /^people also viewed/i,
        /^more jobs you may be interested in/i,
        /^put your best foot forward/i,
        /^see how you compare/i,
        /^candidates who clicked apply/i,
      ],
    },
  ];

  function trimToBounds(text, bounds) {
    const lines = text.split("\n");
    const startIdx = lines.findIndex((l) => bounds.start.some((re) => re.test(l.trim())));
    if (startIdx === -1) return text;
    const after = lines.slice(startIdx + 1);
    let endIdx = after.length;
    for (const re of bounds.end) {
      const i = after.findIndex((l) => re.test(l.trim()));
      if (i !== -1 && i < endIdx) endIdx = i;
    }
    const body = after.slice(0, endIdx).join("\n").trim();
    // Fail safe: if trimming left too little, the landmarks lied — keep the original.
    return body.length > 500 ? body : text;
  }

  const firstMatch = (selectors) => {
    for (const sel of selectors || []) {
      const el = document.querySelector(sel);
      if (el && (el.innerText || "").trim().length > 0) return el;
    }
    return null;
  };

  // Convert an element's subtree to readable text, keeping list items on their
  // own lines. Requirements are nearly always bullets, and the downstream
  // analysis quotes them verbatim, so flattening them costs real fidelity.
  function elementToText(el) {
    const clone = el.cloneNode(true);
    clone
      .querySelectorAll("script, style, noscript, svg, button, form")
      .forEach((n) => n.remove());
    clone.querySelectorAll("li").forEach((li) => {
      li.textContent = "\n- " + (li.textContent || "").trim();
    });
    clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    clone
      .querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, section, tr")
      .forEach((n) => n.append("\n"));
    return (clone.innerText || clone.textContent || "")
      .split("\n")
      .map((l) => l.replace(/[ \t ]+/g, " ").trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // 1. JSON-LD structured data (most reliable when present)
  document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    try {
      const data = JSON.parse(el.textContent || "");
      const candidates = Array.isArray(data)
        ? data
        : data?.["@graph"]
          ? data["@graph"]
          : [data];
      for (const c of candidates) {
        const type = Array.isArray(c?.["@type"]) ? c["@type"] : [c?.["@type"]];
        if (type.some((t) => String(t).includes("JobPosting"))) {
          result.jsonLd = c;
          break;
        }
      }
    } catch {}
  });

  // 2. Page title and meta tags
  result.title = document.title || "";
  result.ogTitle = document.querySelector('meta[property="og:title"]')?.content || "";
  result.ogCompany = document.querySelector('meta[property="og:site_name"]')?.content || "";
  result.ogDesc = document.querySelector('meta[property="og:description"]')?.content || "";
  result.metaDesc = document.querySelector('meta[name="description"]')?.content || "";

  // 3. First visible h1 — usually the job title
  const h1 = document.querySelector("h1");
  if (h1) result.h1 = h1.textContent.trim();

  // 4. An explicit selection always wins — the manual escape hatch.
  const selection = window.getSelection()?.toString()?.trim();
  if (selection && selection.length > 50) {
    result.text = selection.slice(0, 50000);
    result.hasSelection = true;
    result.extractedFrom = "selection";
    return result;
  }

  // 5. Site-specific extraction, when this host has an extractor and the
  //    posting region is actually found.
  const site = SITE_EXTRACTORS.find((s) => s.match.test(location.hostname));
  if (site) {
    const descEl = firstMatch(site.description);
    if (descEl) {
      const body = elementToText(descEl);
      if (body.length > 200) {
        const titleEl = firstMatch(site.title);
        const companyEl = firstMatch(site.company);
        if (titleEl) result.h1 = titleEl.innerText.trim();
        if (companyEl) result.siteCompany = companyEl.innerText.trim().split("\n")[0];
        result.text = body.slice(0, 50000);
        result.extractedFrom = "site";
        return result;
      }
    }
  }

  // 6. Generic fallback: walk the main content area, minus obvious chrome.
  const mainEl =
    document.querySelector("main") ||
    document.querySelector('[role="main"]') ||
    document.querySelector("article") ||
    document.querySelector(".job-description") ||
    document.querySelector("#job-description") ||
    document.body;

  // Deliberately permissive. An earlier version rejected anything inside
  // nav/header/footer/aside or [aria-hidden="true"], which silently truncated
  // LinkedIn postings: long descriptions are collapsed behind "Show more" and
  // the overflow carries aria-hidden, so the legal, compensation and benefits
  // sections vanished. Capturing a little chrome is recoverable; losing half
  // the requirements is not. Boundary trimming below does the cleanup instead.
  const walker = document.createTreeWalker(mainEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "SVG")
        return NodeFilter.FILTER_REJECT;
      if (parent.offsetParent === null && tag !== "BODY" && tag !== "HTML")
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const chunks = [];
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent.trim();
    if (t) chunks.push(t);
  }

  let walked = [result.ogTitle, result.ogDesc, result.metaDesc, ...chunks]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  const bounds = SITE_TEXT_BOUNDS.find((b) => b.match.test(location.hostname));
  if (bounds) {
    const trimmed = trimToBounds(walked, bounds);
    if (trimmed !== walked) {
      walked = trimmed;
      result.extractedFrom = "bounds";
    }
  }

  result.text = walked.slice(0, 50000);

  return result;
})();
