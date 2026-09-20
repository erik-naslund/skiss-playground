// @vitest-environment jsdom

import { VERSION } from '@eriknaslund/skiss';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { linkmlText, mermaidText } from '../src/exports';
import { mount, type Page } from '../src/page';
import { VIVID_BODY_CLASS } from '../src/palette';
import { decodeSketch, encodeSketch } from '../src/share';

/**
 * Mermaid itself is not what these tests are about, and it wants a browser
 * that lays things out. This is the shape of the one call the page makes into
 * it: `render` in, markup out.
 */
vi.mock('mermaid', () => ({
  default: {
    initialize: () => undefined,
    // The Mermaid text comes back inside the SVG, so a test can see which
    // sketch the pane is showing.
    // A `viewBox`, as Mermaid's own SVG carries one: it is what the downloads
    // read the size of the picture off.
    render: (_id: string, text: string) =>
      Promise.resolve({ svg: `<svg viewBox="0 0 400 200"><text>${text}</text></svg>` }),
  },
}));

function query<E extends Element>(root: ParentNode, selector: string): E {
  const found = root.querySelector<E>(selector);
  if (found === null) {
    throw new Error(`the page has no ${selector}`);
  }
  return found;
}

/**
 * `URL.createObjectURL` and its inverse, which jsdom does not implement, put
 * on the real `URL` rather than over it: the constructor is still needed while
 * they are there. The call gives back what puts the object as it was.
 */
function objectUrls(create: () => string): () => void {
  const had = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const hadRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, configurable: true });
  return () => {
    restore('createObjectURL', had);
    restore('revokeObjectURL', hadRevoke);
  };
}

function restore(key: string, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor === undefined) {
    Reflect.deleteProperty(URL, key);
  } else {
    Object.defineProperty(URL, key, descriptor);
  }
}

function texts(root: ParentNode, selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((element) => element.textContent ?? '');
}

