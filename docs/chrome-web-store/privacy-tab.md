# Privacy practices tab

Copy each block into the matching field of Item → **Privacy practices**. Reviewers compare these
answers with the code and the privacy policy. Under-declaring is the most common reason for
rejection, so these answers err toward declaring more.

## Single purpose description

```
Job Search Clipper helps people apply to jobs with their Job Search tracker at jobs.fieldlines.org. It saves the job posting on the current page into the user's tracker, and fills application forms on the current page with contact details the user saved in that tracker. Both actions run only when the user clicks a button in the side panel.
```

## Permission justifications

**activeTab**
```
When the user clicks "Clip this page" or "Fill application fields" in the side panel, the extension needs to read or fill the tab they are looking at. activeTab limits that access to the current tab, at the moment the user acts.
```

**scripting**
```
Used only after a user click. chrome.scripting.executeScript runs one of two packaged scripts in the current tab: content.js, which reads the job posting's title, company, location, salary and description, or a function that fills the application form's text fields from the user's saved profile. No code is downloaded or run from anywhere else.
```

**sidePanel**
```
The extension's whole interface is a side panel. It stays open beside a job posting or application form, so the user can check and edit the captured fields while they look at the page.
```

**storage**
```
chrome.storage.local holds two settings on the user's own device: the address of the tracker server (production by default, or a local development server), and whether the "Recent clips" list is collapsed. No personal data is kept in storage.
```

**Host permissions** (`https://*/*`, `http://*/*`, `https://jobs.fieldlines.org/*`, `http://localhost:3000/*`)
```
Job postings and application forms are spread over thousands of domains: company careers pages and hiring systems such as Greenhouse, Lever, Ashby and Workday, each on its own domain. A fixed list can't cover them. The side panel stays open while the user moves between tabs, but activeTab only grants access to the tab where the toolbar icon was clicked. So without host access, clipping a posting opened afterwards would fail. The extension still only touches a page when the user clicks Clip or Fill. It has no content scripts that run on its own and does not watch browsing. jobs.fieldlines.org is the user's tracker account, where clipped jobs are saved and profile details are read. localhost:3000 lets developers test against a local copy of the tracker.
```

## Are you using remote code?

**No, I am not using remote code.**

```
All JavaScript is packaged in the extension. Requests to jobs.fieldlines.org exchange JSON data only. No scripts are loaded from the network, and eval is never used.
```

## Data usage — what the extension collects

Tick these boxes:

| Category | Tick? | Why |
| --- | --- | --- |
| Personally identifiable information | ✅ Yes | Fill reads the user's name, email, phone, city/state, title, employer and profile links from their account and enters them into forms. |
| Health information | No | |
| Financial and payment information | No | The salary of a job posting isn't the user's financial information. |
| Authentication information | No | The extension sends the existing jobs.fieldlines.org sign-in cookie with requests. It never reads, stores or sends passwords or tokens. |
| Personal communications | No | |
| Location | No | No GPS or IP location. The city and state the user types in their profile are covered under PII. |
| Web history | ✅ Yes | When the user saves a job, the posting's URL is stored. The panel also compares the current tab's URL with saved jobs, on the device, to show "Already saved". Ticking this is the safe choice. |
| User activity | No | No click, keystroke or scroll monitoring. |
| Website content | ✅ Yes | The text of the job posting the user clips. |

## Certifications

Tick all three. They are true of the current code and server:

- ✅ I do not sell or transfer user data to third parties, outside of the approved use cases
- ✅ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes

(Sending posting text to the user's chosen AI provider for "Re-extract with AI" counts as an
approved use. It is part of the feature, the user asks for it, and the privacy policy discloses it.)

## Privacy policy URL

```
https://jobs.fieldlines.org/privacy
```

It is served by `src/app/privacy/page.tsx` and is reachable without signing in.
