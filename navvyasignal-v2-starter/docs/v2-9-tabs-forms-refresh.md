# V2.9: Watchlist tabs, Join form (Netlify Forms) and RSS refresh

## Track A: Watchlist tabs

`/watchlist` shows two accessible tabs, **Active** (red underline) and **Resolved** (blue underline). Active is selected by default and only the selected tab's records are rendered. Counts come from the actual records. Keyboard: Left/Right (wrapping), Home and End move and activate; the selected tab is also shown by bold text, a filled surface, a thicker underline and `aria-selected`, never colour alone; tabs and panels have a visible focus ring. `/watchlist#resolved` deep-links, including hash changes on an open page. Every full summary is collapsed (`<details>`, never `open`) and expands individually. The 3/2/1 grid, dates, statuses and `/signals/<id>` links are unchanged; Abandoned or pending entries still appear below the tabs when present.

## Track B: Join Our Network on Netlify Forms

Implemented, **not yet operational**. The code is committed locally but nothing is deployed, so no form exists on Netlify yet.

- `public/__forms.html` is the static declaration Netlify's form detection reads (`data-netlify`, honeypot `bot-field`, form name `join-network`, all fields including `enquiry-type`). It ships in the static export at `/__forms.html`.
- `/network/join` posts `application/x-www-form-urlencoded` to `/__forms.html` with `fetch`. Success is shown **only** when that request returns 2xx; validation errors, a filled honeypot, redirects, HTTP errors, timeouts and network failures never show success, keep what was typed, and offer `hello@navvyasignal.com` as a fallback.
- Fields: name, company or publication, email, website (optional), type of enquiry (Editorial publication, Affiliated business, Content collaboration, Other partnership) and message.
- Spam protection in code: honeypot. Netlify also applies its own spam filtering. reCAPTCHA is not used (it needs keys and a Netlify setting).
- No notification, secret or token is in the repository. Notification email is configured in the Netlify UI.

### Netlify verification (read-only, 24 Sep 2026)

- The connector first returned a different account (`hello@zenhomesglobal.com`); on re-check, twice, it returned **navvyasignal@outlook.com (Navvya Signal)** with six projects, including `navvyasignal-v2-preview`. Re-verify the account immediately before any configuration change, because the first result differed.
- `navvyasignal-v2-preview`: Forms reported as **not enabled**, and the form list is **empty** (expected: nothing has been deployed with the declaration yet).

### Still required (each needs your approval; none has been done)

1. Approve pushing this commit so a Deploy Preview contains `/__forms.html`.
2. Enable Netlify Forms / form detection on `navvyasignal-v2-preview` (project setting), then redeploy so the form is detected.
3. Confirm `join-network` appears under that site's Forms, then add an email notification to `hello@navvyasignal.com` (approved recipient) for that form only.
4. Submit **one real test enquiry**, confirm it appears in that site's submissions, and confirm the notification arrives before calling the form operational.
5. Caveat to verify in step 4: a 2xx response to a `fetch` POST is treated as success. If Forms detection were off, a static host could in principle still answer 2xx, so the real test in step 4 is what proves the end to end path.

## Track C: RSS refresh workflow (staged, V2 only)

`.github/workflows/v2-static-refresh.yml` (changed locally, still inactive):

- Schedule unchanged: 00:10, 04:10, 08:10, 12:10, 16:10 and 20:10 UTC (every four hours, Dubai +4).
- New: manual runs default to a **dry run** (validates the secret and URL format only); scheduled runs always trigger. Strict hook format `https://api.netlify.com/build_hooks/<id>`; repository guard; 5-minute timeout. The secret is never printed.
- Tests simulate the script with `curl` stubbed, so nothing contacts Netlify.

Prerequisites before it can work (none done here):

1. **Default branch**: GitHub only runs schedules from the default branch, `main`. The workflow currently exists only on `notion-readonly`, so nothing runs until it is merged to `main` (a merge decision for you).
2. Create the GitHub environment `v2-preview` and the secret `V2_NETLIFY_BUILD_HOOK` (value from a build hook created for `navvyasignal-v2-preview` only, never Framer V1 or another site).
3. Create that build hook in Netlify (a Netlify setting change), choosing the branch you want built.
4. After merge: dispatch once with the default dry run, then once with dry run off, and check the deploy log for `[rss]` warnings.
