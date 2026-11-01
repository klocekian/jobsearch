# Submitting Job Search Clipper to the Chrome Web Store

Everything needed to submit `chrome-extension/` (Manifest V3, version 1.1.2), in the order
you'll need it.

| File | Use it for |
| --- | --- |
| `store-listing.md` | **Store listing** tab: name, summary, description, category, image list |
| `privacy-tab.md` | **Privacy practices** tab: single purpose, permission justifications, data-use boxes |
| `privacy-policy.md` | Text for the privacy policy page the listing must link to |
| `reviewer-test-instructions.md` | **Test instructions** tab, and how to set up the review account |
| `images/` | Store icon, three 1280×800 screenshots, small and marquee promo tiles |

## 1. Change the code before packaging (required)

- [ ] **Fix the manifest description.** It says "local job tracker", and it becomes the store
      summary. Use the line in `store-listing.md`.
- [ ] **Bump the version** if this build differs from what users already have, e.g. `1.2.0`.
      Every later upload must have a higher version than the last one.

## 2. Put the privacy policy online (required)

The listing needs a public privacy policy URL, because the extension handles personal and
website data.

- [ ] Fill in the placeholders in `privacy-policy.md` (contact email, your name or business
      name, date).
- [ ] Publish it at `https://jobs.fieldlines.org/privacy`. For example, add
      `src/app/privacy/page.tsx` that renders the text.
- [ ] **Add `"/privacy"` to `publicPaths` in `src/proxy.ts`.** Without it, signed-out visitors
      (including Google's reviewer) are redirected to the login page, and the policy counts as
      missing.

## 3. Prepare the review account (required)

Follow `reviewer-test-instructions.md`: a dedicated Gmail account without 2-step verification,
added to `SERVER_AI_EMAILS`, with application fields filled in. Also check that the Google OAuth
consent screen is **In production**, not Testing.

## 4. Package

Zip the extension's *contents*, so `manifest.json` sits at the root of the zip. Leave out
`popup.html`: the manifest never uses it, and reviewers ask about unused files.

```bash
cd chrome-extension
zip -r ../job-search-clipper-$(node -p "require('./manifest.json').version").zip \
  manifest.json background.js content.js popup.js sidepanel.html icon16.png icon48.png icon128.png
```

Before uploading, test the zip: unzip it into a folder, load that folder at
`chrome://extensions` with **Load unpacked**, and clip and fill once.

## 5. Fill in the dashboard

At https://chrome.google.com/webstore/devconsole:

1. **Account** (one time): verify the contact email, and complete the trader / non-trader
   declaration. That's the EU Digital Services Act question. If you collect no money from
   users, you're probably a non-trader.
2. **Items → New item** → upload the zip.
3. **Package**: nothing to fill in.
4. **Store listing**: from `store-listing.md`, plus the images in `images/`.
5. **Privacy practices**: from `privacy-tab.md`.
6. **Distribution**: Free. Visibility **Public**, all regions. Choose **Unlisted** instead if
   you want only people with the link to find it at first.
7. **Test instructions**: from `reviewer-test-instructions.md`.
8. **Submit for review**. Tick "publish automatically after approval", or untick it to publish
   by hand.

## 6. Expect a longer review

The broad host permissions (`https://*/*`, `http://*/*`) always trigger an in-depth review. That
usually takes a few days to a couple of weeks, instead of hours. The justification in
`privacy-tab.md` explains why the extension needs them.

**Optional, to speed this up:** move `https://*/*` and `http://*/*` into
`optional_host_permissions`, and call `chrome.permissions.request()` the first time someone
clips a page on a site the extension can't reach yet. The install then asks only for
jobs.fieldlines.org, which reviews faster and shows a milder install warning. It's a small code
change, but test it well: the request has to come straight from the button click.

## 7. After approval

- Point the "Download the Chrome extension" links (`src/components/LandingPage.tsx`, twice, and
  `src/components/ProfileView.tsx`) at the store page instead of `/chrome-extension.zip`. Store
  installs update themselves; zip installs don't.
- To ship an update later: bump the version, rebuild the zip, and upload it under **Package**.

## Worth fixing, but not blocking submission

- **Signed-out state.** When the user isn't signed in, the panel shows no hint about it, and Save
  fails with "Not signed in." A "Sign in at jobs.fieldlines.org" message with a link would stop
  first-time users, and reviewers, from thinking it's broken.
- **Toolbar icon.** `icon16/48/128.png` have an opaque white square around the red circle,
  which looks like a box in Chrome's dark theme. Make the corners transparent.
- **HTML from saved data.** The side panel builds its recent-clips list and fill list with
  `innerHTML`, using company and title strings that came from scraped pages. Extension CSP stops
  scripts from running, but markup can still be injected. Escape the values, or build the
  elements with `textContent`.
- **AI provider keys** are stored as plain text in the `user_ai_providers` table. The privacy
  policy is worded so that it doesn't claim they're encrypted. Encrypting them at rest would let
  it say so.
- **No self-serve account deletion.** The policy promises deletion on request by email. A
  "Delete account" button would make that easier to honor.
