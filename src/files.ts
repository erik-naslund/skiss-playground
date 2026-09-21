/**
 * What a file the visitor opens becomes, and what the page saves one as. A
 * sketch file is its own text; a LinkML schema goes through the package's
 * `importLinkML`, whose projection is a smaller language than LinkML and says
 * so. None of that needs a DOM, so all of it is here as functions from text to
 * data and `page.ts` is left with the input, the drop target and the buttons.
 *
 * No language logic (AGENTS.md §2): the projection, the report of what it had
 * to drop and the diagnostics are all the package's, and only the extensions
 * and the file names are this page's.
 */

import { formatDropped, importLinkML } from '@eriknaslund/skiss';
import { lineDiagnostics } from './preview';
import { clampTitle, slugOf } from './title';

/** A file whose text is a sketch as it stands. */
export const SKETCH_EXTENSIONS = ['.skiss', '.txt'] as const;

/** A file whose text is a LinkML schema, in either of the forms LinkML is written in. */
export const LINKML_EXTENSIONS = ['.yaml', '.yml', '.json'] as const;

/** The `accept` of the file input, and the list the refusal names. */
export const ACCEPT = [...SKETCH_EXTENSIONS, ...LINKML_EXTENSIONS].join(',');

/** What a file of any other kind is answered with. */
export const REFUSED = `That is not a file this page can open: it reads ${ACCEPT}`;

/** What the name of a file says its text is. */
export type FileKind = 'sketch' | 'linkml';

/**
 * What the page will read a file called `name` as, by its extension and
 * nothing else: the bytes are the visitor's and are not sniffed. Undefined for
 * every other name, which is the refusal.
 */
export function fileKind(name: string): FileKind | undefined {
  const extension = extensionOf(name);
  if (sketchExtension(extension)) {
    return 'sketch';
  }
  if (linkmlExtension(extension)) {
    return 'linkml';
  }
  return undefined;
}

/** The last extension of a file name, lowercased, `.` included. Empty where it has none. */
function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

function sketchExtension(extension: string): boolean {
  return SKETCH_EXTENSIONS.some((candidate) => candidate === extension);
}

function linkmlExtension(extension: string): boolean {
  return LINKML_EXTENSIONS.some((candidate) => candidate === extension);
}

/**
 * The title a file opened under: its name without the extension, as the
 * visitor wrote it — `Booking flow.skiss` is the sketch *Booking flow*, which
 * saves again as `booking-flow.skiss`. A `.linkml` left over from a schema the
 * page itself saved is taken off too, so a file opened and saved again is
 * `model.linkml.yaml` rather than `model.linkml.linkml.yaml`. A name that is
 * nothing but an extension gives no title, and the downloads fall back to
 * `sketch`.
 */
export function titleFromFilename(name: string): string {
  const extension = extensionOf(name);
  const withoutExtension = extension === '' ? name : name.slice(0, -extension.length);
  const stem = withoutExtension.toLowerCase().endsWith('.linkml')
    ? withoutExtension.slice(0, -'.linkml'.length)
    : withoutExtension;
  return clampTitle(stem.trim());
}

/**
 * What the four downloads are called: the slug of the sketch's title, which is
 * `sketch` where it has none. All four in one place, because they are one
 * decision — a visitor who saves a sketch and its diagram should find four
 * files with the same name beside each other.
 */
export function skissFilename(title: string): string {
  return `${slugOf(title)}.skiss`;
}

/** What *Save LinkML* calls the file: the extension `skiss compile` writes. */
export function linkmlFilename(title: string): string {
  return `${slugOf(title)}.linkml.yaml`;
}

/** What *Download SVG* calls the file. */
export function svgFilename(title: string): string {
  return `${slugOf(title)}.svg`;
}

/** What *Download PNG* calls the file. */
export function pngFilename(title: string): string {
  return `${slugOf(title)}.png`;
}

/** What a LinkML file becomes: a sketch where one could be read, and what to say about it. */
export interface Imported {
  /**
   * The projected sketch, canonical Skiss text. Undefined where no schema could
   * be read out of the file, in which case the editor keeps what it had: a
   * visitor who opened the wrong file has not lost the sketch they were writing.
   */
  source?: string;
  /**
   * The notice above the editor, line by line: what the projection had to drop,
   * then the diagnostics of the sketch it produced, errors first. Empty only
   * where a schema came through whole.
   */
  report: string[];
}

/**
 * A LinkML schema as a sketch. Every judgement here is the package's:
 * `importLinkML` projects the schema, `formatDropped` writes the one line that
 * says by how much a sketch is the smaller language, and the diagnostics are
 * the projected sketch's own, on its lines.
 */
export function importSketch(text: string): Imported {
  const result = importLinkML(text);
  const dropped = formatDropped(result.dropped);
  const report = [
    ...(dropped === '' ? [] : [dropped]),
    ...lineDiagnostics(result.diagnostics).map((diagnostic) => diagnostic.text),
  ];
  // A schema nothing could be read out of leaves the editor alone: a visitor
  // who opened the wrong file has not lost the sketch they were writing, and
  // `page.ts` says as much above it.
  if (result.output.trim() === '') {
    return { report };
  }
  return { source: result.output, report };
}

/**
 * Whether text in the editor is LinkML somebody pasted rather than a sketch
 * they are writing: an `id:` or `classes:` key at the start of a line, which is
 * the shape of a schema and no shape a sketch has — a sketch's own fields are
 * indented under a class, and a class line is a name, not a key.
 *
 * It decides what the page *offers*, never what it does: the projection runs
 * when the visitor presses the button (issue #6).
 */
export function looksLikeLinkML(text: string): boolean {
  const lines = text
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));
  const first = lines[0];
  if (first === undefined) {
    return false;
  }
  return /^(id|classes):/.test(first) || lines.some((line) => /^classes:\s*(#.*)?$/.test(line));
}
