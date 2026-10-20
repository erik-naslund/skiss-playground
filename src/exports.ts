/**
 * The four texts a sketch can be copied as. All of them go through the
 * package's own `compile`, with the same options its CLI passes, so what the
 * clipboard gets is character for character what `skiss diagram`,
 * `skiss compile`, `skiss glossary` and `skiss glossary --classes` write for
 * the same sketch. No generation of any kind happens here (AGENTS.md §2).
 */

import { compile } from '@eriknaslund/skiss';
import { DEFAULT_SLUG } from './title';

/**
 * The schema name the LinkML carries where the sketch has no title. The CLI
 * names a schema after the file it compiled and calls it `sketch` when the
 * source came from standard input, which is the case an untitled sketch is:
 * there is no name to take one from, and the downloads are `sketch.svg` and
 * `sketch.png` for the same reason.
 */
export const SCHEMA_NAME = DEFAULT_SLUG;

/** The Mermaid class diagram, as `skiss diagram` writes it. */
export function mermaidText(source: string): string {
  return compile(source, { target: 'mermaid' }).output;
}

/**
 * The LinkML schema as YAML, as `skiss compile` writes it. `schemaName` is the
 * slug of the sketch's title, which is what the file it is saved as is called
 * too; `id` is whatever the package derives from that name.
 */
export function linkmlText(source: string, schemaName: string = SCHEMA_NAME): string {
  return compile(source, { target: 'linkml', schemaName, format: 'yaml' }).output;
}

/**
 * The heading a glossary carries where the sketch has no title. It is the
 * package's own default for a glossary with no name to take one from, which is
 * what the CLI writes when it reads standard input.
 */
export const GLOSSARY_NAME = 'Glossary';

/**
 * The `#` heading of the glossary: the title as the visitor typed it, not its
 * slug — a glossary is read by a person and names the domain, where a schema
 * and a file name are read by a machine (issue #21).
 */
function headingOf(title: string): string {
  return title.trim() === '' ? GLOSSARY_NAME : title;
}

/**
 * The Markdown glossary, as `skiss glossary` writes it: a section per class,
 * its fields in a table, the `#` descriptions as the definitions.
 *
 * The `?` doubts are left out, as they are in the Mermaid: `--notes` is what
 * adds them to either, and the page passes it to neither, so what the glossary
 * says about a sketch is what the diagram beside it shows.
 */
export function glossaryText(source: string, title = ''): string {
  return compile(source, { target: 'glossary', name: headingOf(title) }).output;
}

/**
 * The terms alone, as `skiss glossary --classes` writes them: one row per
 * class, no fields.
 */
export function termsText(source: string, title = ''): string {
  return compile(source, { target: 'glossary', name: headingOf(title), classes: true }).output;
}
