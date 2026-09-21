// @vitest-environment jsdom

import { VERSION } from '@eriknaslund/skiss';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { linkmlText, mermaidText } from '../src/exports';
import { ACCEPT, importSketch } from '../src/files';
import { mount, type Page } from '../src/page';
import { VIVID_BODY_CLASS } from '../src/palette';
import { decodeSketch, encodedFromHash, encodeSketch } from '../src/share';
import { slugOf } from '../src/title';

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

/** The title as the visitor types it into the header. */
function typeTitle(root: ParentNode, title: string): void {
  const field = query<HTMLInputElement>(root, '#title');
  field.value = title;
  field.dispatchEvent(new Event('input'));
}

function titleOf(root: ParentNode): string {
  return query<HTMLInputElement>(root, '#title').value;
}

function chosenExample(root: ParentNode): string {
  return query<HTMLSelectElement>(root, '#example').value;
}

/** The example the header's select loads, as a visitor choosing one. */
function chooseExample(root: ParentNode, id: string): void {
  const select = query<HTMLSelectElement>(root, '#example');
  select.value = id;
  select.dispatchEvent(new Event('change'));
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
    // jsdom has no dialog, and a real one would ask a human: the page's
    // confirmation is answered here, and yes is what nothing here is about.
    page = mount(root, { confirm: () => true });
  });

  afterEach(() => {
    page.destroy();
    root.remove();
  });

  it('names the package version in the header', () => {
    expect(query(root, 'h1').textContent).toContain('Skiss playground');
    expect(query(root, '.version').textContent).toContain(VERSION);
  });

  it('offers the four examples under a blank option, and opens on the first', () => {
    const select = query<HTMLSelectElement>(root, '#example');

    expect(texts(select, 'option')).toEqual([
      'Load an example…',
      ...EXAMPLES.map((example) => example.name),
    ]);
    // A fresh visit with no draft and no link still opens on the first
    // example, and the select says which one it is.
    expect(select.value).toBe(EXAMPLES[0]?.id);
    expect(titleOf(root)).toBe(EXAMPLES[0]?.name);
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

  it('replaces the sketch and its title when another example is chosen', () => {
    const library = EXAMPLES[1];

    chooseExample(root, library?.id ?? '');

    expect(query(root, '.cm-content').textContent).toContain('Book');
    expect(titleOf(root)).toBe(library?.name);
    expect(chosenExample(root)).toBe(library?.id);
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
    page = mount(root, { confirm: () => true });
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

  it('restores the title and the text of the draft when the link carries no sketch', () => {
    localStorage.setItem('skiss-playground:draft', 'Ship @Fleet\n    id*\n');
    localStorage.setItem('skiss-playground:draft-title', 'Fleet');

    open();

    expect(query(root, '.cm-content').textContent).toContain('Ship');
    expect(titleOf(root)).toBe('Fleet');
    expect(document.title).toBe('Fleet · Skiss playground');
    // A draft is the visitor's own sketch, not an example.
    expect(chosenExample(root)).toBe('');
  });

  it('restores a draft written before the title existed, with no title', () => {
    localStorage.setItem('skiss-playground:draft', 'Ship @Fleet\n    id*\n');

    open();

    expect(query(root, '.cm-content').textContent).toContain('Ship');
    expect(titleOf(root)).toBe('');
    expect(document.title).toBe('Skiss playground');
  });

  it('keeps the draft, and the title, as the sketch is edited', async () => {
    open().setSketch('Planet @Catalog\n    id*\n');
    typeTitle(root, 'Planets');

    await vi.waitFor(() => {
      expect(localStorage.getItem('skiss-playground:draft')).toContain('Planet @Catalog');
      expect(localStorage.getItem('skiss-playground:draft-title')).toBe('Planets');
    });
  });

  it('opens the sketch and the title a link carries, over the draft of the last visit', async () => {
    localStorage.setItem('skiss-playground:draft', 'Ship @Fleet\n    id*\n');
    localStorage.setItem('skiss-playground:draft-title', 'Fleet');
    const encoded = await encodeSketch('Droid @Catalog\n    serial*\n');
    window.location.hash = `#s=${encoded}&t=${encodeURIComponent('Droid catalogue')}`;

    await open().ready;

    expect(query(root, '.cm-content').textContent).toContain('Droid');
    expect(query(root, '.cm-content').textContent).not.toContain('Ship');
    expect(titleOf(root)).toBe('Droid catalogue');
    expect(document.title).toBe('Droid catalogue · Skiss playground');
  });

  it('opens a link written before the title existed with an empty title', async () => {
    window.location.hash = `#s=${await encodeSketch('Droid @Catalog\n    serial*\n')}`;

    await open().ready;

    expect(query(root, '.cm-content').textContent).toContain('Droid');
    expect(titleOf(root)).toBe('');
    expect(document.title).toBe('Skiss playground');
  });

  it('ignores a link that carries no sketch it can read, and says so', async () => {
    window.location.hash = '#s=AAAAAAAAAAAA';

    await open().ready;

    expect(query(root, '#notice').textContent).toContain('no sketch');
    // And the page shows what a visit without a link would have shown.
    expect(query(root, '.cm-content').textContent).toContain('Character');
  });

  it('copies a link that opens the same sketch and title, and puts it in the address bar', async () => {
    open().setSketch('Droid @Catalog\n    serial*\n');
    typeTitle(root, 'Droid catalogue');

    await press('#share');

    expect(query(root, '#notice').textContent).toBe('Link copied');
    const hash = new URL(copied()).hash;
    expect(await decodeSketch(encodedFromHash(hash) ?? '')).toBe('Droid @Catalog\n    serial*\n');
    expect(hash).toContain(`&t=${encodeURIComponent('Droid catalogue')}`);
    // The same link is in the address bar, for a visitor who copies it there.
    expect(window.location.hash.startsWith('#s=')).toBe(true);
    expect(copied()).toBe(window.location.href);
  });

  it('copies the Mermaid and the LinkML of the sketch on screen, named after the title', async () => {
    const sketch =
      'Character @Catalog\n    id*\n    homeworld: Planet\n\nPlanet @Catalog\n    id*\n';
    open().setSketch(sketch);
    typeTitle(root, 'Booking flow');

    await press('#copy-mermaid');
    expect(query(root, '#notice').textContent).toBe('Mermaid copied');
    expect(copied()).toBe(mermaidText(sketch));

    await press('#copy-linkml');
    expect(query(root, '#notice').textContent).toBe('LinkML copied');
    // The schema is named after the title here as it is in the saved file.
    expect(copied()).toBe(linkmlText(sketch, 'booking-flow'));

    typeTitle(root, '');
    await press('#copy-linkml');
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

  it('names the diagram after the title: the first example downloads as its own slug', async () => {
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

      await vi.waitFor(() =>
        expect(downloaded).toEqual([`${slugOf(EXAMPLES[0]?.name ?? '')}.svg`]),
      );
      expect(downloaded[0]).toBe('star-wars-catalogue.svg');
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
    typeTitle(root, '');
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
  /** What the page's confirmation is answered with where a file replaces a dirty sketch. */
  let answer: boolean;

  const SKETCH = 'Droid @Catalog\n    serial*\n    model\n';

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    downloads = [];
    lastBlob = undefined;
    answer = true;
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
    page = mount(root, { confirm: () => answer });
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

  it('shows an opened .skiss file in the editor, names it after the file and renders it', async () => {
    open();

    choose(file('Booking flow.skiss', SKETCH));

    await vi.waitFor(() => expect(editorText()).toContain('Droid'));
    expect(titleOf(root)).toBe('Booking flow');
    expect(document.title).toBe('Booking flow · Skiss playground');
    expect(query(root, '#notice').textContent).toContain('Booking flow.skiss');
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

  it('saves the editor text as sketch.skiss while the sketch has no title', async () => {
    open().setSketch(SKETCH);
    typeTitle(root, '');

    query<HTMLButtonElement>(root, '#save-skiss').click();

    await vi.waitFor(() => expect(downloads.length).toBe(1));
    expect(downloads[0]?.name).toBe('sketch.skiss');
    expect(await downloads[0]?.blob?.text()).toBe(SKETCH);
  });

  it('opens Booking flow.skiss and saves it again as booking-flow.skiss', async () => {
    open();

    // A file of its own text, so the wait is for the file and not for what was
    // already in the editor.
    const opened = 'Ship @Fleet\n    id*\n';
    choose(file('Booking flow.skiss', opened));
    await vi.waitFor(() => expect(editorText()).toContain('Ship'));
    expect(titleOf(root)).toBe('Booking flow');
    query<HTMLButtonElement>(root, '#save-skiss').click();

    await vi.waitFor(() => expect(downloads.length).toBe(1));
    expect(downloads[0]?.name).toBe('booking-flow.skiss');
    expect(await downloads[0]?.blob?.text()).toBe(opened);
  });

  it('saves the compiled schema as sketch.linkml.yaml while the sketch has no title', async () => {
    open().setSketch(SKETCH);
    typeTitle(root, '');

    query<HTMLButtonElement>(root, '#save-linkml').click();

    await vi.waitFor(() => expect(downloads.length).toBe(1));
    expect(downloads[0]?.name).toBe('sketch.linkml.yaml');
    expect(await downloads[0]?.blob?.text()).toBe(linkmlText(SKETCH));
  });

  it('names the schema, in the file and inside it, after the slug of the title', async () => {
    const sketch = 'Ship @Fleet\n    id*\n';
    open();
    choose(file('Booking flow.skiss', sketch));
    await vi.waitFor(() => expect(editorText()).toContain('Ship'));

    query<HTMLButtonElement>(root, '#save-linkml').click();

    await vi.waitFor(() => expect(downloads.length).toBe(1));
    expect(downloads[0]?.name).toBe('booking-flow.linkml.yaml');
    expect(await downloads[0]?.blob?.text()).toBe(linkmlText(sketch, 'booking-flow'));
  });

  it('names the downloads after the example when one replaces the opened file', async () => {
    open();
    choose(file('booking.skiss', 'Ship @Fleet\n    id*\n'));
    await vi.waitFor(() => expect(editorText()).toContain('Ship'));

    chooseExample(root, EXAMPLES[1]?.id ?? '');
    query<HTMLButtonElement>(root, '#save-skiss').click();

    await vi.waitFor(() => expect(downloads.length).toBe(1));
    expect(downloads[0]?.name).toBe('library.skiss');
  });

  it('names every download after the slug of the title', async () => {
    open().setSketch(SKETCH);
    typeTitle(root, 'Booking sketch');
    await vi.waitFor(() => expect(root.querySelector('#diagram svg')).not.toBeNull());

    query<HTMLButtonElement>(root, '#save-skiss').click();
    query<HTMLButtonElement>(root, '#save-linkml').click();
    query<HTMLButtonElement>(root, '#download-svg').click();

    await vi.waitFor(() => expect(downloads.length).toBe(3));
    expect(downloads.map((download) => download.name)).toEqual([
      'booking-sketch.skiss',
      'booking-sketch.linkml.yaml',
      'booking-sketch.svg',
    ]);
    // The PNG is named by the same function, which `tests/files.test.ts`
    // covers: rasterising one needs a canvas, which jsdom has not got.
  });

  it('asks before a file replaces a dirty sketch, and opens nothing when the visitor says no', async () => {
    open().setSketch(SKETCH);
    typeTitle(root, 'Droids');
    answer = false;

    choose(file('booking.skiss', 'Ship @Fleet\n    id*\n'));

    // Nothing was read: the sketch, the title and the panel are as they were.
    await vi.waitFor(() => expect(editorText()).toContain('Droid'));
    expect(editorText()).not.toContain('Ship');
    expect(titleOf(root)).toBe('Droids');
    expect(query(root, '#notice').textContent).toBe('');
  });

  it('asks before a dropped file replaces a dirty sketch, and opens it when the visitor says yes', async () => {
    open().setSketch(SKETCH);
    answer = true;

    drop(file('Booking flow.skiss', 'Ship @Fleet\n    id*\n'));

    await vi.waitFor(() => expect(editorText()).toContain('Ship'));
    expect(titleOf(root)).toBe('Booking flow');
  });

  it('replaces a sketch that is still the file it was opened from without asking', async () => {
    open();
    answer = false;
    choose(file('booking.skiss', 'Ship @Fleet\n    id*\n'));
    await vi.waitFor(() => expect(editorText()).toContain('Ship'));

    // Nothing was edited since, so the second file replaces the first although
    // the confirmation would have said no.
    choose(file('people.txt', 'Droid @Catalog\n    serial*\n'));

    await vi.waitFor(() => expect(editorText()).toContain('Droid'));
    expect(titleOf(root)).toBe('people');
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

/**
 * The title in the header, the blank option the select falls back to, and the
 * confirmation that stands between a sketch somebody has edited and whatever
 * would replace it (issue #9).
 */
describe('the title, the blank example and the confirmation', () => {
  let root: HTMLElement;
  let page: Page | undefined;
  let asked: string[];
  let answer: boolean;

  const EDITED = 'Droid @Catalog\n    serial*\n';

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    asked = [];
    answer = true;
    root = document.createElement('div');
    document.body.append(root);
    page = mount(root, {
      confirm: (question) => {
        asked.push(question);
        return answer;
      },
    });
  });

  afterEach(() => {
    page?.destroy();
    page = undefined;
    root.remove();
  });

  function editorText(): string {
    return query(root, '.cm-content').textContent ?? '';
  }

  it('says the title in the browser tab, and the page alone where there is none', () => {
    typeTitle(root, 'Booking flow');
    expect(document.title).toBe('Booking flow · Skiss playground');

    typeTitle(root, '');
    expect(document.title).toBe('Skiss playground');
  });

  it('takes a title of at most 120 characters', () => {
    expect(query<HTMLInputElement>(root, '#title').maxLength).toBe(120);
    expect(query<HTMLInputElement>(root, '#title').placeholder).toBe('Untitled sketch');

    // A title pasted past what the input itself would have stopped.
    typeTitle(root, 'x'.repeat(500));

    expect(titleOf(root)).toHaveLength(120);
  });

  it('puts the select on the blank option as soon as the text is edited', () => {
    expect(chosenExample(root)).toBe(EXAMPLES[0]?.id);

    page?.setSketch(EDITED);

    expect(chosenExample(root)).toBe('');
    expect(texts(root, '#example option')[0]).toBe('Load an example…');
  });

  it('puts the select on the blank option as soon as the title is edited', () => {
    typeTitle(root, 'My own catalogue');

    expect(chosenExample(root)).toBe('');
    // The text is untouched: it is the sketch that is no longer the example.
    expect(editorText()).toContain('Character');
  });

  it('fills both the title and the text when an example is loaded', () => {
    page?.setSketch(EDITED);
    const library = EXAMPLES[1];

    chooseExample(root, library?.id ?? '');

    expect(titleOf(root)).toBe(library?.name);
    expect(editorText()).toContain('Book');
    expect(chosenExample(root)).toBe(library?.id);
    expect(document.title).toBe(`${library?.name} · Skiss playground`);
  });

  it('replaces a clean sketch without asking', () => {
    chooseExample(root, EXAMPLES[1]?.id ?? '');

    expect(asked).toEqual([]);
    expect(editorText()).toContain('Book');
  });

  it('asks before an example replaces a dirty sketch, and replaces it on yes', () => {
    page?.setSketch(EDITED);
    typeTitle(root, 'Droids');
    answer = true;

    chooseExample(root, EXAMPLES[1]?.id ?? '');

    expect(asked).toEqual(['Replace "Droids"? Your current sketch will be gone from the editor.']);
    expect(editorText()).toContain('Book');
    expect(titleOf(root)).toBe(EXAMPLES[1]?.name);
  });

  it('leaves everything untouched when the visitor cancels', () => {
    page?.setSketch(EDITED);
    typeTitle(root, 'Droids');
    answer = false;

    chooseExample(root, EXAMPLES[1]?.id ?? '');

    expect(asked.length).toBe(1);
    expect(editorText()).toContain('Droid');
    expect(editorText()).not.toContain('Book');
    expect(titleOf(root)).toBe('Droids');
    // And the select says what the sketch is: the visitor's own, not Library.
    expect(chosenExample(root)).toBe('');
  });

  it('calls a sketch with no title by the name the input shows', () => {
    page?.setSketch(EDITED);
    typeTitle(root, '');
    answer = false;

    chooseExample(root, EXAMPLES[1]?.id ?? '');

    expect(asked[0]).toContain('"Untitled sketch"');
  });

  it('asks again for a sketch edited after an example was loaded, and not before', () => {
    chooseExample(root, EXAMPLES[1]?.id ?? '');
    expect(asked).toEqual([]);

    page?.setSketch(EDITED);
    chooseExample(root, EXAMPLES[2]?.id ?? '');

    expect(asked.length).toBe(1);
  });

  it('asks before an example replaces the draft of the last visit', () => {
    page?.destroy();
    localStorage.setItem('skiss-playground:draft', EDITED);
    localStorage.setItem('skiss-playground:draft-title', 'Droids');
    page = mount(root, {
      confirm: (question) => {
        asked.push(question);
        return false;
      },
    });

    chooseExample(root, EXAMPLES[1]?.id ?? '');

    expect(asked.length).toBe(1);
    expect(editorText()).toContain('Droid');
  });
});
