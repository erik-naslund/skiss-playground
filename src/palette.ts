/**
 * The three palettes the header offers, the same choice the Obsidian plugin
 * 0.4.0 carries: *Calm* is what `style.css` says unscoped, *Vivid* is a class
 * on `<body>` the stylesheet scopes three rules under, and *Off* is the
 * highlighting extension left out of the editor altogether.
 *
 * Plain data and one class name: what the choice does to the editor is
 * `editor.ts`, what it does to the page is `page.ts`, and what a colour is is
 * `style.css`.
 */

/** A palette, as it is stored and as the `<select>` values are. */
export type HighlightColours = 'calm' | 'vivid' | 'off';

/** The palettes as the select lists them: the stored value, then its label. */
export const HIGHLIGHT_OPTIONS: Record<HighlightColours, string> = {
  calm: 'Calm',
  vivid: 'Vivid',
  off: 'Off',
};

/**
 * What a visitor who has never chosen gets, and what a stored value that is
 * not one of the three falls back to.
 */
export const DEFAULT_HIGHLIGHT: HighlightColours = 'calm';

/**
 * The class `page.ts` puts on `<body>` while *Vivid* is chosen, and that
 * `style.css` scopes that palette under. Calm needs no class: it is what the
 * stylesheet says unscoped, so a first visit is calm before anything is read.
 */
export const VIVID_BODY_CLASS = 'skiss-vivid';

/** A stored or chosen palette, taken only when it is one of the three. */
export function isHighlightColours(value: unknown): value is HighlightColours {
  return typeof value === 'string' && Object.hasOwn(HIGHLIGHT_OPTIONS, value);
}

/** Whether the editor colours the sketch at all: everything but *Off* does. */
export function highlights(colours: HighlightColours): boolean {
  return colours !== 'off';
}

/** Puts the palette on the body, which is the only thing the page's CSS reads. */
export function applyHighlight(body: HTMLElement, colours: HighlightColours): void {
  body.classList.toggle(VIVID_BODY_CLASS, colours === 'vivid');
}
