import { describe, expect, it } from 'vitest';
import { DEFAULT_EXAMPLE } from '../src/examples';
import { decodeSketch, encodedFromHash, encodeSketch, shareUrl } from '../src/share';

/** Where the site is deployed, which is the link a visitor actually shares. */
const DEPLOYED = 'https://erik-naslund.github.io/skiss-playground/';

/** What the issue asks of the link the Star Wars example produces. */
const LINK_BUDGET = 600;

describe('a sketch in the fragment', () => {
  it('comes back out of the fragment as it went in', async () => {
    const encoded = await encodeSketch(DEFAULT_EXAMPLE.source);

    expect(await decodeSketch(encoded)).toBe(DEFAULT_EXAMPLE.source);
  });

  it('comes back with its Unicode intact', async () => {
    // Characters outside Latin-1, and one outside the basic plane: a sketch is
    // written in whatever language the domain is described in.
    const sketch = 'Fartyg @Hamn   # båt, skärgård, ö\n    namn          ? räcker det? 🛳\n';

    expect(await decodeSketch(await encodeSketch(sketch))).toBe(sketch);
  });

  it('comes back from an empty sketch as an empty sketch', async () => {
    expect(await decodeSketch(await encodeSketch(''))).toBe('');
  });

  it('ignores a fragment that is not a sketch', async () => {
    // Every way a link arrives broken: an alphabet that is not base64url, a
    // base64url that is not deflate, and a link a chat client cut short.
    expect(await decodeSketch('not base64url!')).toBeUndefined();
    expect(await decodeSketch('AAAAAAAAAAAA')).toBeUndefined();

    const truncated = (await encodeSketch(DEFAULT_EXAMPLE.source)).slice(0, 12);
    expect(await decodeSketch(truncated)).toBeUndefined();
  });

  it('writes the sketch into the fragment and reads it back from there', async () => {
    const encoded = await encodeSketch(DEFAULT_EXAMPLE.source);
    const url = shareUrl(DEPLOYED, encoded);

    expect(url.startsWith(`${DEPLOYED}#s=`)).toBe(true);
    expect(encodedFromHash(new URL(url).hash)).toBe(encoded);
  });

  it('leaves the rest of the URL alone and replaces a fragment already there', async () => {
    const encoded = await encodeSketch('Planet\n    id*\n');
    const url = shareUrl(`${DEPLOYED}?a=b#s=older`, encoded);

    expect(url).toBe(`${DEPLOYED}?a=b#s=${encoded}`);
  });

  it('has nothing to read where the visit carried no sketch', () => {
    expect(encodedFromHash('')).toBeUndefined();
    expect(encodedFromHash('#')).toBeUndefined();
    // A fragment that is somebody else's: an anchor, or a key the page does
    // not know.
    expect(encodedFromHash('#section-2')).toBeUndefined();
    expect(encodedFromHash('#theme=dark')).toBeUndefined();
  });

  it('puts the Star Wars example in a link of under 600 characters', async () => {
    const url = shareUrl(DEPLOYED, await encodeSketch(DEFAULT_EXAMPLE.source));

    expect(url.length).toBeLessThan(LINK_BUDGET);
  });
});
