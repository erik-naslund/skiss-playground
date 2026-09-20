# AGENTS.md — Skiss playground

Instructions for AI agents (Claude Code and others) working in this
repository. Read this file in full before making any change. It is the
contract between the product owner and the agents that implement the work.

The product owner reviews **ADRs, PR descriptions and the deployed page**,
not implementation files line by line. Your job is to make that mode of
working safe: produce code that is mechanically verified, stays inside its
issue, and surfaces anything a human must decide.

---

## 1. Project overview

A static page that lets someone try [Skiss](https://github.com/erik-naslund/skiss)
without installing anything: write a sketch, see the diagram, share a link.
It is a thin layer over the `skiss` package (on npm as
`@eriknaslund/skiss`) and contains no language logic. It is published to
GitHub Pages at <https://erik-naslund.github.io/skiss-playground/>.

Stack (frozen unless an ADR changes it):

| Area | Choice |
| --- | --- |
| Language | **TypeScript**, strict |
| Package manager | **pnpm**, `packageManager` field pinned |
| Bundler and dev server | **Vite** |
| Lint and format | **Biome**, enforced in CI |
| Tests | **vitest** (jsdom where the DOM is needed) |
| Language | **`@eriknaslund/skiss`**, pinned to a published version |
| Diagram | **`mermaid`** from npm, rendered in the browser |
| Editor | **CodeMirror 6** |
| Hosting | **GitHub Pages**, deployed by GitHub Actions on every push to `main` |

No framework: plain DOM and modules.

---

## 2. Boundaries

- **No language logic here.** No parsing, no diagnostics, no generation.
  If you need something the `skiss` package does not expose, stop and
  surface it; the package gets the feature first. This repository never
  works around a gap in the language by reimplementing part of it.
- **The site is static.** No backend, no build step that runs anywhere but
  the visitor's browser and CI (ADR-0001). A change that needs a server is
  a new ADR, not a commit.
- **Nothing is sent anywhere.** No analytics, no telemetry, no cookies, no
  fonts or scripts from a third party. A sketch lives in the visitor's own
  browser and in the URL they choose to share, and nowhere else. A PR that
  adds a network call other than loading the site's own assets is not
  mergeable.
- **Never an empty page or an uncaught exception.** Whatever the input,
  the page shows something: diagnostics, a diagram, or both. `parse` and
  `resolve` do not throw; nothing built on them should either.
- **`dist/` is never committed.** It is built in CI and deployed from
  there.

---

## 3. Issue-driven workflow

Work items are GitHub issues. Every issue that reaches a worker carries a
goal, numbered acceptance criteria, an explicit *Out of scope*, and
working defaults the tech lead has already decided. A worker may veto a
working default by stopping and saying why, never by silently doing
something else.

- **Do not exceed the acceptance criteria.**
- **Respect *Out of scope*.**
- One issue = one branch = one PR.

---

## 4. Verification loop

`pnpm verify` runs the quality gate, cheapest first. **A task is complete
only when it exits green.** Never report success on a red gate or red CI.

1. `biome check` (`pnpm lint`)
2. `tsc --noEmit` (`pnpm typecheck`)
3. `vitest run` (`pnpm test`)
4. `vite build` (`pnpm build`)

What no script can verify: that the page works in a browser. Every PR that
changes what a visitor sees is checked by hand — `pnpm dev`, or
`pnpm build && pnpm preview` for anything that depends on the
`/skiss-playground/` base path — and the PR carries a screenshot
(Section 6).

Deployment is not part of the loop: `.github/workflows/deploy.yml` builds
and publishes every push to `main`. Nothing is uploaded by hand.

---

## 5. Architecture decisions (ADRs)

`docs/adr/`, **MADR** format (Context · Decision · Consequences ·
Alternatives considered), numbered sequentially and **append-only**. Each
carries a status: `Proposed`, `Accepted`, or `Superseded by ADR-NNNN`.

- **Check existing ADRs before proposing an architectural change.** The
  decision may already be made.
- To change an accepted decision, **draft a new ADR first** and surface it
  for review. Do not change the architecture and document it afterwards.
- Replacing a decision means writing a new ADR and flipping the old one's
  status, never editing the old one's content.

---

## 6. PR descriptions

The product owner does not routinely read implementation files, so the PR
description is the primary review surface. It is **mandatory** and follows
`.github/pull_request_template.md`:

- **Issue** it closes.
- **Acceptance criteria implemented**, by number.
- **Tests and evidence**: which test verifies which criterion, and for
  anything visible a screenshot of the page.
- **Non-obvious decisions** and **assumptions made**.
- **`skiss` version** the PR depends on, and whether it is published. The
  site never depends on an unpublished build.

Keep the description in the same register as the docs: plain, specific,
no filler.

---

## 7. Code style

- Strict TypeScript. No `any`, no non-null assertions.
- Plain DOM. No framework, no component abstraction, no state container.
  If a piece of logic can be a function from text to data, write it that
  way and let a small wiring file touch the DOM, so the logic can be
  tested without a browser.
- Small files named for what they contain. A file called `utils.ts` is a
  smell.
- Biome decides formatting. Do not argue with it in a PR.
- Comments explain why, not what.
- CSS is one stylesheet, plain, with light and dark through
  `prefers-color-scheme`. No preprocessor, no framework, no web fonts.

---

## 8. Testing conventions

- **Logic is tested without a DOM.** A function from sketch text to what
  the page shows is a plain vitest test.
- **The DOM is tested in jsdom**, and only where the wiring itself is what
  is being verified: that typing updates the output, that nothing throws
  on bad input.
- **Test names say what they verify**, in the words of the issue's
  acceptance criterion.
- A test never asserts on the exact prose of a diagnostic the `skiss`
  package produces. That is the package's to change.

---

## 9. When unsure

Do **not** invent, and do **not** stop to ask: nobody watches a worker
session, and a turn that ends on a question shows up as a question to the
product owner. Pick the reading closest to the issue text, record it on
the PR under **Assumptions made** as a vetoable working default (what you
chose, the alternative, why), and continue. Stop only when no default
could make the work useful, and say exactly that in the PR description.
A question about the language goes to the `skiss` repository, not here.

A worker never subscribes to its own PR, never schedules check-ins for
itself, and never wakes itself up later. The tech lead watches the PR.
When the PR is open and CI is green, the worker's job is finished.

---

## 10. Working alongside other agents

- **Claim before you code.** Comment on the issue with your branch name.
  Creating issues is the tech lead's job.
- **Branch from fresh `main`; reach `main` only via PR with green CI.**
  Never push to `main`, never force-push a shared branch. Every push to
  `main` deploys, so a red `main` is a broken site.
- **Check for overlap before branching.** List open PRs and branches.
- **`docs/` belongs to the product owner.** Never overwrite documentation
  you did not author; check `git log` for provenance first.
- **Fetch before every push; rebase your own branch on its remote.**

---

## 11. Session discipline and orchestration

Same model as the `skiss` and `obsidian-skiss` repositories:

1. **One issue, one session.** Recommend a fresh session for a new issue:
   context degradation is quiet.
2. **Every implementation PR gets a reviewer that is not its author.**
3. **Facts over recall.** Read the workflow file before describing how CI
   or the deploy behaves. Docs describe; workflows define.
4. **The tech lead plans; workers execute.** Workers get one
   self-contained issue, never ask the product owner directly, and never
   spawn workers. They report through their PR.
