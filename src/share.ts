/**
 * A sketch as a link. The text is deflated and written into the URL fragment,
 * which is the one part of a URL a browser never sends to a server: a shared
 * link carries the sketch to whoever opens it and to nobody else (ADR-0001).
 *
 * `CompressionStream('deflate-raw')` and its inverse, which every current
 * browser has, so the page adds no dependency to do it. Raw deflate rather
 * than gzip: the same bytes without the eighteen of header and checksum that
 * a fragment would have to carry in base64.
 *
 * A function from text to text either way, so the round trip is a plain test.
 *
 * The title rides along beside the sketch, URL-encoded rather than compressed:
 * it is one line, and a link a visitor reads before they open it is worth more
 * than the handful of characters packing it would save.
 */

/**
 * The bytes between the text and the fragment. Spelled with its buffer, which
 * is what a stream writer takes: a `Uint8Array` over a buffer that might be
 * shared is not something a browser will write into a stream.
 */
type Bytes = Uint8Array<ArrayBuffer>;

/** The fragment's keys: `#s=<base64url>&t=<title>`. */
export const FRAGMENT_KEY = 's';
export const TITLE_KEY = 't';

/**
 * The sketch as the fragment holds it: deflated, then base64url, which is the
 * alphabet a fragment takes without escaping any of it.
 */
export async function encodeSketch(text: string): Promise<string> {
  const deflated = await through(
    new TextEncoder().encode(text),
    new CompressionStream('deflate-raw'),
  );
  return toBase64Url(deflated);
}

/**
 * The sketch a fragment holds, or `undefined` where it holds something else.
 * A link is typed, truncated by a chat client and pasted by hand, so every way
 * this can fail — an alphabet that is not base64, bytes that are not deflate,
 * bytes that are not UTF-8 — ends here as `undefined` and the page says so
 * rather than throwing.
 */
export async function decodeSketch(encoded: string): Promise<string | undefined> {
  try {
    const bytes = fromBase64Url(encoded);
    const inflated = await through(bytes, new DecompressionStream('deflate-raw'));
    // `fatal`, so bytes that inflated but are not text are refused here
    // instead of reaching the editor as replacement characters.
    return new TextDecoder('utf-8', { fatal: true }).decode(inflated);
  } catch {
    return undefined;
  }
}

/**
 * The encoded sketch in a `location.hash`, or `undefined` where there is none.
 * Read as query parameters, so a fragment the page does not know — another
 * key, or one added by whatever passed the link on — is ignored rather than
 * mistaken for a sketch.
 */
export function encodedFromHash(hash: string): string | undefined {
  return paramsOf(hash).get(FRAGMENT_KEY) ?? undefined;
}

/**
 * The title a link carried, or `''` where it carried none — which is every
 * link written before the title existed, and every link to a sketch that has
 * no title.
 */
export function titleFromHash(hash: string): string {
  return paramsOf(hash).get(TITLE_KEY) ?? '';
}

function paramsOf(hash: string): URLSearchParams {
  const query = hash.startsWith('#') ? hash.slice(1) : hash;
  return new URLSearchParams(query);
}

/**
 * `href` with the sketch and its title in the fragment, which is both what
 * Share copies and what the address bar is replaced with. An empty title is
 * left out rather than carried as an empty key, so the link of an untitled
 * sketch is the link it always was. Anything else the URL carries is left
 * alone; only the fragment is ours.
 */
export function shareUrl(href: string, encoded: string, title: string): string {
  const url = new URL(href);
  const named = title === '' ? '' : `&${TITLE_KEY}=${encodeURIComponent(title)}`;
  url.hash = `${FRAGMENT_KEY}=${encoded}${named}`;
  return url.toString();
}

/**
 * Bytes through a compression stream. The write is started before the read
 * loop and awaited after it: a transform stream accepts what is written to it
 * only while something is reading the other end, so writing and then reading
 * would deadlock on an input larger than the stream's own queue.
 */
async function through(
  bytes: Bytes,
  stream: CompressionStream | DecompressionStream,
): Promise<Bytes> {
  const writer: WritableStreamDefaultWriter<Bytes> = stream.writable.getWriter();
  const written = writer.write(bytes).then(() => writer.close());
  // What went wrong reaches the caller from the reader below, which fails on
  // the same stream; this keeps the writer's own rejection from going unheard.
  written.catch(() => undefined);

  const reader: ReadableStreamDefaultReader<Bytes> = stream.readable.getReader();
  const chunks: Bytes[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    length += value.length;
  }
  await written;

  const all = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.length;
  }
  return all;
}

function toBase64Url(bytes: Bytes): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Bytes {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) {
    throw new Error('the fragment is not base64url');
  }
  // `atob` reads the standard alphabet and tolerates the padding being absent.
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
