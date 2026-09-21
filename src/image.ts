/**
 * The diagram as a file: the SVG on screen as markup, and the same SVG
 * rasterised to a PNG. The Obsidian plugin's `src/image.ts` is the model, and
 * for the same reasons — a blob URL rather than a `data:` URL so a diagram of
 * any size fits, the size read off the `viewBox` rather than off the image,
 * and nothing painted under the diagram so the PNG is transparent wherever it
 * is pasted.
 *
 * Everything that does not need a canvas — the markup, the size, the factor —
 * is a function here, so what the PNG is twice the size of is a plain test and
 * only the drawing itself needs a browser. What the two files are called is
 * `files.ts`, with the names of the other two downloads.
 */

/**
 * How many image pixels the PNG carries per diagram pixel. Fixed rather than
 * read from `window.devicePixelRatio`, as the plugin fixes it: the same sketch
 * exported from a laptop and from an external monitor should be the same file,
 * and 2 is what keeps the labels legible where the picture is pasted.
 */
export const PIXEL_RATIO = 2;

const NO_DIAGRAM = 'there is no diagram to export yet';
const NO_CANVAS = 'this browser gave no canvas to draw the PNG on';
const NO_SIZE = 'the diagram has no size to rasterise';
const NO_PNG = 'the canvas produced no PNG';
const NOT_RASTERISABLE = 'the diagram could not be rasterised in this browser';
const IMAGE_FAILED = 'the diagram could not be loaded as an image';

/** A width and a height in diagram pixels. */
export interface Size {
  width: number;
  height: number;
}

/**
 * The SVG on screen as a standalone file. Serialised as XML — the pane's copy
 * was parsed as HTML, which is how Mermaid serialised it — and given the XML
 * namespace where the markup does not already carry one, because a file
 * without it is not an SVG to anything that opens it outside a browser.
 */
export function svgMarkup(svg: Element): string {
  const markup = new XMLSerializer().serializeToString(svg);
  return markup.includes('xmlns=')
    ? markup
    : markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
}

/** The SVG as a file, ready for a download. */
export function svgBlob(svg: Element): Blob {
  return new Blob([svgMarkup(svg)], { type: 'image/svg+xml' });
}

/**
 * The size the diagram is drawn at: the box its own coordinates span, which is
 * what Mermaid writes into `viewBox`. Mermaid asks for the width of its
 * container rather than a number of pixels, so the width the browser gave the
 * element is the width of the pane, not of the picture.
 *
 * Read off the markup rather than off a parsed document: the root element is
 * the first thing serialised, so the first `viewBox` in the markup is the
 * root's, and two numbers do not need a parser.
 */
export function sizeOf(markup: string): Size {
  const box = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/.exec(
    markup,
  );
  const size = { width: Number(box?.[1]), height: Number(box?.[2]) };
  if (!isDrawable(size)) {
    throw new Error(NO_SIZE);
  }
  return size;
}

/** The canvas the PNG is drawn on: the diagram's own size, twice over. */
export function pngSize(size: Size): Size {
  return {
    width: Math.round(size.width * PIXEL_RATIO),
    height: Math.round(size.height * PIXEL_RATIO),
  };
}

/**
 * The same diagram as a PNG, on a transparent background and at twice the
 * SVG's size. The SVG reaches the image through a blob URL, which is revoked
 * again: it holds the blob alive for as long as the document lives otherwise.
 */
export async function pngBlob(svg: Element): Promise<Blob> {
  const markup = svgMarkup(svg);
  const size = sizeOf(markup);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  try {
    return await rasterise(await loadImage(url), size);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** What the notice says when the pane has nothing drawn in it to export. */
export function noDiagram(): Error {
  return new Error(NO_DIAGRAM);
}

async function rasterise(image: HTMLImageElement, size: Size): Promise<Blob> {
  const { width, height } = pngSize(size);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error(NO_CANVAS);
  }

  // Nothing is painted under the diagram: a canvas starts out transparent, and
  // a PNG carrying the page's own background is the wrong picture everywhere
  // else it is pasted.
  context.clearRect(0, 0, width, height);
  context.scale(PIXEL_RATIO, PIXEL_RATIO);
  // The destination size is given rather than left to the image, for the same
  // reason `sizeOf` reads the `viewBox`.
  context.drawImage(image, 0, 0, size.width, size.height);

  return await toPng(canvas);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    // The event says nothing about what went wrong, so the message names only
    // the step; markup an image decoder will not read is the one thing that
    // reaches this.
    image.addEventListener('error', () => reject(new Error(IMAGE_FAILED)));
    image.src = url;
  });
}

/**
 * `toBlob` is the callback form of every canvas; this is it as a promise. It
 * also throws, rather than calling back, where the browser refuses to read the
 * canvas at all, so the call is guarded.
 */
function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob === null) {
          reject(new Error(NO_PNG));
        } else {
          resolve(blob);
        }
      }, 'image/png');
    } catch (error) {
      reject(rasterisationError(error));
    }
  });
}

/**
 * What the notice says about a canvas the browser would not hand back. A
 * `SecurityError` is a canvas it considers tainted — "Tainted canvases may not
 * be exported" names nothing the visitor could do about it — so the sentence
 * that does comes first and the browser's own wording follows it. Anything
 * else reaches the notice as it is.
 */
function rasterisationError(error: unknown): Error {
  if (nameOf(error) !== 'SecurityError') {
    return error instanceof Error ? error : new Error(String(error));
  }
  return new Error(`${NOT_RASTERISABLE}: ${messageOf(error)}`);
}

/**
 * The `name` and the `message` of a thrown value, read off it rather than
 * through `instanceof Error`: a `DOMException` is what a canvas throws, and
 * whether that counts as an `Error` is the engine's answer, not ours.
 */
function nameOf(error: unknown): string {
  return propertyOf(error, 'name');
}

function messageOf(error: unknown): string {
  return propertyOf(error, 'message') || String(error);
}

function propertyOf(error: unknown, key: 'name' | 'message'): string {
  if (typeof error !== 'object' || error === null || !(key in error)) {
    return '';
  }
  const value: unknown = Reflect.get(error, key);
  return typeof value === 'string' ? value : '';
}

function isDrawable({ width, height }: Size): boolean {
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
}
