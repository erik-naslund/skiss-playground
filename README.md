# Skiss playground

Try [Skiss](https://github.com/erik-naslund/skiss) in the browser: write a sketch, see the diagram, share a link. Nothing to install.

**<https://erik-naslund.github.io/skiss-playground/>**

> **Work in progress.** The editor and the diagram are there; share links, copy and download are not yet.

*Skiss* is a text notation for sketching data models, compiled to LinkML. This repository is the playground only; the language and the compiler live in [erik-naslund/skiss](https://github.com/erik-naslund/skiss).

## What the page does

- **An editor on the left.** CodeMirror 6, with the sketch coloured as you write it: class names, `@` systems, primitives and enum values carry a colour, and everything you wrote yourself — field names, the words after `#`, the types the compiler does not know — reads as text. Light and dark follow your own setting.
- **The diagram on the right.** Mermaid draws it in your browser, a moment after you stop typing. A half-typed line never blanks it: the last diagram that drew stays until the next one does. Drag to pan, wheel or pinch to zoom, **Fit** to go back.
- **The compiler's diagnostics where you are looking.** A red or yellow bar in the gutter beside every line that has one — the message is on the bar's tooltip — and the same diagnostics as a list under the editor, errors first. The `?` doubts of the sketch are listed under *Open questions*.
- **Four examples** in the header, to start from rather than an empty page.

Editor and diagram sit side by side on a wide screen and stack on a narrow one; the divider between them is the editor's own right edge, which you can drag.

### Keyboard

| | |
| --- | --- |
| `Tab` | Four spaces, which is how a field is indented under its class. |
| `Esc` then `Tab` | Leaves the editor, rather than indenting: `Esc` hands the next `Tab` back to the browser for a few seconds. |
| `Ctrl`/`Cmd` `Z`, `Shift` `Ctrl`/`Cmd` `Z` | Undo and redo. |

Everything else is CodeMirror's default keymap.

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
