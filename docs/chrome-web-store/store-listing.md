# Store listing tab

Copy each block into the matching field of the Chrome Web Store developer dashboard
(Item → **Store listing**).

## Item name

Taken from `name` in `chrome-extension/manifest.json`:

```
Job Search Clipper
```

## Summary (up to 132 characters)

The dashboard takes this from `description` in the manifest, which already says (114 characters):

```
Save job postings from any site to your jobs.fieldlines.org tracker, and fill application forms from your profile.
```

## Description

```
Job Search Clipper is the browser companion to the Job Search tracker at jobs.fieldlines.org. It saves job postings from any careers site into your tracker, and fills in application forms with the details you have already saved.

CLIP A POSTING
Open a job posting on any careers page, job board or applicant tracking system. Open the side panel and click "Clip this page". The extension reads the posting and fills in:
• Company and job title
• Location, and whether the role is remote, hybrid or on-site
• Salary range, when the posting lists one
• The full job description, with its bullet points kept

Check the fields, change anything you like, and click Save Job. The role appears in your tracker, ready for a fit check, a tailored resume and a cover letter.

If the page is unusual, select the part that holds the posting before you clip, and the extension uses only your selection. "Re-extract with AI" asks your tracker to read the fields with the AI provider you connected in your profile.

The panel also tells you when you have already saved the posting you are looking at, and lists your most recent clips.

FILL AN APPLICATION
On an application form, switch to the Fill tab and click "Fill application fields". The extension enters your name, email, phone, city, current title and company, and LinkedIn, GitHub and website links. It also answers common work-authorization and sponsorship questions. Filled fields are outlined in green so you can review them. Nothing is ever submitted for you.

Every saved value is also listed in the panel. Click one to copy it, for forms that need a little more help.

PRIVATE BY DESIGN
• The extension reads a page only when you click Clip or Fill. It never runs in the background on the sites you visit.
• What you clip goes only to your own jobs.fieldlines.org account. Nothing is sold or shared for advertising.
• No analytics or tracking scripts.

REQUIREMENTS
You need a Job Search account. Sign in with Google at https://jobs.fieldlines.org, then open the extension.
```

## Category

**Productivity → Workflow & Planning**. "Tools" is the fallback if that subcategory isn't offered.

## Language

English (United States)

## Graphic assets

All of these are in `docs/chrome-web-store/images/`.

| Field | File | Notes |
| --- | --- | --- |
| Store icon (128×128) | `store-icon-128.png` | The art is 96×96 inside 16 px of transparent padding, as Google's guidelines ask. Upload this one rather than `chrome-extension/icon128.png`, which has no padding. |
| Screenshot 1 (1280×800) | `01-clip.png` | Clipping a posting |
| Screenshot 2 (1280×800) | `02-fill.png` | Filling an application |
| Screenshot 3 (1280×800) | `03-tracker.png` | Where clips end up |
| Small promo tile (440×280) | `promo-small-440x280.png` | Upload it: listings without one are shown less prominently |
| Marquee promo tile (1400×560) | `promo-marquee-1400x560.png` | Optional. Only used if Google features the extension. |

The screenshots come from the real extension, using the sample data in `public/hero/`
(Meridian and Jordan Avery are made up). The images are 24-bit PNGs without transparency, as
the store requires.

## Additional fields

| Field | Value |
| --- | --- |
| Official URL | `https://jobs.fieldlines.org`. This only works if you verify the domain in Google Search Console with the same Google account. Otherwise leave it blank. |
| Homepage URL | `https://jobs.fieldlines.org` |
| Support URL | `mailto:stefan.klocek@gmail.com`, the address in the privacy policy, or a support page if you add one |
| Mature content | No |