describe('the page', () => {
  let root: HTMLElement;
  let page: Page;

  beforeEach(() => {
    // A fresh visit: no draft of a previous one, and no sketch in the link.
    localStorage.clear();
    window.location.hash = '';
    root = document.createElement('div');
    document.body.append(root);
    page = mount(root);
  });

  afterEach(() => {
    page.destroy();
    root.remove();
  });

  it('names the package version in the header', () => {
    expect(query(root, 'h1').textContent).toContain('Skiss playground');
    expect(query(root, '.version').textContent).toContain(VERSION);
  });

  it('offers the four examples and opens on the first', () => {
    const select = query<HTMLSelectElement>(root, '#example');

    expect(texts(select, 'option')).toEqual(EXAMPLES.map((example) => example.name));
    expect(select.value).toBe(EXAMPLES[0]?.id);
    expect(query(root, '.cm-content').textContent).toContain('Character');
  });

  it('opens with an editor, a diagram pane and a Fit button', () => {
    expect(root.querySelector('#editor .cm-editor')).not.toBeNull();
    expect(root.querySelector('#viewport #diagram')).not.toBeNull();
    expect(query<HTMLButtonElement>(root, '#fit').type).toBe('button');
  });

  it('hides the diagnostics where the sketch has none, and shows the doubt it has', () => {
    expect(query<HTMLElement>(root, '.diagnostics-panel').hidden).toBe(true);
    expect(texts(root, '#diagnostics li')).toEqual([]);
    // The first example asks one question, which is the point of a `?`.
    expect(query<HTMLElement>(root, '.questions-panel').hidden).toBe(false);
    expect(texts(root, '#questions li').length).toBe(1);
  });

  it('updates the diagnostics list as the sketch changes, errors first', () => {
    page.setSketch('Character\n  homeworld: Planet\n  ???\n');

    expect(query<HTMLElement>(root, '.diagnostics-panel').hidden).toBe(false);
    const shown = texts(root, '#diagnostics li');
    expect(shown.length).toBe(2);
    expect(shown[0]?.startsWith('line 3: ')).toBe(true);
    expect(shown[1]?.startsWith('line 2: ')).toBe(true);
    expect(texts(root, '#diagnostics li.error').length).toBe(1);
    expect(texts(root, '#diagnostics li.warning').length).toBe(1);
  });

  it('marks the lines with a diagnostic in the gutter, and tells the two apart', () => {
    page.setSketch('Character\n  homeworld: Planet\n  ???\n');

    const markers = [...root.querySelectorAll('.skiss-gutter-marker')];
    expect(markers.length).toBe(2);
    expect(root.querySelectorAll('.skiss-gutter-error').length).toBe(1);
    expect(root.querySelectorAll('.skiss-gutter-warning').length).toBe(1);
    // The message is on the marker, which is where a reader finds it.
    expect(markers.every((marker) => marker.getAttribute('title') !== '')).toBe(true);
  });

  it('lists the doubts of the sketch under Open questions', () => {
    page.setSketch('Character   ? is this a person?\n    name\n');

    expect(query<HTMLElement>(root, '.questions-panel').hidden).toBe(false);
    expect(texts(root, '#questions li')).toEqual(['Character: is this a person?']);
  });

  it('empties the lists again when the sketch is put right', () => {
    page.setSketch('  ???\n');
    expect(query<HTMLElement>(root, '.diagnostics-panel').hidden).toBe(false);

    page.setSketch('Character\n    name\n');
    expect(query<HTMLElement>(root, '.diagnostics-panel').hidden).toBe(true);
    expect(texts(root, '#diagnostics li')).toEqual([]);
  });

  it('draws the diagram of the sketch it opened with', async () => {
    await vi.waitFor(() => {
      expect(query(root, '#diagram svg').textContent).toContain('class Character');
    });
  });

  it('redraws within half a second of an edit, and never blanks while typing', async () => {
    await vi.waitFor(() => {
      expect(query(root, '#diagram svg').textContent).toContain('class Character');
    });

    // A line in the middle of being typed: the sketch is another one now, but
    // what is on screen is still the last diagram that drew.
    page.setSketch('Ship @Fleet\n    id*\n    home: Po');
    expect(query(root, '#diagram svg').textContent).toContain('class Character');

    await vi.waitFor(
      () => {
        expect(query(root, '#diagram svg').textContent).toContain('class Ship');
      },
      { timeout: 500 },
    );
  });

  it('shows something for a sketch the compiler cannot read, and throws nothing', () => {
    expect(() => page.setSketch('???\n')).not.toThrow();

    expect(texts(root, '#diagnostics li').length).toBeGreaterThan(0);
    expect(root.querySelector('#diagram')).not.toBeNull();
  });

  it('replaces the sketch when another example is chosen', () => {
    const select = query<HTMLSelectElement>(root, '#example');
    const library = EXAMPLES[1];

    select.value = library?.id ?? '';
    select.dispatchEvent(new Event('change'));

    expect(query(root, '.cm-content').textContent).toContain('Book');
  });
});

/**
 * The header's buttons, the link, the draft and the palette. They mount their
 * own page: what a visit opens with is decided by the fragment and by
 * `localStorage`, and both have to be set before `mount` reads them.
 */
