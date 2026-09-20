# Changelog

All notable changes to the playground are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
