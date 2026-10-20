import { parse, resolve, serialize, toGlossary, toLinkML, toMermaid } from '@eriknaslund/skiss';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EXAMPLE } from '../src/examples';
import {
  GLOSSARY_NAME,
  glossaryText,
  linkmlText,
  mermaidText,
  SCHEMA_NAME,
  termsText,
} from '../src/exports';
import { slugOf } from '../src/title';

describe('what the four copy buttons put on the clipboard', () => {
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

  it('copies the glossary `skiss glossary` writes for the same sketch', () => {
    const copied = glossaryText(DEFAULT_EXAMPLE.source, 'Booking flow');

    // The CLI's `glossary` is `toGlossary` over a resolved document, headed by
    // the name it was given.
    expect(copied).toBe(
      toGlossary(resolve(parse(DEFAULT_EXAMPLE.source)), { name: 'Booking flow' }),
    );
    expect(copied.startsWith('# Booking flow\n')).toBe(true);
    expect(copied).toContain('## Character');
    expect(copied).toContain('| Field | Type | Description |');
    expect(copied.endsWith('\n')).toBe(true);
  });

  it('copies the terms `skiss glossary --classes` writes for the same sketch', () => {
    const copied = termsText(DEFAULT_EXAMPLE.source, 'Booking flow');

    expect(copied).toBe(
      toGlossary(resolve(parse(DEFAULT_EXAMPLE.source)), {
        name: 'Booking flow',
        classes: true,
      }),
    );
    expect(copied).toContain('| Term | Definition |');
    // The terms alone: a class is a row, and its fields are not.
    expect(copied).not.toContain('## Character');
    expect(copied).not.toContain('| Field | Type | Description |');
  });

  it('heads both with the title as it was typed, and `Glossary` where there is none', () => {
    const source = DEFAULT_EXAMPLE.source;

    // Not the slug: a heading is read by a person, where a schema name and a
    // file name are read by a machine.
    const named = '# Booking flow\n';
    expect(glossaryText(source, 'Booking flow').startsWith(named)).toBe(true);
    expect(termsText(source, 'Booking flow').startsWith(named)).toBe(true);

    // What the page asks for when the sketch has no title at all.
    const untitled = `# ${GLOSSARY_NAME}\n`;
    expect(glossaryText(source).startsWith(untitled)).toBe(true);
    expect(termsText(source).startsWith(untitled)).toBe(true);
    expect(glossaryText(source, '   ').startsWith(untitled)).toBe(true);
  });

  it('leaves the `?` doubts out of the glossary, as it leaves them out of the diagram', () => {
    // The example carries a doubt, and `--notes` is what would add it: the page
    // passes it to neither the glossary nor the Mermaid.
    expect(DEFAULT_EXAMPLE.source).toContain('? More?');

    expect(glossaryText(DEFAULT_EXAMPLE.source)).not.toContain('More?');
    expect(mermaidText(DEFAULT_EXAMPLE.source)).not.toContain('More?');
  });

  it('copies all four without throwing for a sketch the compiler cannot read', () => {
    // The buttons are disabled for a sketch with an error in it, but nothing
    // in the page may throw on one (AGENTS.md §2).
    expect(() => mermaidText('???\n')).not.toThrow();
    expect(() => linkmlText('???\n')).not.toThrow();
    expect(() => glossaryText('???\n')).not.toThrow();
    expect(() => termsText('???\n')).not.toThrow();
  });
});
