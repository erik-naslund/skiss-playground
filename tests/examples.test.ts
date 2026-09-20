import { describe, expect, it } from 'vitest';
import { DEFAULT_EXAMPLE, EXAMPLES } from '../src/examples';
import { preview } from '../src/preview';

describe('the examples', () => {
  it('are four, each with an id of its own, and open on the first', () => {
    expect(EXAMPLES.length).toBe(4);
    expect(new Set(EXAMPLES.map((example) => example.id)).size).toBe(4);
    expect(EXAMPLES[0]).toBe(DEFAULT_EXAMPLE);
  });

  for (const example of EXAMPLES) {
    describe(example.name, () => {
      it('compiles without a diagnostic of the error kind', () => {
        const errors = preview(example.source).diagnostics.filter(
          (diagnostic) => diagnostic.severity === 'error',
        );

        expect(errors.map((error) => error.text)).toEqual([]);
      });

      it('draws a class diagram with classes in it', () => {
        const { mermaid } = preview(example.source);

        expect(mermaid.startsWith('classDiagram')).toBe(true);
        expect(mermaid).toContain('class ');
      });
    });
  }

  it('shows an enum and a `~` relation in the library', () => {
    const library = EXAMPLES.find((example) => example.id === 'library');

    expect(library?.source).toContain('|');
    expect(library?.source).toContain('~ Member');
  });

  it('shows inheritance in the shop', () => {
    const shop = EXAMPLES.find((example) => example.id === 'shop');

    expect(shop?.source).toContain('DigitalProduct < Product');
  });

  it('asks questions, and describes things, in the last one', () => {
    const questions = EXAMPLES.find((example) => example.id === 'questions');
    const shown = preview(questions?.source ?? '');

    expect(shown.questions.length).toBeGreaterThan(2);
    expect(questions?.source).toContain('#');
  });
});
