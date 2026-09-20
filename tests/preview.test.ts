import { describe, expect, it } from 'vitest';
import { DEFAULT_EXAMPLE } from '../src/examples';
import { lineDiagnostics, preview } from '../src/preview';

describe('preview', () => {
  it('compiles a sketch to a Mermaid class diagram', () => {
    const { mermaid } = preview(DEFAULT_EXAMPLE.source);

    expect(mermaid.startsWith('classDiagram')).toBe(true);
    expect(mermaid).toContain('class Character');
    expect(mermaid).toContain('class Planet');
    expect(mermaid).toContain('class Jedi');
    // The reference and the inheritance the example is there to show.
    expect(mermaid).toContain('Character --> Planet');
    expect(mermaid).toContain('Character <|-- Jedi');
  });

  it('reports what both passes found, and still generates a diagram', () => {
    // A line `parse` cannot read, and a class `resolve` finds undeclared.
    const { mermaid, diagnostics } = preview('Character\n  homeworld: Planet\n  ???\n');

    expect(diagnostics.length).toBe(2);
    expect(diagnostics.map((d) => d.severity)).toEqual(['error', 'warning']);
    expect(diagnostics.map((d) => d.line)).toEqual([3, 2]);
    expect(mermaid).toContain('class Character');
  });

  it('names the line each diagnostic is on, as the list shows it', () => {
    const { diagnostics } = preview('Character\n    homeworld: Planet\n');

    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0]?.line).toBe(2);
    expect(diagnostics[0]?.text.startsWith('line 2: ')).toBe(true);
    expect(diagnostics[0]?.text).toBe(`line 2: ${diagnostics[0]?.message}`);
  });

  it('puts the errors before the warnings and keeps the compiler’s order inside each', () => {
    const shown = lineDiagnostics([
      { severity: 'warning', code: 'W_UNDECLARED_CLASS', message: 'first warning', line: 2 },
      { severity: 'error', code: 'E_UNPARSABLE', message: 'first error', line: 7 },
      { severity: 'warning', code: 'W_UNKNOWN_TYPE', message: 'second warning', line: 4 },
      { severity: 'error', code: 'E_BAD_NAME', message: 'second error', line: 9 },
    ]);

    expect(shown.map((diagnostic) => diagnostic.message)).toEqual([
      'first error',
      'second error',
      'first warning',
      'second warning',
    ]);
    expect(shown.map((diagnostic) => diagnostic.line)).toEqual([7, 9, 2, 4]);
  });

  it('lists the doubts of the sketch under what carries them', () => {
    const { questions } = preview(
      'Character   ? is this a person?\n    name\n    species   ? how many?\n',
    );

    expect(questions).toEqual(['Character: is this a person?', 'Character.species: how many?']);
  });

  it('has no questions where the sketch asks none', () => {
    expect(preview('Character\n    name\n').questions).toEqual([]);
  });

  it('does not throw on an empty sketch', () => {
    expect(preview('')).toEqual({ mermaid: 'classDiagram\n', diagnostics: [], questions: [] });
  });
});
