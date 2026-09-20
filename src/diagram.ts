/**
 * The right-hand pane: the Mermaid the compiler generated, drawn by Mermaid
 * itself in the visitor's own browser.
 *
 * Mermaid is loaded on demand rather than imported at the top, so the page is
 * interactive before the largest dependency it has arrives, and so the parts
 * of this file that are a string — the configuration and the init directive —
 * can be tested without loading it.
 *
 * Nothing is fetched from anywhere: the package is bundled with the site and
 * `securityLevel: 'strict'` keeps the rendered SVG free of script (ADR-0001).
 */

import type { MermaidConfig } from 'mermaid';

/** The two Mermaid themes the page uses, one per colour scheme. */
export type DiagramTheme = 'default' | 'dark';

/** How long after the last edit the diagram is drawn again. */
export const DEBOUNCE_MS = 300;

/** What the pane says before the first diagram has been drawn. */
const PLACEHOLDER = 'Nothing to draw yet';
const RENDER_FAILED = 'The diagram could not be drawn';

/**
 * Prepended to every diagram, as the Obsidian plugin's `image.ts` prepends it
 * to what it exports.
 *
 * Mermaid writes its labels as HTML inside `<foreignObject>` by default. Off,
 * the labels are plain SVG `<text>`: the SVG stands on its own, which is what
 * a copy or a download of it will need (#3), and a drawing tool that does not
 * render `foreignObject` opens it correctly.
 *
 * Two keys, because a class diagram draws its labels through two of Mermaid's:
 * the class boxes read the root `htmlLabels` and the arrow labels read
 * `flowchart.htmlLabels`.
 *
 * A directive as well as `initialize`, because `render` resets the
 * configuration from the text it is given before it draws.
 */
export function mermaidInit(theme: DiagramTheme): string {
  return `%%{init: {"theme": "${theme}", "htmlLabels": false, "flowchart": {"htmlLabels": false}}}%%`;
}

/** What `mermaid.initialize` is given. `startOnLoad` is off: the page renders, nothing scans the document. */
export function mermaidConfig(theme: DiagramTheme): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme,
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    // Mermaid draws a diagram of its own into the page when a render fails.
    // The pane keeps the last good diagram instead and says what went wrong
    // under it, which is the promise of "never an empty pane".
    suppressErrorRendering: true,
  };
}

/** The theme a colour scheme asks for. */
export function themeFor(dark: boolean): DiagramTheme {
  return dark ? 'dark' : 'default';
}

/** The pane as the page holds it. */
export interface Diagram {
  /** Draws `mermaidText`, a while after the last call. */
  draw(mermaidText: string): void;
  /** Draws it now. The tests and the theme switch use this; typing uses `draw`. */
  drawNow(mermaidText: string): Promise<void>;
  destroy(): void;
}

// Mermaid keys the SVG it renders by id and collides when two renders share
// one, so every render counts its own.
let rendered = 0;

/**
 * Renders into `content` and puts anything Mermaid had to say in `message`.
 * The last good diagram stays on screen when a render fails, so a half-typed
 * line never blanks the pane.
 */
export function createDiagram(content: HTMLElement, message: HTMLElement): Diagram {
  content.textContent = PLACEHOLDER;
  content.classList.add('placeholder');
  message.hidden = true;

  let timer: ReturnType<typeof setTimeout> | undefined;
  // Renders are awaited; this counter is what lets a slow one that was
  // overtaken drop its result instead of painting it over a newer one.
  let latest = 0;
  let destroyed = false;
  let theme = themeFor(prefersDark());
  // The last text the page asked for, which is what a change of colour scheme
  // draws again.
  let current = '';

  async function drawNow(mermaidText: string): Promise<void> {
    current = mermaidText;
    const attempt = ++latest;
    try {
      const svg = await renderSvg(mermaidText, theme);
      if (destroyed || attempt !== latest) {
        return;
      }
      content.classList.remove('placeholder');
      content.replaceChildren(svg);
      message.hidden = true;
      message.textContent = '';
    } catch (error) {
      if (destroyed || attempt !== latest) {
        return;
      }
      // The last good diagram is left where it is; only the message changes.
      message.hidden = false;
      message.textContent = `${RENDER_FAILED}: ${messageOf(error)}`;
    }
  }

  function cancel(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  // The visitor's colour scheme is the diagram's too, and it can change while
  // the page is open.
  const scheme = colourScheme();
  const onScheme = (event: MediaQueryListEvent): void => {
    theme = themeFor(event.matches);
    void drawNow(current);
  };
  scheme?.addEventListener('change', onScheme);

  return {
    draw: (mermaidText) => {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        void drawNow(mermaidText);
      }, DEBOUNCE_MS);
    },
    drawNow: async (mermaidText) => {
      cancel();
      await drawNow(mermaidText);
    },
    destroy: () => {
      destroyed = true;
      cancel();
      scheme?.removeEventListener('change', onScheme);
    },
  };
}

/** The `<svg>` Mermaid draws for one text, attached to nothing. */
async function renderSvg(mermaidText: string, theme: DiagramTheme): Promise<Element> {
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize(mermaidConfig(theme));
  rendered += 1;
  const { svg } = await mermaid.render(
    `skiss-diagram-${rendered}`,
    `${mermaidInit(theme)}\n${mermaidText}`,
  );
  return parseSvg(svg);
}

/**
 * Mermaid hands back markup; this is it as a node, parsed rather than
 * assigned, so nothing in it is executed on the way in. It is parsed as HTML,
 * which is the parser `innerHTML` would have used: the markup was serialised
 * from an HTML document and may carry entities a strict XML parse would
 * reject. A document whose first element is not an `<svg>` is a failed
 * diagram like any other.
 */
function parseSvg(svg: string): Element {
  const root = new DOMParser().parseFromString(svg, 'text/html').body.firstElementChild;
  if (root === null || root.tagName.toLowerCase() !== 'svg') {
    throw new Error('Mermaid returned an SVG that could not be read');
  }
  return root;
}

function colourScheme(): MediaQueryList | undefined {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : undefined;
}

function prefersDark(): boolean {
  return colourScheme()?.matches === true;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
