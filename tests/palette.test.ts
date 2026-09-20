// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  applyHighlight,
  DEFAULT_HIGHLIGHT,
  HIGHLIGHT_OPTIONS,
  highlights,
  isHighlightColours,
  VIVID_BODY_CLASS,
} from '../src/palette';
import STYLESHEET from '../src/style.css?raw';

describe('the highlight colours', () => {
  it('offers Calm, Vivid and Off, and opens on Calm', () => {
    expect(Object.entries(HIGHLIGHT_OPTIONS)).toEqual([
      ['calm', 'Calm'],
      ['vivid', 'Vivid'],
      ['off', 'Off'],
    ]);
    expect(DEFAULT_HIGHLIGHT).toBe('calm');
  });

  it('colours the sketch for Calm and Vivid, and leaves it alone for Off', () => {
    expect(highlights('calm')).toBe(true);
    expect(highlights('vivid')).toBe(true);
    expect(highlights('off')).toBe(false);
  });

  it('puts the palette on the body as a class, and Vivid is the only one that needs it', () => {
    const body = document.createElement('body');

    applyHighlight(body, 'vivid');
    expect(body.classList.contains(VIVID_BODY_CLASS)).toBe(true);

    applyHighlight(body, 'calm');
    expect(body.classList.contains(VIVID_BODY_CLASS)).toBe(false);

    applyHighlight(body, 'off');
    expect(body.classList.contains(VIVID_BODY_CLASS)).toBe(false);
  });

  it('gives Vivid the three rules the plugin gives it, scoped to the body class', () => {
    const vivid: [string, string][] = [
      ['class', '--code-function'],
      ['field', '--code-property'],
      ['operator', '--code-operator'],
    ];

    for (const [kind, variable] of vivid) {
      const rule = new RegExp(
        `body\\.${VIVID_BODY_CLASS} \\.cm-skiss-${kind} \\{\\s*color: var\\(${variable}\\)`,
      );
      expect(rule.test(STYLESHEET), `vivid ${kind}`).toBe(true);
      // A colour in both schemes, as every other one in the palette has.
      expect(STYLESHEET, `${variable} in light`).toContain(`${variable}: #`);
      expect(
        STYLESHEET.slice(STYLESHEET.indexOf('@media (prefers-color-scheme: dark)')),
        `${variable} in dark`,
      ).toContain(`${variable}: #`);
    }
  });

  it('takes a palette only from the three the header offers', () => {
    expect(isHighlightColours('calm')).toBe(true);
    expect(isHighlightColours('vivid')).toBe(true);
    expect(isHighlightColours('off')).toBe(true);
    expect(isHighlightColours('loud')).toBe(false);
    expect(isHighlightColours(undefined)).toBe(false);
    expect(isHighlightColours(2)).toBe(false);
  });
});
