# Changelog

All notable changes to the playground are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-10-20

The words of the sketch, copied as a page.

### Added

- **The words of the sketch as Markdown.** *Copy glossary* puts what `skiss glossary` writes on the clipboard — a section per class, its fields in a table, the `#` descriptions as the definitions — and *Copy terms* what `skiss glossary --classes` writes, the terms alone as a `| Term | Definition |` table. The title is the heading, as it was typed rather than as a slug: a glossary is read by a person. Both are disabled while the sketch has an error, as the other two copies are, and neither carries the `?` doubts, which is what the diagram beside them does too.

### Changed

- `@eriknaslund/skiss` 0.8.0: the glossary, and the two places a `#` description can now be more than one line. The *Star Wars catalogue* example opens with a `#` block describing the whole sketch and continues one field's description on an indented `#` line, so a visitor sees both without going looking.

## [0.2.0] - 2026-10-14

The diagram says no more than the sketch.

### Changed

- `@eriknaslund/skiss` 0.7.0: a `[]` relation draws without multiplicity labels. `players: Player[]` is an arrow like any other; the box still shows `Player[]`, so the plural is visible without the diagram claiming a one-to-many the sketch never stated.
- `@eriknaslund/skiss` 0.6.1: a name outside ASCII, such as `förnamn`, gets a message that says names are ASCII and points at the character that is not, and one bad class name is one diagnostic rather than one per field under it.
- The tagline links the language: a visitor who lands here first can read what a sketch is before writing one.

## [0.1.0] - 2026-09-21

The first release: a sketch you can write, watch, share, save and open, without installing anything.

### Added

- **A title for the sketch.** *Title* in the header names it: the browser tab
  follows it, a slug of it names all four downloads — `booking-flow.skiss`,
  `booking-flow.linkml.yaml`, `booking-flow.svg`, `booking-flow.png` — and the
  LinkML schema is compiled under the same slug. Opening a file takes the title
  from its name, and a share link carries it as `&t=<title>` beside the sketch.
  A sketch with no title is `sketch`, as before. The example select gets a blank
  first option, *Load an example…*, which it falls back to as soon as the sketch
  or its title is edited, and an example, an opened file or a dropped file that
  would replace an edited sketch asks first.

- **Files in and out of the page.** *Open* — and a file dropped on the editor —
  reads a `.skiss` or `.txt` file as a sketch, and a `.yaml`, `.yml` or `.json`
  LinkML schema through the package's `importLinkML`, with the line
  `formatDropped` writes above the editor saying what a sketch was too small to
  carry; a file of any other kind is refused by name. *Save .skiss* writes the
  sketch out as `sketch.skiss`, or under the name of the file that was opened,
  and *Save LinkML* the compiled schema as `sketch.linkml.yaml`, disabled while
  the sketch has an error. LinkML pasted into the editor is offered an import
  rather than given one: nothing is converted without the button. A file is read
  in the browser and is never uploaded.

- **A sketch you can send, copy and save.** *Share* compresses the sketch into
  the URL fragment as `#s=<base64url>` — `CompressionStream('deflate-raw')`, no
  library — copies the link and writes it into the address bar; opening one
  decodes it back into the editor, over anything else, and a fragment that does
  not decode is ignored with a notice. *Copy Mermaid* and *Copy LinkML* put
  what `skiss diagram` and `skiss compile` write on the clipboard, and are
  disabled while the sketch has an error. *Download SVG* saves the diagram as
  it is drawn; *Download PNG* saves it transparent, at twice that size.
  `Ctrl`/`Cmd` `S` copies the link and `Ctrl`/`Cmd` `Enter` draws the diagram
  now. The fragment is the only place a sketch goes: nothing is uploaded.

- **The draft, and the colours, between visits.** What is in the editor is kept
  in `localStorage` and restored on the next visit, unless a link carries a
  sketch, which wins; an example replaces it. *Highlight colours* in the header
  offers the three the Obsidian plugin 0.4.0 does — *Calm*, *Vivid* and *Off* —
  and is kept the same way. It is never in a share link: a link carries the
  sketch, not a preference.

- **An editor, and the diagram beside it.** CodeMirror 6 on the left, coloured
  by the tokenizer `@eriknaslund/skiss` 0.6.0 exports, with the compiler's
  diagnostics as bars in its gutter and as a list under it, errors first, and
  the sketch's `?` doubts under *Open questions*. Mermaid draws the diagram on
  the right, 300 ms after the last keystroke, and keeps the last good diagram
  while a line is half typed. The diagram pans, zooms and fits. Four examples
  in the header; the panes sit side by side above 900 px and stack below it.

- **The playground is deployed.** A static page at
  <https://erik-naslund.github.io/skiss-playground/>, built with Vite and
  published by GitHub Actions on every push to `main`. It holds a sample
  sketch, and shows the Mermaid text and the diagnostics that
  `@eriknaslund/skiss` 0.5.0 produced for it, updated as the sketch is
  edited.

[Unreleased]: https://github.com/erik-naslund/skiss-playground/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/erik-naslund/skiss-playground/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/erik-naslund/skiss-playground/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/erik-naslund/skiss-playground/releases/tag/v0.1.0
