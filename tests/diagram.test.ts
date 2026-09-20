import { describe, expect, it } from 'vitest';
import { DEBOUNCE_MS, mermaidConfig, mermaidInit, themeFor } from '../src/diagram';

describe('the Mermaid init string', () => {
  it('turns the HTML labels off at the root and under flowchart, in the light theme', () => {
    expect(mermaidInit('default')).toBe(
      '%%{init: {"theme": "default", "htmlLabels": false, "flowchart": {"htmlLabels": false}}}%%',
    );
  });

  it('asks for the dark theme in the dark', () => {
    expect(mermaidInit('dark')).toBe(
      '%%{init: {"theme": "dark", "htmlLabels": false, "flowchart": {"htmlLabels": false}}}%%',
    );
  });

  it('follows the colour scheme', () => {
    expect(themeFor(false)).toBe('default');
    expect(themeFor(true)).toBe('dark');
  });
});

describe('the Mermaid configuration', () => {
  it('starts nothing on load and renders nothing it was not given', () => {
    expect(mermaidConfig('default')).toEqual({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'default',
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      suppressErrorRendering: true,
    });
  });

  it('carries the dark theme through', () => {
    expect(mermaidConfig('dark').theme).toBe('dark');
  });
});

describe('the debounce', () => {
  it('draws within the half second the issue asks for', () => {
    expect(DEBOUNCE_MS).toBe(300);
    expect(DEBOUNCE_MS).toBeLessThan(500);
  });
});
