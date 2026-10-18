# BRUTAL website (brutal-fit.github.io)

The public marketing site for BRUTAL, the fitness-tech marketplace for India (clients find,
book and train with verified trainers, at home or online). GitHub Pages organisation site:
**a push to `main` publishes to https://brutal-fit.github.io.**

- Product reference: `../app-fe-flutter/docs/product.md`. Open product questions (MVP scope,
  revenue model, payment provider, verification depth, AI scope, launch city) are not answered
  here; the copy says "India" and "roadmap", never a city or a live feature that is not live.
- Current state: `../memory/current.md`, always. The workspace rules, agents, `/build` and the
  handoff packages live in `../memory/.claude/` (linked from the parent `Brutal/.claude`).

## Repo rules

- This repo works on `main` only (owner, 2026-10-18); no `dev` branch. Checked-out branch
  only; no worktrees, no new branches unless the owner asks. Commits at
  logical checkpoints, proposed to the owner and made after a yes; no `Co-Authored-By` or other
  trailers; never push unless asked, and say that a push to `main` publishes the site.
- Owner instructions given during a session are recorded in `../memory/instructions.md`.
- Changes to `index.html`, `404.html` or anything under `assets/` go to the `developer` agent
  with a handoff package. The Architect edits this file, `README.md`, `robots.txt`,
  `sitemap.xml` and `site.webmanifest` directly.

## Stack

Static HTML, CSS and vanilla JS. No framework, no build step, no dependencies, no bundler. The
only request that leaves the origin is the Google Fonts stylesheet for Montserrat. Adding a
tool, a script tag or a dependency is a decision for the owner, proposed in chat first. The
motion layer in `assets/js/motion.js` (WebGL shader, canvas particle ring, tilt, page spotlight,
magnetic buttons, card spotlight, reveals) is hand-written for that reason; keep it under
70 KB across `motion.js` and `chapters.js` and gated: off under `prefers-reduced-motion:
reduce`, cursor-driven effects only under `(pointer: fine) and (hover: hover)`, content fully
visible without JS, native scroll never hijacked. Every reveal and every pinned scene must
reach a guaranteed resting state (the `is-done` and settle rules) so a stalled transition can
never leave text hidden or clipped. State classes on `<html>` are always `is-*` so they can
never match a component class (a bare `intro` once capped the whole document at a paragraph
width).
The motion layer has no custom cursor by the owner's decision (2026-10-18): the native cursor
stays everywhere; do not add one.

## Non-negotiable rules

- **Honest copy.** No invented counts, ratings, testimonials, partner logos, press quotes, store
  badges, prices, discounts or launch cities. If a layout wants a number we do not have, cut
  the element. Features the app does not ship yet (AI coach, real payments, iOS) are worded as
  roadmap.
- **Safety and privacy claims match the backend.** Trainer profiles show a service area, never
  an address; a session address is visible to the two participants only after confirmation;
  documents are reviewed before a trainer is listed; BRUTAL sets the price and it is locked at
  booking. Do not promise anything `../app-be-supabase` does not enforce.
- **No trackers, no cookies, no third-party scripts** without the owner's approval. The
  waitlist form sends nothing until `WAITLIST_ENDPOINT` in `assets/js/main.js` is set, and says
  so to the visitor.
- **SEO basics stay intact on every change:** exactly one `h1`, one `h2` per section, `title`
  under 65 characters, `meta description` 150 to 160 characters, canonical, Open Graph and
  Twitter tags with absolute URLs, valid JSON-LD (`Organization`, `WebSite`, `FAQPage` whose
  text matches the rendered FAQ), `robots.txt` naming `sitemap.xml`.
- **Accessible by default:** semantic landmarks, visible focus, 44px tap targets, 4.5:1
  contrast for text, all content visible without JS, no motion under
  `prefers-reduced-motion: reduce`, no horizontal scroll at 360px.
- **Brand tokens only.** Colours, radii and the font come from the custom properties at the
  top of `assets/css/styles.css` (the app's `BrutalColors`); no new hex values in rules.
- **House style:** no em-dashes, no en-dashes, no emoji, plain ASCII in markup, CSS, JS and
  copy. British spelling as in the app ("programme"). Comments say why, one line, never who
  asked.

## Commands

| Purpose | Command |
|---|---|
| Serve locally | `python3 -m http.server 8080` (from the repo root) |
| Structure check | the Python script described in the current handoff package's Verification section, run from outside the repo |
| Screenshot | `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot=<out.png> --window-size=1440,3200 file://$PWD/index.html` |
| OG image | same command at `--window-size=1200,630` against a throwaway HTML file kept outside the repo |

## Layout

```
index.html, 404.html, privacy/index.html, delete-account/index.html
assets/css/styles.css      tokens, type scale, chapter layouts, motion states (breakpoints 600 / 880 / 1200)
assets/js/main.js          nav toggle, scrolled header, waitlist form
assets/js/motion.js        shared loop, pointer tracker, gates, hero, curtain, reveals
assets/js/chapters.js      one mechanic per chapter (journey, gallery, ticker, pills, safety, slider, FAQ, footer)
assets/img/                logo.svg, mark.svg, og-image.png, apple-touch-icon.png
site.webmanifest, robots.txt, sitemap.xml, .nojekyll
.claude/                   this file and settings.json
```

## Memory and docs

`../memory/` is the shared running memory (read `current.md` first, write it last; one `log.md`
entry per session). This repo has no `docs/` yet; its backlog is the "Not done yet" list in
`README.md` until it needs more.
