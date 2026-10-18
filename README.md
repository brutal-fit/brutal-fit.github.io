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

A static site: plain HTML, CSS and a little vanilla JavaScript, no framework and no build
step. Search engines get fully rendered content, the page loads fast, and nothing has to be
installed to edit it. The design follows the app: `#161616` background with a red glow,
`#FF5656` accent, Montserrat.

```
index.html          the single page (hero, how it works, clients, trainers, safety, pricing, FAQ, waitlist)
404.html            not-found page (noindex)
assets/css/         styles.css, all styling and the brand tokens
assets/js/          main.js, nav toggle, scrolled header, reveal on scroll, waitlist form
assets/img/         logo.svg, mark.svg, og-image.png (1200x630), apple-touch-icon.png
site.webmanifest, robots.txt, sitemap.xml, .nojekyll
```

## Working on it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

No tests. The check that runs before a commit is a Python script that validates the SEO head,
heading structure, JSON-LD, local links, robots and sitemap, and scans for non-ASCII
punctuation; see the handoff package under `../memory/.claude/handoffs/2026-10-18-website-draft/`.

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

Custom domain and `CNAME`, a waitlist backend, analytics, Terms and Privacy pages (the app's
legal copy is still a placeholder), self-hosted fonts, city and trainer landing pages,
GitHub Actions checks. Where the work stands is always in `../memory/current.md`.
