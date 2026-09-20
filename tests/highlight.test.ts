import type { TokenKind } from '@eriknaslund/skiss';
import { describe, expect, it } from 'vitest';
import { CLASS_PREFIX, highlightSpans } from '../src/highlight';
// The stylesheet as text: the colours of the palette are a fact about it, and
// this is what lets a test read them without a browser.
import STYLESHEET from '../src/style.css?raw';

/**
 * A line that produces each kind. Typed as a total record, so a kind added to
 * the package fails the typecheck here until the page has a line, a class and
 * a colour for it.
 */
const KIND_LINES: Record<TokenKind, string> = {
  class: 'Jedi < Character',
  field: '    homeworld: Planet',
  system: 'Character @Catalog',
  primitive: '    age: int',
  type: '    tags: colour[]',
  enum: '    rank: padawan|knight|master',
  operator: '    homeworld: Planet',
  marker: '    id*',
  description: 'Character @Catalog     # someone in the films',
  doubt: '    species: human|droid   ? more?',
  comment: '# a whole line of comment',
};

/** The dark half of the stylesheet, which is where the dark palette is. */
const DARK = STYLESHEET.slice(STYLESHEET.indexOf('@media (prefers-color-scheme: dark)'));

function classesOf(line: string): string[] {
  return highlightSpans(line).map((span) => span.className);
}

describe('the decoration builder', () => {
  it('gives every kind tokenizeLine returns a class of its own', () => {
    for (const [kind, line] of Object.entries(KIND_LINES)) {
      expect(classesOf(line), `${kind} in ${JSON.stringify(line)}`).toContain(
        `${CLASS_PREFIX}${kind}`,
      );
    }
  });

  it('colours every kind in both themes, and lets the operators inherit', () => {
    for (const kind of Object.keys(KIND_LINES)) {
      if (kind === 'operator') {
        // `:`, `[]`, `|`, `<`, `~`, `=` and `@` take the colour of the text
        // around them by design, so the calm palette has no rule to find. The
        // one *Vivid* adds is scoped to the body class, which is why what is
        // looked for here is a rule at the start of a line.
        expect(STYLESHEET).not.toContain(`\n.${CLASS_PREFIX}operator {`);
        continue;
      }
      const rule = new RegExp(`\\.${CLASS_PREFIX}${kind}[^{]*\\{[^}]*color: var\\((--[a-z-]+)\\)`);
      const match = rule.exec(STYLESHEET);
      expect(match, `a colour for ${kind}`).not.toBeNull();

      const variable = match?.[1] ?? '';
      expect(STYLESHEET, `${variable} in light`).toContain(`${variable}: #`);
      expect(DARK, `${variable} in dark`).toContain(`${variable}: #`);
    }
  });

  it('colours both names of `Jedi < Character` and leaves the `<` an operator', () => {
    expect(highlightSpans('Jedi < Character')).toEqual([
      { line: 1, from: 0, to: 4, className: 'cm-skiss-class' },
      { line: 1, from: 5, to: 6, className: 'cm-skiss-operator' },
      { line: 1, from: 7, to: 16, className: 'cm-skiss-class' },
    ]);
  });

  it('counts lines from one and offsets from the start of the line', () => {
    const spans = highlightSpans('Character\n    id*\n');

    expect(spans).toEqual([
      { line: 1, from: 0, to: 9, className: 'cm-skiss-class' },
      { line: 2, from: 4, to: 6, className: 'cm-skiss-field' },
      { line: 2, from: 6, to: 7, className: 'cm-skiss-marker' },
    ]);
  });

  it('tokenizes only the lines it is asked for', () => {
    const spans = highlightSpans('Character\n    id*\nPlanet\n', (line) => line === 3);

    expect(spans).toEqual([{ line: 3, from: 0, to: 6, className: 'cm-skiss-class' }]);
  });

  it('has nothing to say about a blank sketch or a half-typed line', () => {
    expect(highlightSpans('')).toEqual([]);
    expect(highlightSpans('   ???   ')).toEqual([]);
  });
});