describe('sharing, copying and downloading', () => {
  let root: HTMLElement;
  let page: Page | undefined;
  let clipboard: { writeText: Mock<(text: string) => Promise<void>> };
  let restoreUrls: (() => void) | undefined;

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    clipboard = { writeText: vi.fn((_text: string) => Promise.resolve()) };
    // jsdom has no clipboard, and a real one would ask a human.
    Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
    root = document.createElement('div');
    document.body.append(root);
  });

  afterEach(() => {
    page?.destroy();
    page = undefined;
    root.remove();
    restoreUrls?.();
    restoreUrls = undefined;
  });

  function open(): Page {
    page = mount(root);
    return page;
  }

  /** The last thing the page put on the clipboard. */
  function copied(): string {
    const last = clipboard.writeText.mock.calls.at(-1);
    if (last === undefined) {
      throw new Error('nothing was copied');
    }
    return last[0];
  }

  async function press(button: string): Promise<void> {
    query<HTMLButtonElement>(root, button).click();
    // The handlers are asynchronous to a promise or two; this is the end of
    // the queue they settle on.
    await vi.waitFor(() => expect(query(root, '#notice').textContent).not.toBe(''));
  }

  it('restores the draft of the last visit when the link carries no sketch', () => {
    localStorage.setItem('skiss-playground:draft', 'Ship @Fleet\n    id*\n');

    open();

    expect(query(root, '.cm-content').textContent).toContain('Ship');
  });

  it('keeps the draft as the sketch is edited', async () => {
    open().setSketch('Planet @Catalog\n    id*\n');

    await vi.waitFor(() => {
      expect(localStorage.getItem('skiss-playground:draft')).toContain('Planet @Catalog');
    });
  });

  it('opens the sketch a link carries, over the draft of the last visit', async () => {
    localStorage.setItem('skiss-playground:draft', 'Ship @Fleet\n    id*\n');
    window.location.hash = `#s=${await encodeSketch('Droid @Catalog\n    serial*\n')}`;

    await open().ready;

    expect(query(root, '.cm-content').textContent).toContain('Droid');
    expect(query(root, '.cm-content').textContent).not.toContain('Ship');
  });

  it('ignores a link that carries no sketch it can read, and says so', async () => {
    window.location.hash = '#s=AAAAAAAAAAAA';

    await open().ready;

    expect(query(root, '#notice').textContent).toContain('no sketch');
    // And the page shows what a visit without a link would have shown.
    expect(query(root, '.cm-content').textContent).toContain('Character');
  });

  it('copies a link that opens the same sketch, and puts it in the address bar', async () => {
    open().setSketch('Droid @Catalog\n    serial*\n');

    await press('#share');

    expect(query(root, '#notice').textContent).toBe('Link copied');
    expect(await decodeSketch(copied().split('#s=')[1] ?? '')).toBe(
      'Droid @Catalog\n    serial*\n',
    );
    // The same link is in the address bar, for a visitor who copies it there.
    expect(window.location.hash.startsWith('#s=')).toBe(true);
    expect(copied()).toBe(window.location.href);
  });

  it('copies the Mermaid and the LinkML of the sketch on screen', async () => {
    const sketch =
      'Character @Catalog\n    id*\n    homeworld: Planet\n\nPlanet @Catalog\n    id*\n';
    open().setSketch(sketch);

    await press('#copy-mermaid');
    expect(query(root, '#notice').textContent).toBe('Mermaid copied');
    expect(copied()).toBe(mermaidText(sketch));

    await press('#copy-linkml');
    expect(query(root, '#notice').textContent).toBe('LinkML copied');
    expect(copied()).toBe(linkmlText(sketch));
  });

  it('disables both copies while the sketch has an error, and says why on the button', () => {
    open().setSketch('Character\n  homeworld: Planet\n  ???\n');

    for (const id of ['#copy-mermaid', '#copy-linkml']) {
      const button = query<HTMLButtonElement>(root, id);
      expect(button.disabled, id).toBe(true);
      expect(button.title, id).not.toBe('');
    }

    page?.setSketch('Character\n    name\n');
    expect(query<HTMLButtonElement>(root, '#copy-mermaid').disabled).toBe(false);
    expect(query<HTMLButtonElement>(root, '#copy-linkml').hasAttribute('title')).toBe(false);
  });

  it('downloads the diagram as sketch.svg', async () => {
    restoreUrls = objectUrls(() => 'blob:sketch');
    const downloaded: string[] = [];
    // The anchor the download goes through is clicked, not navigated to:
    // nothing in jsdom can follow a blob URL, and nothing needs to.
    const onClick = (event: Event): void => {
      if (event.target instanceof HTMLAnchorElement) {
        downloaded.push(event.target.download);
        event.preventDefault();
      }
    };
    document.addEventListener('click', onClick, true);
    try {
      open();
      await vi.waitFor(() => expect(root.querySelector('#diagram svg')).not.toBeNull());
      query<HTMLButtonElement>(root, '#download-svg').click();

      await vi.waitFor(() => expect(downloaded).toEqual(['sketch.svg']));
    } finally {
      document.removeEventListener('click', onClick, true);
    }
  });

  it('says what went wrong rather than downloading nothing', async () => {
    restoreUrls = objectUrls(() => {
      throw new Error('no object URLs in here');
    });
    open();

    await vi.waitFor(() => expect(root.querySelector('#diagram svg')).not.toBeNull());
    await press('#download-png');

    expect(query(root, '#notice').textContent).toContain('no object URLs in here');
  });

  it('copies the link on Ctrl+S instead of opening the browser-s save dialog', async () => {
    open().setSketch('Droid @Catalog\n    serial*\n');

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(query(root, '#notice').textContent).toBe('Link copied'));
    expect(copied()).toContain('#s=');
  });

  it('draws the sketch at once on Ctrl+Enter, rather than after the debounce', async () => {
    open();
    await vi.waitFor(() => expect(query(root, '#diagram svg').textContent).toContain('Character'));

    page?.setSketch('Droid @Catalog\n    serial*\n');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));

    // Well inside the 300 ms the debounced render would have taken.
    await vi.waitFor(
      () => {
        expect(query(root, '#diagram svg').textContent).toContain('class Droid');
      },
      { timeout: 150 },
    );
  });
});

