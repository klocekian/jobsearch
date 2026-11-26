// Fictional employer careers pages served at https://careers.example.com/<company>/<role>.
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const SITES = {
  meridian: {
    company: "Meridian Analytics", logo: "◐ meridian", color: "#2f6f62", title: "Head of Design",
    side: [["Location", "Palo Alto Office (Hybrid)"], ["Employment Type", "Full time"], ["Location Type", "Hybrid"], ["Department", "Design"], ["Compensation", "$225K – $260K • Offers Equity • Offers Bonus"]],
    jsonLd: { "@type": "JobPosting", title: "Head of Design", hiringOrganization: { name: "Meridian Analytics" }, jobLocation: { address: { addressLocality: "Palo Alto", addressRegion: "California" } }, baseSalary: { currency: "USD", value: { minValue: 225000, maxValue: 260000 } } },
    sections: [
      ["About Meridian", "Meridian is the analytics platform for clinical operations. More than 400 hospitals use Meridian to see where beds, staff, and supplies are needed next, and to act before a shortage becomes a crisis."],
      ["About the Role", "This role owns and builds the design function at Meridian, reporting directly to the CEO and working closely with product and engineering leadership."],
      ["", "You'll inherit a small team, a working design system, and a product customers rely on every shift. The job is to take all three further: set the standard, grow the team, and decide what design owns and how it earns that ownership."],
      ["", "The role stays hands-on. At this stage, the person leading design still designs the hardest flows, prototypes the ideas that need to be seen to be understood, and sits in on customer calls."],
      ["", "Clinical operations data is dense: census, acuity, staffing ratios, supply burn. The difference between a good interface and a great one is knowing what the numbers mean to the charge nurse reading them at 3 a.m."],
      ["What You'll Do", "Lead product design across the Meridian platform. Hire and develop a team of 4–6 designers. Partner with clinical advisors to turn operational data into decisions people can make in seconds. Evolve our design system and accessibility standards."],
      ["What You Bring", "10+ years of product design, including 3+ years leading designers. Experience with data-heavy B2B products, ideally in healthcare or another regulated domain. A portfolio that shows both craft and measurable outcomes."],
    ],
  },
  fernway: {
    company: "Fernway", logo: "❦ fernway", color: "#3b5bdb", title: "Lead Product Designer, Payments",
    side: [["Location", "Remote (US)"], ["Employment Type", "Full time"], ["Department", "Design"], ["Compensation", "$185K – $225K • Offers Equity"]],
    sections: [
      ["About Fernway", "Fernway helps 30,000 small businesses get paid faster. Our invoicing, payments, and cash-flow tools move more than $8B a year for contractors, clinics, and studios that can't afford to wait 60 days for a check."],
      ["The Role", "We're hiring a Lead Product Designer to own the design of Fernway Payments: how businesses send invoices, collect payments, and reconcile what came in. You'll lead a team of three designers, partner with product management and engineering leadership, and own the quality of the experience end to end."],
      ["What You'll Do", "Lead product design for payments, invoicing, and reconciliation across web and mobile. Manage and mentor a team of three product designers; run critique and set craft standards. Partner with product management, engineering, risk, and compliance to shape the roadmap."],
      ["What You Bring", "8+ years of product design experience, including 2+ years leading designers. Shipped work in fintech, payments, or another regulated domain."],
    ],
  },
  tidewell: {
    company: "Tidewell Bank", logo: "≋ tidewell", color: "#0b5c7a", title: "Principal Product Designer, Consumer",
    side: [["Location", "New York, NY (Hybrid)"], ["Employment Type", "Full time"], ["Department", "Design"], ["Compensation", "$200K – $240K • Offers Equity"]],
    sections: [
      ["About Tidewell", "Tidewell is a digital bank for people who are tired of being surprised by their own money. Two million members use Tidewell to get paid early, avoid overdraft fees, and see what's coming before it hits."],
      ["About the role", "As Principal Product Designer on the Consumer team, you'll lead design for the moments that matter most to members: getting paid, paying bills, and recovering when something goes wrong. You'll set the design vision for the member app and mentor designers across the team."],
      ["What you'll do", "Lead design for core money-movement flows, including errors and recovery states. Use research, analytics, experimentation, and prototypes to guide decisions. Evolve the Tidewell design system and our accessibility standards."],
      ["What you bring", "10+ years designing consumer or fintech products. Experience leading complex, regulated product areas end to end. Strong interaction design and prototyping skills."],
    ],
  },
};

