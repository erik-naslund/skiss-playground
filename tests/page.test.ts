// @vitest-environment jsdom

import { VERSION } from '@eriknaslund/skiss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { mount, type Page } from '../src/page';

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
    render: (_id: string, text: string) =>
      Promise.resolve({ svg: `<svg><text>${text}</text></svg>` }),
  },
}));

function query<E extends Element>(root: ParentNode, selector: string): E {
  const found = root.querySelector<E>(selector);
  if (found === null) {
    throw new Error(`the page has no ${selector}`);
  }
  return found;
}

function texts(root: ParentNode, selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((element) => element.textContent ?? '');
}

describe('the page', () => {
  let root: HTMLElement;
  let page: Page;

  beforeEach(() => {
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
