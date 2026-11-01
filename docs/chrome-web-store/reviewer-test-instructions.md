# Test instructions tab

The extension does nothing useful while signed out, and the only way to sign in is Google. A
reviewer who can't sign in will reject the extension for "functionality could not be verified".
So set up a review account before you submit.

## Set up the review account (once)

1. Create a new Gmail account just for review, e.g. `jobsearch.review@gmail.com`.
   - Turn **off** 2-step verification, and don't add a recovery phone. Reviewers sign in from
     unfamiliar locations, and a verification prompt locks them out.
   - Sign in from a private window once, to accept Google's welcome screens.
2. If the Google OAuth consent screen for jobs.fieldlines.org is still in **Testing** mode, add
   this account as a test user. Better: publish the consent screen to **In production**, because
   in Testing mode real users can't sign in either.
3. Add the account to `SERVER_AI_EMAILS` in the production environment so "Re-extract with AI"
   works without a key of its own. (Alternative: connect an AI provider key on the review
   account's Profile → AI page. It will be billed to you.)
4. Sign in at https://jobs.fieldlines.org with the account, finish onboarding, and fill in
   **Profile → Application Fields** with made-up details (name, email, phone, city, LinkedIn).
   Without them, the Fill tab shows "Add a resume or fill in Application Fields".
5. Clip one or two postings, so the "Recent clips" list isn't empty.

## Text for the "Test instructions" field

Put the account's email and password in the dashboard's username and password fields. Paste
this into the additional-instructions box:

```
This extension saves job postings to the user's Job Search account at https://jobs.fieldlines.org, and fills job application forms from that account. A test account is provided (sign in with Google using the username and password above).

1. In a new tab, go to https://jobs.fieldlines.org and click "Start with Google". Use the test account. The extension uses this sign-in session, so sign in first.

CLIP
2. Open any public job posting. Examples:
   https://job-boards.greenhouse.io/  (open any company's posting)
   https://jobs.lever.co/  (open any company's posting)
3. Click the extension's toolbar icon. The side panel opens.
4. Click "Clip this page". Company, title, location, salary and the job description are filled in.
5. Optional: click "Re-extract with AI" to have the server fill any missing fields.
6. Click "Save Job". Click "View job" to see it saved in the tracker.
7. Reload the posting and reopen the panel. It shows "Already saved".

FILL
8. Open an application form, e.g. the "Apply" form of the same Greenhouse or Lever posting.
9. In the side panel, switch to the "Fill" tab and click "Fill application fields". Name, email, phone and link fields are filled from the test account's profile and outlined in green. Nothing is submitted.
10. Click any value in the list to copy it.

The extension reads or changes a page only when one of these buttons is clicked. The "Server" link at the bottom of the panel is a developer setting. Leave it on jobs.fieldlines.org.
```

> Swap the two example links for direct links to one posting each, checked the week you submit.
> Board-level URLs can change.