export function careersPage(url) {
  const key = url.pathname.split("/")[1];
  const s = SITES[key] ?? SITES.meridian;
  const app = url.searchParams.get("tab") === "application";
  const filled = url.searchParams.get("filled") === "1";
  const v = (x) => (filled ? `value="${x}"` : "");
  const overview = s.sections.map(([h, p]) => `${h ? `<h2>${esc(h)}</h2>` : ""}<p>${esc(p)}</p>`).join("");
  const form = `
    <label>Name<span>*</span></label><input ${v("Jordan Avery")} placeholder="Type here...">
    <label>Email<span>*</span></label><input ${v("jordan.avery@example.com")} placeholder="hello@example.com...">
    <label>Resume<span>*</span></label>
    <div class="drop">${filled ? `<div class="file">📎&nbsp; Jordan Avery - Resume 2026.pdf <b>🗑</b></div><div><button class="ghost">Replace</button> or drag and drop here</div>` : `<div><button class="ghost">Upload File</button> or drag and drop here</div>`}</div>
    <label>Phone Number<span>*</span></label><input ${v("(503) 555-0148")} placeholder="1-415-555-1234...">
    <label>Location<span>*</span></label><input ${v("Portland, Oregon")} placeholder="Start typing...">
    <label>LinkedIn Profile<span>*</span></label><input ${v("https://www.linkedin.com/in/jordanavery-example/")} placeholder="">
    <label>Are you legally authorized to work in the United States?<span>*</span></label>
    <div class="radio"><i class="${filled ? "on" : ""}"></i> Yes</div><div class="radio"><i></i> No</div>
    <button class="submit">Submit Application ➤</button>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.title)} | ${esc(s.company)}</title>
<meta property="og:title" content="${esc(s.title)}"><meta property="og:site_name" content="${esc(s.company)}">
${s.jsonLd ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", ...s.jsonLd, description: s.sections.map((x) => x[1]).join(" ") })}</script>` : ""}
<style>
*{box-sizing:border-box} body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d1d1f;background:#fff}
header{display:flex;align-items:center;justify-content:center;padding:26px 0 18px;position:relative}
header .back{position:absolute;left:12%;color:${s.color};font-size:22px}
.logo{font-size:40px;font-weight:600;letter-spacing:-0.5px;color:${s.color}}
.wrap{display:grid;grid-template-columns:260px 1fr;gap:40px;max-width:1060px;margin:0 auto;padding:0 32px 60px}
h1{grid-column:1/3;font-size:28px;margin:18px 0 6px}
.side div{border-bottom:1px solid #e6e6e6;padding:14px 0}.side small{display:block;font-size:12px;color:#555;margin-bottom:6px;font-weight:500}.side span{font-size:16px;line-height:1.5}
.tabs{display:flex;gap:0;margin-bottom:16px}.tabs a{flex:0 0 200px;padding:10px 0;color:#666;font-size:17px;border-bottom:2px solid transparent}.tabs a.on{color:${s.color};border-color:${s.color}}
h2{font-size:21px;margin:18px 0 6px} p{font-size:16px;line-height:1.6;margin:0 0 10px;color:#2b2b2b}
label{display:block;font-weight:600;font-size:15px;margin:22px 0 8px}label span{color:#d33}
input{width:100%;padding:12px 14px;border:1px solid #d4d4d4;border-radius:6px;font-size:15px}
.drop{border:1.5px dashed #d4d4d4;border-radius:8px;padding:20px 30px;text-align:center;color:#555}
.file{background:#f4f4f5;border-radius:8px;padding:16px;text-align:left;margin-bottom:14px;display:flex;justify-content:space-between}.file b{color:#d33;font-weight:400}
.ghost{border:1.5px solid ${s.color};color:${s.color};background:#fff;border-radius:6px;padding:10px 18px;font-size:15px;font-weight:600;margin-right:10px}
.radio{display:flex;align-items:center;gap:10px;margin:10px 0;font-size:16px}.radio i{width:22px;height:22px;border:1.5px solid #888;border-radius:50%}.radio i.on{border:6px solid ${s.color}}
.submit{width:100%;margin-top:30px;background:${s.color};color:#fff;border:0;border-radius:6px;padding:14px;font-size:16px;font-weight:600}
</style></head><body>
<header><span class="back">←</span><span class="logo">${esc(s.logo)}</span></header>
<div class="wrap">
<h1>${esc(s.title)}</h1>
<aside class="side">${s.side.map(([k, val]) => `<div><small>${esc(k)}</small><span>${esc(val)}</span></div>`).join("")}</aside>
<main><div class="tabs"><a class="${app ? "" : "on"}">Overview</a><a class="${app ? "on" : ""}">Application</a></div>
${app ? form : overview}</main></div></body></html>`;
}
