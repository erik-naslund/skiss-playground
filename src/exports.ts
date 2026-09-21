/**
 * The two texts a sketch can be copied as. Both go through the package's own
 * `compile`, with the same options its CLI passes, so what the clipboard gets
 * is character for character what `skiss diagram` and `skiss compile` write
 * for the same sketch. No generation of any kind happens here (AGENTS.md §2).
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
