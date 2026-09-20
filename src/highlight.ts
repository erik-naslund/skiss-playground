/**
 * Which runs of which lines carry which colour. Plain data about the lines of
 * a sketch, so the CodeMirror extension in `editor.ts` is left with the
 * mapping onto a document and nothing else, and the colouring can be tested
 * without an editor.
 *
 * The language logic is the package's: `tokenizeLine` says what a run is
 * (AGENTS.md §2). This file only turns its kinds into class names and counts
 * lines.
 */

import { tokenizeLine } from '@eriknaslund/skiss';

/** The prefix every token class carries, as `style.css` styles them. */
export const CLASS_PREFIX = 'cm-skiss-';

/** One coloured run of one line. */
export interface HighlightSpan {
  /** The sketch's own line, 1-based. */
  line: number;
  /** Where the run starts on that line, counted from the start of the line. */
  from: number;
  to: number;
  className: string;
}

/**
 * Every span of `text`, for the lines `wanted` accepts — the editor passes
 * what is on screen, so a sketch that is mostly scrolled away is mostly not
 * tokenized. Ascending by line and then by offset, so a range set can be built
 * from them as they come.
 */
export function highlightSpans(
  text: string,
  wanted: (line: number) => boolean = () => true,
): HighlightSpan[] {
  const spans: HighlightSpan[] = [];
  const lines = text.split('\n');
  for (const [index, line] of lines.entries()) {
    const number = index + 1;
    if (!wanted(number)) {
      continue;
    }
    for (const token of tokenizeLine(line)) {
      spans.push({
        line: number,
        from: token.from,
        to: token.to,
        className: `${CLASS_PREFIX}${token.kind}`,
      });
    }
  }
  return spans;
}
