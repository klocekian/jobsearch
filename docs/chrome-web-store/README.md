# Submitting Job Search Clipper to the Chrome Web Store

Everything needed to submit `chrome-extension/` (Manifest V3, version 1.2.0), in the order
you'll need it.

| File | Use it for |
| --- | --- |
| `store-listing.md` | **Store listing** tab: name, summary, description, category, image list |
| `privacy-tab.md` | **Privacy practices** tab: single purpose, permission justifications, data-use boxes |
| `privacy-policy.md` | The privacy policy text, as published at `/privacy` |
| `reviewer-test-instructions.md` | **Test instructions** tab, and how to set up the review account |
| `images/` | Store icon, three 1280×800 screenshots, small and marquee promo tiles |

## 1. Code changes (done)

These are in the app and extension already:

- Manifest description fixed (it becomes the store summary), and version bumped to **1.2.0**.
- Privacy policy published at `/privacy` (`src/app/privacy/page.tsx`), reachable signed out
  (`/privacy` is in `publicPaths` in `src/proxy.ts`), and linked from the landing-page footer.
- The side panel tells signed-out users to sign in, instead of looking empty.
- Text from scraped pages and the profile is escaped before it goes into the panel's HTML.
- Toolbar icons have transparent corners.
- The unused `popup.html` is gone.

## 2. Deploy (required)

Deploy the app, then check that https://jobs.fieldlines.org/privacy opens in a private window.
The listing links to it, and the reviewer will open it.

## 3. Prepare the review account (required)

Follow `reviewer-test-instructions.md`: a dedicated Gmail account without 2-step verification,
added to `SERVER_AI_EMAILS`, with application fields filled in. Also check that the Google OAuth
consent screen is **In production**, not Testing.

## 4. Package

```bash
pnpm package:extension
```

This writes `dist/job-search-clipper-<version>.zip` for the store (manifest at the root of the
zip), and refreshes `public/chrome-extension.zip`, the direct download on the site, to match.

Before uploading, test the zip: unzip it into a folder, load that folder at
`chrome://extensions` with **Load unpacked**, and clip and fill once while signed in.

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
- To ship an update later: bump the version, run `pnpm package:extension`, and upload the new zip under **Package**.

## Still worth doing, but not blocking submission

- **AI provider keys** are stored as plain text in the `user_ai_providers` table. The privacy
  policy is worded so that it doesn't claim they're encrypted. Encrypting them at rest would let
  it say so.
- **No self-serve account deletion.** The policy promises deletion on request by email. A
  "Delete account" button would make that easier to honor.
