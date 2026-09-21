import { parse, resolve, serialize, toLinkML, toMermaid } from '@eriknaslund/skiss';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EXAMPLE } from '../src/examples';
import { linkmlText, mermaidText, SCHEMA_NAME } from '../src/exports';
import { slugOf } from '../src/title';

describe('what the two copy buttons put on the clipboard', () => {
  it('copies the Mermaid `skiss diagram` writes for the same sketch', () => {
    const copied = mermaidText(DEFAULT_EXAMPLE.source);

    // The CLI's `diagram` is `toMermaid` over a resolved document and nothing
    // else, so this is the CLI's own output without running it.
    expect(copied).toBe(toMermaid(resolve(parse(DEFAULT_EXAMPLE.source))));
    expect(copied.startsWith('classDiagram')).toBe(true);
    expect(copied).toContain('class Character');
    expect(copied).toContain('Character <|-- Jedi');
    expect(copied.endsWith('\n')).toBe(true);
  });

  it('copies the LinkML `skiss compile` writes for the same sketch', () => {
    const copied = linkmlText(DEFAULT_EXAMPLE.source);

    // The CLI's `compile` is `toLinkML` serialised as YAML, named after the
    // file it read — `sketch` when it read standard input, as the page does.
    expect(copied).toBe(
      serialize(
        toLinkML(resolve(parse(DEFAULT_EXAMPLE.source)), { schemaName: SCHEMA_NAME }),
        'yaml',
      ),
    );
    expect(copied).toContain(`name: ${SCHEMA_NAME}`);
    expect(copied).toContain('imports:\n  - linkml:types');
    expect(copied).toContain('  Character:');
    expect(copied).toContain('        identifier: true');
  });

  it('compiles the schema under the slug of the title, and `sketch` where there is none', () => {
    const named = linkmlText(DEFAULT_EXAMPLE.source, slugOf('Booking flow'));

    // The slug is what the compile options carry; what LinkML makes of it —
    // the `name` it is written under and the `id` derived from that — is the
    // package's own (AGENTS.md §2).
    expect(named).toBe(
      serialize(
        toLinkML(resolve(parse(DEFAULT_EXAMPLE.source)), { schemaName: 'booking-flow' }),
        'yaml',
      ),
    );
    expect(named).toContain('booking_flow');
    expect(named).not.toContain('name: sketch');

    expect(linkmlText(DEFAULT_EXAMPLE.source, slugOf(''))).toContain(`name: ${SCHEMA_NAME}`);
    // What the page asks for when the sketch has no title at all.
    expect(linkmlText(DEFAULT_EXAMPLE.source)).toContain('name: sketch');
  });

  it('copies both without throwing for a sketch the compiler cannot read', () => {
    // The buttons are disabled for a sketch with an error in it, but nothing
    // in the page may throw on one (AGENTS.md §2).
    expect(() => mermaidText('???\n')).not.toThrow();
    expect(() => linkmlText('???\n')).not.toThrow();
  });
});
