/**
 * What the page shows for a sketch: the Mermaid the compiler generates, and
 * everything it had to say on the way there. A function from text to data, so
 * the pipeline can be tested without a DOM, and the wiring in `page.ts` is
 * left with nothing but elements.
 */

import { formatDiagnostic, parse, resolve, toMermaid } from '@eriknaslund/skiss';

export interface Preview {
  /** The Mermaid class diagram source. Never empty: a sketch with nothing in it still yields a header line. */
  mermaid: string;
  /** One formatted line per diagnostic, from both passes, in the order the compiler reports them. */
  diagnostics: string[];
}

export function preview(source: string): Preview {
  // `resolve` copies the parse diagnostics into its own list and appends what
  // it finds, so one list carries both passes. Neither ever throws: bad input
  // is diagnostics and a partial document.
  const resolved = resolve(parse(source));
  return {
    mermaid: toMermaid(resolved),
    diagnostics: resolved.diagnostics.map((d) => formatDiagnostic(d)),
  };
}
