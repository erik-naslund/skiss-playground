# ADR-0001 — A static site on GitHub Pages, built with Vite; the sketch lives in the URL and the browser

- **Status:** Accepted
- **Date:** 2026-09-20
- **Deciders:** Erik

## Context

Skiss has a CLI and an Obsidian plugin. Neither lets someone try the language without installing something first, which is most of the distance between reading the README and understanding what the notation is for.

What that person needs is a page: a box to type a sketch into, a diagram beside it, and a link they can send to the colleague they were just talking to. Everything the page has to do — parse, resolve, generate, draw — the `@eriknaslund/skiss` package and `mermaid` already do in a browser. The package's library entry point is browser-safe by its own contract (skiss ADR-0003): it imports no Node built-ins and touches no files.

So the only real question is what runs where, and what is kept.

## Decision

- **The playground is a static site.** HTML, CSS and JavaScript, built ahead of time. There is no backend, no API, no build or compile step that runs anywhere but the visitor's browser.
- **It is hosted on GitHub Pages**, deployed by GitHub Actions on every push to `main`, at <https://erik-naslund.github.io/skiss-playground/>. The build output is never committed; the workflow builds it and uploads it.
- **It is built with Vite**, with `base: '/skiss-playground/'` so the assets resolve under the project page's path.
- **A sketch lives in two places and nowhere else**: the visitor's own browser, and the URL they choose to share. Nothing is stored on a server, because there is no server; no analytics, no telemetry, no cookies; no scripts, styles or fonts fetched from a third party.
- **No language logic lives here.** Parsing, diagnostics and generation come from the package. The playground is the shell around them.

## Consequences

- There is nothing to operate: no deploy target to keep up, no secrets, no database, no dependency on anything staying up except GitHub Pages itself.
- There is nothing to leak. A sketch someone types is never transmitted, so a breach of this repository exposes no one's data. That is worth more here than any feature a backend would buy.
- The whole language runs in the visitor's browser, so the page is only as current as the package version it pins. Moving that version is a deliberate change in an issue of its own.
- A shared sketch is limited by what fits in a URL. Long sketches will need the encoding chosen when share links land, and there is no fallback to a server-side store.
- The site is served under a path, not a domain root. Anything that assumes `/` — asset URLs, routing, a service worker — has to be written against the configured base, and is only truly verified by `pnpm build && pnpm preview`, not by `pnpm dev`.

## Alternatives considered

- **A hosted service with saved sketches.** Rejected: it buys a feature nobody has asked for at the cost of something to run, something to pay for, something to patch, and someone else's half-finished data model sitting in a database. Nothing to run and nothing to leak is the point.
- **Netlify or Vercel.** Both are good at this and both would work. Rejected: the repository is already on GitHub, Pages deploys from a workflow next to the code with no third-party account in the chain, and the free tier of a hosting product is a relationship to maintain. If the playground ever needs preview deployments per pull request, this is the decision to revisit.
- **A single hand-written HTML file with no build step.** Rejected: the package and `mermaid` are npm modules that want bundling, and the editor (CodeMirror 6) will too. Vite is the smallest thing that does that and gives a dev server worth typing in.
