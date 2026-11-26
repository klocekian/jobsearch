# Landing-page screenshots

`pnpm shots:landing` retakes the app screenshots in `public/hero/` and updates
their sizes in `src/components/LandingPage.tsx`. See `run.sh` for options.

The account is fictional (`seed.mts`, `content.mts`): Jordan Avery and invented
companies. Never shoot a real account; the landing page is public.

- `shoot.mts`: one function per shot; add or adjust shots here when the UI changes.
- `ext.mts`: the Chrome extension shots (`--with-extension`), using a fictional
  careers page (`careers.mjs`) and the real side panel with `chrome.*` stubbed.
- `compose.py`: crops and resizes the captures into WebP.

`claude-connector.webp` is Claude's own UI and isn't produced here.
