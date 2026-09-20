/**
 * What the page keeps in the visitor's own browser between visits: the draft
 * in the editor and the palette chosen in the header. `localStorage` and
 * nothing else — no cookie, nothing sent anywhere (ADR-0001).
 *
 * Every call is guarded. A browser can refuse storage outright (Safari's
 * private windows used to throw on the property itself), refuse a write when
 * the quota is full, or be told by its owner to block it, and none of that is
 * a reason for the page to stop working: it just forgets between visits.
 *
 * The palette is stored and the draft is stored; the share link is neither.
 * A link carries the sketch, not a preference.
 */

import { DEFAULT_HIGHLIGHT, type HighlightColours, isHighlightColours } from './palette';

const DRAFT_KEY = 'skiss-playground:draft';
const HIGHLIGHT_KEY = 'skiss-playground:highlight';

/** How long after the last keystroke the draft is written. */
export const DRAFT_DEBOUNCE_MS = 500;

/**
 * `localStorage` where the browser hands it over, and nothing where it does
 * not. Read through a function rather than at the top of the module: the
 * property itself is what throws in a browser that refuses it.
 */
export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** The draft of the last visit, or `undefined` where there is none to restore. */
export function readDraft(storage: Storage | undefined): string | undefined {
  return read(storage, DRAFT_KEY) ?? undefined;
}

export function saveDraft(storage: Storage | undefined, text: string): void {
  write(storage, DRAFT_KEY, text);
}

/**
 * The palette of the last visit. Anything that is not one of the three the
 * header offers — a value from an older version, a key another script wrote,
 * a string a visitor typed into the console — is *Calm*.
 */
export function readHighlight(storage: Storage | undefined): HighlightColours {
  const stored = read(storage, HIGHLIGHT_KEY);
  return isHighlightColours(stored) ? stored : DEFAULT_HIGHLIGHT;
}

export function saveHighlight(storage: Storage | undefined, colours: HighlightColours): void {
  write(storage, HIGHLIGHT_KEY, colours);
}

function read(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(storage: Storage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // A full quota or a blocked store is not worth a notice: the page works,
    // it only forgets.
  }
}
