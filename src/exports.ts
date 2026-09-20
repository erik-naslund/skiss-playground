/**
 * The two texts a sketch can be copied as. Both go through the package's own
 * `compile`, with the same options its CLI passes, so what the clipboard gets
 * is character for character what `skiss diagram` and `skiss compile` write
 * for the same sketch. No generation of any kind happens here (AGENTS.md §2).
 */

import { compile } from '@eriknaslund/skiss';

/**
 * The schema name the LinkML carries. The CLI names a schema after the file it
 * compiled and calls it `sketch` when the source came from standard input,
 * which is the case the playground is: there is no file, and the downloads are
 * `sketch.svg` and `sketch.png` for the same reason.
 */
export const SCHEMA_NAME = 'sketch';

/** The Mermaid class diagram, as `skiss diagram` writes it. */
export function mermaidText(source: string): string {
  return compile(source, { target: 'mermaid' }).output;
}

/** The LinkML schema as YAML, as `skiss compile` writes it. */
export function linkmlText(source: string): string {
  return compile(source, { target: 'linkml', schemaName: SCHEMA_NAME, format: 'yaml' }).output;
}
