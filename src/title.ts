/**
 * The title the visitor gives a sketch, and the two things that follow from
 * it: what the browser tab says, and the slug every download and the LinkML
 * schema are named after. Functions from a title to a string and nothing else,
 * so the rules are a plain test; the input the title is typed into is
 * `page.ts`.
 */

/** The longest title the header's input takes. */
export const MAX_TITLE_LENGTH = 120;

/** What a sketch with no title is called, in the input and in the confirmation. */
export const UNTITLED = 'Untitled sketch';

/**
 * What the downloads and the schema are called where there is no title. It is
 * what the CLI calls a schema it compiled from standard input, which is the
 * case an untitled sketch is: there is no name to take one from.
 */
export const DEFAULT_SLUG = 'sketch';

/** What the document's title ends with, and all of it where the sketch has no title. */
const PAGE_NAME = 'Skiss playground';

/** A title as long as the page keeps one. Pasting past the input's own `maxlength` ends here. */
export function clampTitle(text: string): string {
  return text.slice(0, MAX_TITLE_LENGTH);
}

/** What the browser tab says: the sketch first, because that is what a visitor is looking for. */
export function documentTitle(title: string): string {
  const named = title.trim();
  return named === '' ? PAGE_NAME : `${named} · ${PAGE_NAME}`;
}

/**
 * The title as a file name: lowercased, with everything that is not a letter,
 * a digit or a hyphen collapsed into single hyphens and trimmed off both ends.
 *
 * Accents are folded rather than replaced — `Bokföring` is `bokforing` and not
 * `bokf-ring` — because a sketch is written in the language its domain is
 * described in, and a Swedish title should still name a file a visitor
 * recognises. A title with nothing left after folding, a title of punctuation
 * and an empty title are all `sketch`.
 */
export function slugOf(title: string): string {
  const folded = title
    .normalize('NFD')
    // What NFD split off: `ö` is an `o` and a diaeresis, and the diaeresis is
    // not something a file name carries.
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
  const slug = folded
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return slug === '' ? DEFAULT_SLUG : slug;
}
