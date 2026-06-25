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
  };

  // 1. Try JSON-LD structured data (most reliable)
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

  // 4. Grab all visible text from the main content area
  const mainEl =
    document.querySelector("main") ||
    document.querySelector('[role="main"]') ||
    document.querySelector("article") ||
    document.querySelector(".job-description") ||
    document.querySelector("#job-description") ||
    document.body;

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

  result.text = [result.ogTitle, result.ogDesc, result.metaDesc, ...chunks]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 50000);

  return result;
})();
