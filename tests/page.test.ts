// @vitest-environment jsdom

import { VERSION } from '@eriknaslund/skiss';
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '../src/page';
import { SAMPLE } from '../src/sample';

function query<E extends Element>(root: ParentNode, selector: string): E {
  const found = root.querySelector<E>(selector);
  if (found === null) {
    throw new Error(`the page has no ${selector}`);
  }
  return found;
}

describe('the placeholder page', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    mount(root);
  });

  it('names the package version in the header', () => {
    expect(query(root, 'h1').textContent).toContain('Skiss playground');
    expect(query(root, '.version').textContent).toContain(VERSION);
    expect(query(root, '.tagline').textContent).toBe(
      'Write a sketch, see the diagram, share a link. Work in progress.',
    );
  });

  it('opens with the sample sketch, its Mermaid and its diagnostics', () => {
    expect(query<HTMLTextAreaElement>(root, '#sketch').value).toBe(SAMPLE);
    expect(query(root, '#mermaid').textContent).toContain('class Character');
    expect(query(root, '#diagnostics').textContent).toBe('No diagnostics.');
  });

  it('updates both panels as the textarea changes', () => {
    const sketch = query<HTMLTextAreaElement>(root, '#sketch');

    sketch.value = 'Ship\n  id*\n  home: Port\n';
    sketch.dispatchEvent(new Event('input'));

    const mermaid = query(root, '#mermaid').textContent ?? '';
    expect(mermaid).toContain('class Ship');
    expect(mermaid).not.toContain('class Character');
    expect(query(root, '#diagnostics').textContent).toContain('W_UNDECLARED_CLASS');
  });

  it('shows something for a sketch the compiler cannot read', () => {
    const sketch = query<HTMLTextAreaElement>(root, '#sketch');

    sketch.value = '???\n';
    sketch.dispatchEvent(new Event('input'));

    expect(query(root, '#mermaid').textContent).toContain('classDiagram');
    expect(query(root, '#diagnostics').textContent).toContain('error');
  });
});
