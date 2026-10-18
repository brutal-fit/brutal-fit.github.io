# BRUTAL website

The public website for BRUTAL, the fitness-tech marketplace for India where clients find, book
and train with verified trainers, at home or online. This repository is a GitHub Pages
organisation site: whatever is on `main` is served at https://brutal-fit.github.io.

It is one of four sibling repositories worked on from the parent `Brutal/` folder:

| Repo | Holds |
|---|---|
| [`app-fe-flutter`](../app-fe-flutter) | The Flutter app. `docs/product.md` there is the product reference. |
| [`app-be-supabase`](../app-be-supabase) | The Supabase backend. |
| `brutal-fit.github.io` (this one) | The marketing site. |
| [`memory`](../memory) | Shared running memory, the owner's instructions log, workspace Claude Code wiring. |

## What it is

A static site: plain HTML, CSS and vanilla JavaScript, no framework, no library and no build
step. Search engines get fully rendered content, the page loads fast, and nothing has to be
installed to edit it. The design follows the app: `#161616` background with a red glow,
`#FF5656` accent, Montserrat, with Instrument Serif italic for accent words.

The home page is chaptered, and every chapter has its own presentation and mechanic: a poster
hero over a cursor-reactive WebGL shader with a 3D particle ring and floating chips; a pinned
phone whose screens change as the three steps scroll by; a horizontal feature gallery driven
by scroll with inertia drag; a goals ticker that follows scroll velocity; a physics pit of
trainer benefits you can throw; a scrubbed map scene for safety; a slide-to-lock pricing card;
an index FAQ with spring-open answers; a full-bleed waitlist; a giant wordmark footer that
waves under the pointer; and a short curtain intro. All of it is hand-written in
`assets/js/motion.js` (shared loop, gates, hero, curtain) and `assets/js/chapters.js` (the
chapter mechanics). Everything switches off under `prefers-reduced-motion`, pointer-driven
parts only run on fine pointers with hover, native scrolling is never hijacked, the native
cursor is kept, and the page reads completely without JavaScript.

`/privacy/` and `/delete-account/` are the store-facing privacy policy and account-deletion
pages (Google Play and App Store accept their URLs). Five bracketed placeholders in them must
be filled before store submission: company legal name, registered address, privacy contact
email, grievance officer name, effective date.

```
index.html          the home page, ten chapters
404.html            not-found page (noindex)
privacy/            privacy policy (index.html)
delete-account/     account deletion page (index.html)
assets/css/         styles.css, tokens, type scale, every chapter's layout and motion states
assets/js/          main.js (nav, header, waitlist form), motion.js (loop, gates, hero, curtain), chapters.js (chapter mechanics)
assets/img/         logo.svg, mark.svg, og-image.png (1200x630), apple-touch-icon.png
site.webmanifest, robots.txt, sitemap.xml, .nojekyll
```

## Working on it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

No tests. The check that runs before a commit is a Python script that validates the SEO head,
heading structure, JSON-LD, local links, robots and sitemap, scans for non-ASCII punctuation
and checks the size budget (JS under 70 KB, HTML + CSS + JS under 180 KB); see the handoff
packages under `../memory/.claude/handoffs/2026-10-18-website-*/`. Headless Chrome notes for
screenshots and behaviour checks: `../memory/notes/website-headless-chrome.md` and
`website-motion-testing.md`.

Rules in short: no invented numbers, testimonials, logos, badges, prices or city names
(nothing is live yet); features the app does not have are described as roadmap; a trainer's
address is never shown and a session address is shared only after confirmation; no em-dashes,
no emoji, plain ASCII. The full set is in `.claude/CLAUDE.md`.

## Settings that will change at launch

| What | Where | Today |
|---|---|---|
| Canonical URL | `index.html` (canonical, OG, JSON-LD), `sitemap.xml`, `robots.txt` | `https://brutal-fit.github.io/`. For brutal.fit: add a `CNAME` file and replace the string. |
| Waitlist endpoint | `WAITLIST_ENDPOINT` at the top of `assets/js/main.js` | Empty: the form explains that sign-ups are not open yet. |
| Social profiles | `Organization.sameAs` in the JSON-LD | None yet. |

## Not done yet

Custom domain and `CNAME`, a waitlist backend, analytics, a Terms page, the privacy policy
placeholders, self-hosted fonts, city and trainer landing pages, GitHub Actions checks. Where the work stands is always in `../memory/current.md`.