describe('the highlight colours in the header', () => {
  let root: HTMLElement;
  let page: Page | undefined;

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    root = document.createElement('div');
    document.body.append(root);
  });

  afterEach(() => {
    page?.destroy();
    page = undefined;
    root.remove();
  });

  function choose(colours: string): void {
    const select = query<HTMLSelectElement>(root, '#highlight');
    select.value = colours;
    select.dispatchEvent(new Event('change'));
  }

  it('opens on Calm, which colours the sketch and puts no class on the body', () => {
    page = mount(root);

    expect(query<HTMLSelectElement>(root, '#highlight').value).toBe('calm');
    expect(document.body.classList.contains(VIVID_BODY_CLASS)).toBe(false);
    expect(root.querySelectorAll('.cm-skiss-class').length).toBeGreaterThan(0);
  });

  it('applies Vivid at once, as a class on the body', () => {
    page = mount(root);

    choose('vivid');

    expect(document.body.classList.contains(VIVID_BODY_CLASS)).toBe(true);
    expect(root.querySelectorAll('.cm-skiss-class').length).toBeGreaterThan(0);
  });

  it('takes the colours out for Off and leaves the gutter where it is', () => {
    page = mount(root);
    page.setSketch('Character\n  homeworld: Planet\n  ???\n');
    expect(root.querySelectorAll('.skiss-gutter-marker').length).toBe(2);

    choose('off');

    expect(root.querySelectorAll('[class^="cm-skiss-"]').length).toBe(0);
    expect(root.querySelectorAll('.skiss-gutter-marker').length).toBe(2);
    expect(document.body.classList.contains(VIVID_BODY_CLASS)).toBe(false);
  });

  it('survives a reload', () => {
    page = mount(root);
    choose('vivid');
    page.destroy();

    page = mount(root);

    expect(query<HTMLSelectElement>(root, '#highlight').value).toBe('vivid');
    expect(document.body.classList.contains(VIVID_BODY_CLASS)).toBe(true);
  });

  it('is nowhere in the share link: a link carries the sketch, not a preference', async () => {
    const writeText = vi.fn((_text: string) => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const sketch = 'Droid @Catalog\n    serial*\n';
    page = mount(root);
    choose('vivid');
    page.setSketch(sketch);

    query<HTMLButtonElement>(root, '#share').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());

    const url = writeText.mock.calls.at(-1)?.[0] ?? '';
    // The link holds the sketch and only the sketch.
    expect(new URL(url).hash).toBe(`#s=${await encodeSketch(sketch)}`);
    expect(url).not.toContain('vivid');
  });
});
