/**
 * A sketch as the page holds it — the title in the header and the text in the
 * editor — and whether it still is what was last loaded into it.
 *
 * Both questions are answered here rather than in `page.ts` so that the rule
 * for *dirty*, which decides whether a visitor is asked before their work is
 * replaced, is a plain test without a DOM.
 */

import { UNTITLED } from './title';

/** What the header and the editor hold between them. */
export interface Sketch {
  title: string;
  text: string;
}

/**
 * Whether the sketch on screen differs from the one that was last loaded from
 * an example, a file or a link. A title changed on its own counts: it is the
 * visitor's work as much as a line of the sketch is.
 */
export function isDirty(current: Sketch, loaded: Sketch): boolean {
  return current.title !== loaded.title || current.text !== loaded.text;
}

/**
 * What the visitor is asked before something replaces a dirty sketch. It names
 * the sketch, because a visitor with a tab open since yesterday needs to be
 * told what is about to go, and says where it goes from: the editor. A file
 * they saved is still on their disk.
 */
export function replaceQuestion(title: string): string {
  const named = title.trim() === '' ? UNTITLED : title.trim();
  return `Replace "${named}"? Your current sketch will be gone from the editor.`;
}
