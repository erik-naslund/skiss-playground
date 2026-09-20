# Skiss playground

Try [Skiss](https://github.com/erik-naslund/skiss) in the browser: write a sketch, see the diagram, share a link. Nothing to install.

**<https://erik-naslund.github.io/skiss-playground/>**

*Skiss* is a text notation for sketching data models, compiled to LinkML. This repository is the playground only; the language and the compiler live in [erik-naslund/skiss](https://github.com/erik-naslund/skiss).

## What the page does

- **An editor on the left.** CodeMirror 6, with the sketch coloured as you write it: class names, `@` systems, primitives and enum values carry a colour, and everything you wrote yourself — field names, the words after `#`, the types the compiler does not know — reads as text. Light and dark follow your own setting.
- **The diagram on the right.** Mermaid draws it in your browser, a moment after you stop typing. A half-typed line never blanks it: the last diagram that drew stays until the next one does. Drag to pan, wheel or pinch to zoom, **Fit** to go back.
- **The compiler's diagnostics where you are looking.** A red or yellow bar in the gutter beside every line that has one — the message is on the bar's tooltip — and the same diagnostics as a list under the editor, errors first. The `?` doubts of the sketch are listed under *Open questions*.
- **Four examples** in the header, to start from rather than an empty page.
- **A link you can send.** *Share* puts the whole sketch in the link, copies it and writes it into the address bar. Whoever opens it sees what you saw.
- **The sketch out of the page.** *Copy Mermaid* and *Copy LinkML* put the text the compiler generates on your clipboard; *Download SVG* and *Download PNG* save the diagram as a file. The PNG is transparent, at twice the size the diagram is drawn at, so it stands up where it is pasted.
- **Your colours.** *Highlight colours* in the header offers the three the Obsidian plugin does: **Calm**, which colours what says what a thing is; **Vivid**, which colours the names and the marks between them too; and **Off**, which leaves the sketch as plain text and the diagnostics in the gutter. The choice is remembered between visits.
- **Your draft, still there.** What you last wrote is kept in your browser and restored the next time you open the page — unless you opened a link, which wins.

Editor and diagram sit side by side on a wide screen and stack on a narrow one; the divider between them is the editor's own right edge, which you can drag.

### Keyboard

| | |
| --- | --- |
| `Tab` | Four spaces, which is how a field is indented under its class. |
| `Esc` then `Tab` | Leaves the editor, rather than indenting: `Esc` hands the next `Tab` back to the browser for a few seconds. |
| `Ctrl`/`Cmd` `Z`, `Shift` `Ctrl`/`Cmd` `Z` | Undo and redo. |
| `Ctrl`/`Cmd` `S` | Copies the share link, instead of asking the browser to save the page. |
| `Ctrl`/`Cmd` `Enter` | Draws the diagram now, rather than after the pause the page waits for. |

Everything else is CodeMirror's default keymap.

### What a share link holds

The link is the sketch. *Share* compresses the text with the browser's own `CompressionStream('deflate-raw')`, encodes the bytes as base64url and puts them in the URL's fragment — the part after the `#` — as `#s=<base64url>`. The Star Wars example comes to a link of about 260 characters. Opening a link decodes it back into the editor, and a fragment that does not decode is ignored with a short notice rather than an empty page. What the link does not carry is your choice of highlight colours: a link carries the sketch, not a preference.

A fragment is the one part of a URL a browser never sends to the server, so a sketch in a link reaches whoever you send the link to and nobody else. Nothing is uploaded, and there is no short-link service in the middle.

## What it is

A static page. There is no backend and no account. A sketch you type stays in your own browser — in the editor, in the draft `localStorage` keeps, and in the URL you choose to share — and goes nowhere else: no analytics, no cookies, nothing fetched from a third party ([ADR-0001](docs/adr/0001-static-site-on-github-pages.md)).

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

## Roadmap

What the language and the compiler are going to do next is planned in the `skiss` repository: [docs/ROADMAP.md](https://github.com/erik-naslund/skiss/blob/main/docs/ROADMAP.md). What the playground itself is going to do is the issues of this repository.

## Contributing

Work is issue-driven. [AGENTS.md](AGENTS.md) is the contract for anyone — human or agent — writing code here: what the boundaries are, what a PR description must say, and what has to be green before it is opened.

## License

MIT. See [LICENSE](LICENSE).
