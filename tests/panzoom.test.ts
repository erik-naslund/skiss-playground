import { describe, expect, it } from 'vitest';
import { clampScale, zoomAbout } from '../src/panzoom';

const START = { x: 0, y: 0, scale: 1 };

describe('zooming', () => {
  it('keeps the point under the pointer where it is', () => {
    const zoomed = zoomAbout(START, 2, 100, 50);

    expect(zoomed.scale).toBe(2);
    // The point (100, 50) of the viewport was (100, 50) of the diagram, and it
    // is still where the pointer is.
    expect(zoomed.x + 100 * zoomed.scale).toBeCloseTo(100);
    expect(zoomed.y + 50 * zoomed.scale).toBeCloseTo(50);
  });

  it('keeps it where it is after a pan as well', () => {
    const panned = { x: 40, y: -20, scale: 1.5 };
    const zoomed = zoomAbout(panned, 1.25, 30, 30);
    const before = { x: (30 - panned.x) / panned.scale, y: (30 - panned.y) / panned.scale };

    expect(zoomed.x + before.x * zoomed.scale).toBeCloseTo(30);
    expect(zoomed.y + before.y * zoomed.scale).toBeCloseTo(30);
  });

  it('will not let the diagram vanish or fill the pane with one glyph', () => {
    expect(zoomAbout(START, 0.0001, 0, 0).scale).toBe(clampScale(0));
    expect(zoomAbout(START, 10000, 0, 0).scale).toBe(clampScale(Number.POSITIVE_INFINITY));
    expect(clampScale(1)).toBe(1);
  });

  it('moves nothing at the limit it has already reached', () => {
    const smallest = zoomAbout(START, 0.0001, 100, 100);
    const smaller = zoomAbout(smallest, 0.5, 100, 100);

    expect(smaller).toEqual(smallest);
  });
});
