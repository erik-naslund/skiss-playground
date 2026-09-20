import { describe, expect, it } from 'vitest';
import { preview } from '../src/preview';
import { SAMPLE } from '../src/sample';

describe('preview', () => {
  it('compiles the sample sketch to a Mermaid class diagram', () => {
    const { mermaid } = preview(SAMPLE);

    expect(mermaid.startsWith('classDiagram')).toBe(true);
    expect(mermaid).toContain('class Character');
    expect(mermaid).toContain('class Planet');
    expect(mermaid).toContain('class Jedi');
    // The reference and the inheritance the sample is there to show.
    expect(mermaid).toContain('Character --> Planet');
    expect(mermaid).toContain('Character <|-- Jedi');
  });

  it('has nothing to report about the sample', () => {
    expect(preview(SAMPLE).diagnostics).toEqual([]);
  });

  it('reports what both passes found, and still generates a diagram', () => {
    // A line `parse` cannot read, and a class `resolve` finds undeclared.
    const { mermaid, diagnostics } = preview('Character\n  homeworld: Planet\n  ???\n');

    expect(diagnostics.length).toBe(2);
    expect(diagnostics.some((d) => d.includes('E_UNPARSABLE'))).toBe(true);
    expect(diagnostics.some((d) => d.includes('W_UNDECLARED_CLASS'))).toBe(true);
    expect(mermaid).toContain('class Character');
  });

  it('does not throw on an empty sketch', () => {
    expect(preview('')).toEqual({ mermaid: 'classDiagram\n', diagnostics: [] });
  });
});
