# Skiss playground

Try [Skiss](https://github.com/erik-naslund/skiss) in the browser: write a sketch, see the diagram, share a link. Nothing to install.

**<https://erik-naslund.github.io/skiss-playground/>**

> **Work in progress.** What is deployed today is the shell: it runs the `@eriknaslund/skiss` package in the browser and shows the Mermaid it generates as text, with the compiler's diagnostics under it. The editor and the rendered diagram come next, and the share links after that.

*Skiss* is a text notation for sketching data models, compiled to LinkML. This repository is the playground only; the language and the compiler live in [erik-naslund/skiss](https://github.com/erik-naslund/skiss).

## What it is

A static page. There is no backend and no account. A sketch you type stays in your own browser and in the URL you choose to share, and goes nowhere else: no analytics, no cookies, nothing fetched from a third party ([ADR-0001](docs/adr/0001-static-site-on-github-pages.md)).

## Running it locally

```
pnpm install
pnpm dev
```

That serves the page on `localhost` with hot reload. To see it as it is deployed, under its `/skiss-playground/` path:

```
pnpm build
pnpm preview
```

## Verifying a change

```
pnpm verify
```

Biome, then `tsc --noEmit`, then the tests, then the production build — the same gate CI runs on every pull request. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` run the steps on their own, and `pnpm format` writes the formatting Biome asks for.

Every push to `main` builds the site and deploys it to GitHub Pages.

## Contributing

Work is issue-driven. [AGENTS.md](AGENTS.md) is the contract for anyone — human or agent — writing code here: what the boundaries are, what a PR description must say, and what has to be green before it is opened.

## License

MIT. See [LICENSE](LICENSE).
