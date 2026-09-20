import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { linkmlText, mermaidText } from '../src/exports';
import {
  ACCEPT,
  fileKind,
  importSketch,
  linkmlFilename,
  looksLikeLinkML,
  skissFilename,
} from '../src/files';
import { preview } from '../src/preview';

/**
 * A LinkML schema with more in it than a sketch can carry: a `pattern`, a
 * `required`, a `mixins` and an enum, which is what the dropped report is for.
 */
const RICHER_THAN_A_SKETCH = `id: https://example.org/people
name: people
default_prefix: people
default_range: string
prefixes:
  people: https://example.org/people/
  linkml: https://w3id.org/linkml/
imports:
  - linkml:types
classes:
  Person:
    description: Someone the register knows
    mixins:
      - Auditable
    attributes:
      id:
        identifier: true
      name:
        range: string
        required: true
        pattern: "^[A-Z]"
      pets:
        range: Animal
        multivalued: true
  Animal:
    attributes:
      id:
        identifier: true
`;

describe('what a file is read as', () => {
  it('reads a .skiss and a .txt file as a sketch', () => {
    expect(fileKind('model.skiss')).toBe('sketch');
    expect(fileKind('notes.txt')).toBe('sketch');
  });

  it('reads a .yaml, a .yml and a .json file as a LinkML schema', () => {
    expect(fileKind('schema.yaml')).toBe('linkml');
    expect(fileKind('schema.yml')).toBe('linkml');
    expect(fileKind('schema.json')).toBe('linkml');
    // What the page itself saves, opened again.
    expect(fileKind('sketch.linkml.yaml')).toBe('linkml');
  });

  it('does not care what case the extension is written in', () => {
    expect(fileKind('MODEL.SKISS')).toBe('sketch');
    expect(fileKind('Schema.YAML')).toBe('linkml');
  });

  it('reads nothing else, whatever the rest of the name says', () => {
    expect(fileKind('diagram.png')).toBeUndefined();
    expect(fileKind('model.skiss.png')).toBeUndefined();
    expect(fileKind('archive.tar.gz')).toBeUndefined();
    expect(fileKind('Makefile')).toBeUndefined();
    expect(fileKind('')).toBeUndefined();
  });

  it('offers the same extensions in the file input as it reads', () => {
    expect(ACCEPT).toBe('.skiss,.txt,.yaml,.yml,.json');
  });
});

describe('the names the two saves download under', () => {
  it('names them after the sketch when nothing was opened', () => {
    expect(skissFilename()).toBe('sketch.skiss');
    expect(linkmlFilename()).toBe('sketch.linkml.yaml');
  });

  it('names them after the file that was opened', () => {
    expect(skissFilename('booking.skiss')).toBe('booking.skiss');
    expect(linkmlFilename('booking.skiss')).toBe('booking.linkml.yaml');
    expect(skissFilename('people.yaml')).toBe('people.skiss');
    expect(skissFilename('notes.txt')).toBe('notes.skiss');
  });

  it('does not stack a second .linkml on a schema the page itself saved', () => {
    expect(linkmlFilename('people.linkml.yaml')).toBe('people.linkml.yaml');
    expect(skissFilename('people.linkml.yaml')).toBe('people.skiss');
  });

  it('falls back to the sketch where the name is nothing but an extension', () => {
    expect(skissFilename('.skiss')).toBe('sketch.skiss');
    expect(linkmlFilename('   ')).toBe('sketch.linkml.yaml');
  });
});

describe('a LinkML schema as a sketch', () => {
  it('opens the LinkML the playground saved and comes back to the same sketch', () => {
    for (const example of EXAMPLES) {
      const schema = linkmlText(example.source);

      const imported = importSketch(schema);

      expect(imported.source, example.id).toBeDefined();
      const source = imported.source ?? '';
      // The same sketch: the canonical text is spaced differently from the
      // example's own, and says the same thing — which is what compiling both
      // to LinkML, and to a diagram, shows.
      expect(linkmlText(source), example.id).toBe(schema);
      expect(mermaidText(source), example.id).toBe(mermaidText(example.source));
      // A schema the page wrote from a sketch loses nothing on the way back.
      expect(imported.report, example.id).toEqual([]);
    }
  });

  it('reports what a schema carried that a sketch cannot, and still shows the sketch', () => {
    const imported = importSketch(RICHER_THAN_A_SKETCH);

    expect(imported.source).toContain('Person');
    // One line, the package's own, naming what was left behind.
    expect(imported.report.length).toBe(1);
    expect(imported.report[0]).toContain('pattern');
    // And the sketch it did project renders, without an error to put right.
    const shown = preview(imported.source ?? '');
    expect(shown.mermaid).toContain('class Person');
    expect(shown.mermaid).toContain('class Animal');
    expect(shown.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
  });

  it('keeps the editor as it was for a file no schema can be read out of, and says why', () => {
    const notYaml = importSketch('{ this is not a schema\n');
    expect(notYaml.source).toBeUndefined();
    expect(notYaml.report.length).toBeGreaterThan(0);

    const notASchema = importSketch('- one\n- two\n');
    expect(notASchema.source).toBeUndefined();
    expect(notASchema.report.length).toBeGreaterThan(0);
  });

  it('projects a schema written as JSON as readily as one written as YAML', () => {
    const asJson = JSON.stringify({
      id: 'https://example.org/people',
      name: 'people',
      default_prefix: 'people',
      default_range: 'string',
      prefixes: {},
      imports: [],
      classes: { Animal: { attributes: { id: { identifier: true } } } },
    });

    expect(importSketch(asJson).source).toContain('Animal');
  });
});

describe('the text that is offered an import', () => {
  it('recognises a schema by its first key', () => {
    expect(looksLikeLinkML('id: https://example.org/people\nname: people\n')).toBe(true);
    expect(looksLikeLinkML('classes:\n  Person:\n')).toBe(true);
    // A comment above it, as a file downloaded from somewhere often carries.
    expect(looksLikeLinkML('# people\n\nid: https://example.org/people\n')).toBe(true);
  });

  it('recognises a schema by a classes key further down', () => {
    expect(looksLikeLinkML(RICHER_THAN_A_SKETCH)).toBe(true);
  });

  it('offers nothing for a sketch, whatever is in it', () => {
    for (const example of EXAMPLES) {
      expect(looksLikeLinkML(example.source), example.id).toBe(false);
    }
    expect(looksLikeLinkML('')).toBe(false);
    expect(looksLikeLinkML('Character @Catalog\n    id*\n    name\n')).toBe(false);
    // A field called `id`, indented under its class, is not a schema's `id:`.
    expect(looksLikeLinkML('Character\n    id: int\n')).toBe(false);
    // Nor is a class that happens to be called `classes`.
    expect(looksLikeLinkML('Classes @Timetable\n    id*\n')).toBe(false);
  });
});
