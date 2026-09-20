// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { PIXEL_RATIO, pngSize, sizeOf, svgMarkup } from '../src/image';

/** A Mermaid SVG as far as the export is concerned: a root with a `viewBox`. */
const DIAGRAM = '<svg id="d" width="100%" viewBox="0 0 412 318.5"><g></g></svg>';

function svgElement(markup: string): Element {
  const root = new DOMParser().parseFromString(markup, 'text/html').body.firstElementChild;
  if (root === null) {
    throw new Error('the fixture is not an element');
  }
  return root;
}

describe('the diagram as a file', () => {
  it('rasterises the PNG at twice the size the SVG is drawn at', () => {
    const size = sizeOf(DIAGRAM);

    expect(size).toEqual({ width: 412, height: 318.5 });
    expect(PIXEL_RATIO).toBe(2);
    // Twice over, and whole pixels: a canvas has no half ones.
    expect(pngSize(size)).toEqual({ width: 824, height: 637 });
  });

  it('takes the size from the `viewBox` rather than from the element', () => {
    // Mermaid asks for the width of its container, so the width on the element
    // is the width of the pane and not of the picture.
    expect(sizeOf('<svg width="100%" height="100%" viewBox="0 0 10 20"></svg>')).toEqual({
      width: 10,
      height: 20,
    });
    // A `viewBox` written the other way round, which is also valid.
    expect(sizeOf('<svg viewBox="0,0,30,40"></svg>')).toEqual({ width: 30, height: 40 });
  });

  it('says so rather than rasterising a diagram with no size', () => {
    expect(() => sizeOf('<svg></svg>')).toThrow();
    expect(() => sizeOf('<svg viewBox="0 0 0 0"></svg>')).toThrow();
  });

  it('gives the downloaded SVG the namespace a file outside a browser needs', () => {
    const markup = svgMarkup(svgElement(DIAGRAM));

    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markup).toContain('viewBox="0 0 412 318.5"');
    // Once, not twice: the parser gives the element the namespace already in
    // some browsers and not in others.
    expect(markup.match(/xmlns="/g)?.length).toBe(1);
  });
});
