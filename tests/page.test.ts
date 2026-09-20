// @vitest-environment jsdom

import { VERSION } from '@eriknaslund/skiss';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { linkmlText, mermaidText } from '../src/exports';
import { ACCEPT, importSketch } from '../src/files';
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
function objectUrls(create: (blob: Blob) => string): () => void {
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

/**
 * Opening a file, dropping one on the editor, saving the sketch and the schema,
 * and the offer a pasted schema gets. jsdom has neither `DragEvent` nor
 * `DataTransfer`, so a drop is the event the page listens for with the one
 * property it reads put on it — which is all the page ever touches.
 */
describe('opening and saving files', () => {
  let root: HTMLElement;
  let page: Page | undefined;
  let restoreUrls: (() => void) | undefined;
  let downloads: { name: string; blob: Blob | undefined }[];
  let lastBlob: Blob | undefined;
  let onClick: ((event: Event) => void) | undefined;

  const SKETCH = 'Droid @Catalog\n    serial*\n    model\n';

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    downloads = [];
    lastBlob = undefined;
    root = document.createElement('div');
    document.body.append(root);
    restoreUrls = objectUrls((blob) => {
      lastBlob = blob;
      return 'blob:sketch';
    });
    // The anchor a download goes through is clicked, not navigated to; the blob
    // it was given is the file the visitor would have got.
    onClick = (event: Event): void => {
      if (event.target instanceof HTMLAnchorElement) {
        downloads.push({ name: event.target.download, blob: lastBlob });
        event.preventDefault();
      }
    };
    document.addEventListener('click', onClick, true);
  });

  afterEach(() => {
    if (onClick !== undefined) {
      document.removeEventListener('click', onClick, true);
      onClick = undefined;
    }
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

  /** A file the visitor chose, as the hidden input reports one. */
  function choose(file: File): void {
    const input = query<HTMLInputElement>(root, '#file');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  /** The same file, dropped on the editor pane instead. */
  function drop(file: File | undefined): Event {
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: file === undefined ? [] : [file], types: ['Files'] },
    });
    query(root, '.editor-pane').dispatchEvent(event);
    return event;
  }

  function file(name: string, text: string): File {
    return new File([text], name, { type: 'text/plain' });
  }

  /** The sentence and the report above the editor. */
  function saidAboutFiles(): string {
    return query(root, '.file-panel').textContent ?? '';
  }

  function editorText(): string {
    return query(root, '.cm-content').textContent ?? '';
  }

  it('offers an Open button and a file input for the extensions it reads', () => {
    open();

    expect(query<HTMLButtonElement>(root, '#open').type).toBe('button');
    const input = query<HTMLInputElement>(root, '#file');
    expect(input.type).toBe('file');
    expect(input.accept).toBe(ACCEPT);
    expect(input.hidden).toBe(true);
  });

  it('shows an opened .skiss file in the editor and renders it', async () => {
    open();

    choose(file('booking.skiss', SKETCH));

    await vi.waitFor(() => expect(editorText()).toContain('Droid'));
    expect(query(root, '#notice').textContent).toContain('booking.skiss');
    await vi.waitFor(() => {
      expect(query(root, '#diagram svg').textContent).toContain('class Droid');
    });
  });

  it('imports an opened LinkML file, shows the dropped report and renders the sketch', async () => {
    const schema = `id: https://example.org/people
name: people
default_prefix: people
default_range: string
prefixes: {}
imports:
  - linkml:types
classes:
  Person:
    mixins:
      - Auditable
    attributes:
      id:
        identifier: true
      name:
        pattern: "^[A-Z]"
`;
    open();

    choose(file('people.yaml', schema));

    await vi.waitFor(() => expect(editorText()).toContain('Person'));
    expect(query<HTMLElement>(root, '.file-panel').hidden).toBe(false);
    // The package's own report, line for line.
    expect(texts(root, '#file-report li')).toEqual(importSketch(schema).report);
    expect(saidAboutFiles()).toContain('pattern');
    await vi.waitFor(() => {
      expect(query(root, '#diagram svg').textContent).toContain('class Person');
    });
  });

  it('keeps the sketch and says why for a LinkML file no schema can be read out of', async () => {
    open().setSketch(SKETCH);

    choose(file('people.yaml', '- one\n- two\n'));

    await vi.waitFor(() => expect(query<HTMLElement>(root, '.file-panel').hidden).toBe(false));
    expect(editorText()).toContain('Droid');
    expect(saidAboutFiles().length).toBeGreaterThan(0);
  });

  it('takes the report away again on the next edit', async () => {
    open();
    choose(file('people.yaml', 'id: x\nname: x\nclasses:\n  Person:\n    mixins:\n      - A\n'));
    await vi.waitFor(() => expect(query<HTMLElement>(root, '.file-panel').hidden).toBe(false));

    page?.setSketch('Ship @Fleet\n    id*\n');

    expect(query<HTMLElement>(root, '.file-panel').hidden).toBe(true);
  });

  it('opens a file dropped on the editor pane', async () => {
    open();

    const event = drop(file('booking.skiss', SKETCH));

    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(editorText()).toContain('Droid'));
  });

  it('refuses a dropped .png with a notice naming the extensions it reads', async () => {
    open().setSketch(SKETCH);

    drop(new File(['not text at all'], 'diagram.png', { type: 'image/png' }));

    await vi.waitFor(() => expect(query<HTMLElement>(root, '.file-panel').hidden).toBe(false));
    for (const extension of ACCEPT.split(',')) {
      expect(saidAboutFiles()).toContain(extension);
    }
    // And the sketch that was there is still there.
    expect(editorText()).toContain('Droid');
  });

  it('leaves a drop that carries no file to the editor', () => {
    open();

    const event = drop(undefined);

    expect(event.defaultPrevented).toBe(false);
    expect(query<HTMLElement>(root, '.file-panel').hidden).toBe(true);
  });

  it('saves the editor text as sketch.skiss, and under the opened name once one is opened', async () => {
    open().setSketch(SKETCH);

    query<HTMLButtonElement>(root, '#save-skiss').click();

    await vi.waitFor(() => expect(downloads.length).toBe(1));
    expect(downloads[0]?.name).toBe('sketch.skiss');
    expect(await downloads[0]?.blob?.text()).toBe(SKETCH);

    // A file of its own text, so the wait is for the file and not for what was
    // already in the editor.
    const opened = 'Ship @Fleet\n    id*\n';
    choose(file('booking.skiss', opened));
    await vi.waitFor(() => expect(editorText()).toContain('Ship'));
    query<HTMLButtonElement>(root, '#save-skiss').click();

    await vi.waitFor(() => expect(downloads.length).toBe(2));
    expect(downloads[1]?.name).toBe('booking.skiss');
    expect(await downloads[1]?.blob?.text()).toBe(opened);
  });

  it('saves the compiled schema as sketch.linkml.yaml', async () => {
    open().setSketch(SKETCH);

    query<HTMLButtonElement>(root, '#save-linkml').click();

    await vi.waitFor(() => expect(downloads.length).toBe(1));
    expect(downloads[0]?.name).toBe('sketch.linkml.yaml');
    expect(await downloads[0]?.blob?.text()).toBe(linkmlText(SKETCH));
  });

  it('names the schema after the file the sketch was opened from', async () => {
    open();
    choose(file('booking.skiss', 'Ship @Fleet\n    id*\n'));
    await vi.waitFor(() => expect(editorText()).toContain('Ship'));

    query<HTMLButtonElement>(root, '#save-linkml').click();

    await vi.waitFor(() => expect(downloads.length).toBe(1));
    expect(downloads[0]?.name).toBe('booking.linkml.yaml');
  });

  it('goes back to sketch.skiss when an example replaces the opened file', async () => {
    open();
    choose(file('booking.skiss', 'Ship @Fleet\n    id*\n'));
    await vi.waitFor(() => expect(editorText()).toContain('Ship'));

    const select = query<HTMLSelectElement>(root, '#example');
    select.value = EXAMPLES[1]?.id ?? '';
    select.dispatchEvent(new Event('change'));
    query<HTMLButtonElement>(root, '#save-skiss').click();

    await vi.waitFor(() => expect(downloads.length).toBe(1));
    expect(downloads[0]?.name).toBe('sketch.skiss');
  });

  it('disables Save LinkML while the sketch has an error, and keeps Save .skiss', () => {
    open().setSketch('Character\n  homeworld: Planet\n  ???\n');

    const linkml = query<HTMLButtonElement>(root, '#save-linkml');
    expect(linkml.disabled).toBe(true);
    expect(linkml.title).not.toBe('');
    // The sketch itself is the visitor's text, error or no error.
    expect(query<HTMLButtonElement>(root, '#save-skiss').disabled).toBe(false);

    page?.setSketch('Character\n    name\n');
    expect(query<HTMLButtonElement>(root, '#save-linkml').disabled).toBe(false);
    expect(query<HTMLButtonElement>(root, '#save-linkml').hasAttribute('title')).toBe(false);
  });

  it('offers to import pasted LinkML, and converts nothing until the button is pressed', () => {
    const schema = `id: https://example.org/people
name: people
default_prefix: people
default_range: string
prefixes: {}
imports: []
classes:
  Person:
    attributes:
      id:
        identifier: true
      name: {}
`;
    open().setSketch(schema);

    // The offer, and the schema still in the editor: nothing was converted.
    expect(query<HTMLElement>(root, '.file-panel').hidden).toBe(false);
    expect(saidAboutFiles()).toContain('LinkML');
    expect(query<HTMLButtonElement>(root, '#import-linkml').hidden).toBe(false);
    expect(editorText()).toContain('classes:');

    query<HTMLButtonElement>(root, '#import-linkml').click();

    expect(editorText()).toContain('Person');
    expect(editorText()).not.toContain('classes:');
    expect(query<HTMLButtonElement>(root, '#import-linkml').hidden).toBe(true);
  });

  it('offers nothing for a sketch, and nothing for text that only mentions classes', () => {
    open().setSketch(SKETCH);
    expect(query<HTMLElement>(root, '.file-panel').hidden).toBe(true);

    page?.setSketch('Classes @Timetable\n    id*\n');
    expect(query<HTMLElement>(root, '.file-panel').hidden).toBe(true);
    expect(root.querySelector('#import-linkml')?.parentElement?.hidden).toBe(true);
  });
});
