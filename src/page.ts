/**
 * The page: the editor on the left, the diagram on the right, and what the
 * compiler had to say between them. Every element is created here rather than
 * written into `index.html`, so a test can mount the page into a detached
 * element and put a sketch into it.
 *
 * This file is wiring and nothing else. What a sketch means is `preview.ts`,
 * what it looks like is `editor.ts` and `highlight.ts`, what it draws is
 * `diagram.ts`, what a link holds is `share.ts`, what leaves as a file is
 * `image.ts` and `download.ts`, and what survives a reload is `storage.ts`.
 */

import { VERSION } from '@eriknaslund/skiss';
import { createDiagram } from './diagram';
import { copyText, download } from './download';
import { createEditor } from './editor';
import { DEFAULT_EXAMPLE, EXAMPLES } from './examples';
import { linkmlText, mermaidText } from './exports';
import { noDiagram, PNG_FILENAME, pngBlob, SVG_FILENAME, svgBlob } from './image';
import {
  applyHighlight,
  HIGHLIGHT_OPTIONS,
  type HighlightColours,
  highlights,
  isHighlightColours,
} from './palette';
import { panZoom } from './panzoom';
import { type LineDiagnostic, preview } from './preview';
import { decodeSketch, encodedFromHash, encodeSketch, shareUrl } from './share';
import {
  browserStorage,
  DRAFT_DEBOUNCE_MS,
  readDraft,
  readHighlight,
  saveDraft,
  saveHighlight,
} from './storage';

const QUESTIONS_HEADING = 'Open questions';
const DIAGNOSTICS_HEADING = 'Diagnostics';
const COMPILE_FAILED = 'The sketch could not be compiled';

/** How long a confirmation stays on screen. */
const NOTICE_MS = 2000;

const LINK_COPIED = 'Link copied';
const MERMAID_COPIED = 'Mermaid copied';
const LINKML_COPIED = 'LinkML copied';
const COPY_FAILED = 'Nothing was copied';
const DOWNLOAD_FAILED = 'Nothing was downloaded';
const BAD_FRAGMENT = 'That link carried no sketch this page could read';
const HAS_ERROR = 'The sketch has an error to put right first';

/** The page as `main.ts` mounts it, and as a test writes a sketch into. */
export interface Page {
  /** Puts `text` in the editor, as choosing an example does. */
  setSketch(text: string): void;
  /**
   * Settles once the sketch a link carried is in the editor, or at once where
   * the visit carried no link. Decoding a fragment is asynchronous — inflating
   * it is — so this is what a test waits on rather than a timeout.
   */
  ready: Promise<void>;
  destroy(): void;
}

export function mount(root: HTMLElement): Page {
  root.replaceChildren();

  const storage = browserStorage();

  const title = document.createElement('h1');
  title.textContent = 'Skiss playground';

  const version = document.createElement('span');
  version.className = 'version';
  version.textContent = `@eriknaslund/skiss ${VERSION}`;
  title.append(' ', version);

  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = 'Write a sketch, watch the diagram. Nothing leaves your browser.';

  const examples = document.createElement('select');
  examples.id = 'example';
  for (const example of EXAMPLES) {
    const option = document.createElement('option');
    option.value = example.id;
    option.textContent = example.name;
    examples.append(option);
  }
  examples.value = DEFAULT_EXAMPLE.id;

  const highlight = document.createElement('select');
  highlight.id = 'highlight';
  for (const [value, label] of Object.entries(HIGHLIGHT_OPTIONS)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    highlight.append(option);
  }
  let colours = readHighlight(storage);
  highlight.value = colours;
  applyHighlight(document.body, colours);

  const chooser = document.createElement('div');
  chooser.className = 'chooser';
  chooser.append(
    fieldLabel(examples, 'Example'),
    examples,
    fieldLabel(highlight, 'Highlight colours'),
    highlight,
  );

  const shareButton = action('share', 'Share');
  const copyMermaid = action('copy-mermaid', 'Copy Mermaid');
  const copyLinkml = action('copy-linkml', 'Copy LinkML');
  const downloadSvg = action('download-svg', 'Download SVG');
  const downloadPng = action('download-png', 'Download PNG');

  /**
   * What the page says after a button was pressed. It is a live region rather
   * than a tooltip on the button: a confirmation nobody sees is no
   * confirmation, and a screen reader is told the same thing the sighted
   * visitor is.
   */
  const notice = document.createElement('p');
  notice.id = 'notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(shareButton, copyMermaid, copyLinkml, downloadSvg, downloadPng, notice);

  const header = document.createElement('header');
  header.append(title, tagline, chooser, actions);

  const editorHost = document.createElement('div');
  editorHost.id = 'editor';

  const diagnostics = document.createElement('ul');
  diagnostics.id = 'diagnostics';
  const diagnosticsPanel = listPanel('diagnostics-panel', DIAGNOSTICS_HEADING, diagnostics);

  const questions = document.createElement('ul');
  questions.id = 'questions';
  const questionsPanel = listPanel('questions-panel', QUESTIONS_HEADING, questions);

  const editorPane = document.createElement('section');
  editorPane.className = 'pane editor-pane';
  editorPane.append(heading('Sketch'), editorHost, diagnosticsPanel, questionsPanel);

  const fit = document.createElement('button');
  fit.id = 'fit';
  fit.type = 'button';
  fit.textContent = 'Fit';

  const diagramBar = document.createElement('div');
  diagramBar.className = 'bar';
  diagramBar.append(heading('Diagram'), fit);

  const diagramContent = document.createElement('div');
  diagramContent.id = 'diagram';

  const viewport = document.createElement('div');
  viewport.id = 'viewport';
  viewport.append(diagramContent);

  const diagramMessage = document.createElement('p');
  diagramMessage.id = 'diagram-message';
  diagramMessage.hidden = true;

  const diagramPane = document.createElement('section');
  diagramPane.className = 'pane diagram-pane';
  diagramPane.append(diagramBar, viewport, diagramMessage);

  const main = document.createElement('main');
  main.append(editorPane, diagramPane);

  root.append(header, main);

  const diagram = createDiagram(diagramContent, diagramMessage);
  const view = panZoom(viewport, diagramContent);

  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let draftTimer: ReturnType<typeof setTimeout> | undefined;

  /** A confirmation: it says what happened and takes itself away again. */
  function say(text: string): void {
    notice.textContent = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice.textContent = '';
    }, NOTICE_MS);
  }

  /**
   * What went wrong, in the browser's own words where it had any. It stays
   * until the next thing the page has to say: a visitor who pressed a button
   * and got nothing has to be able to read why, and two seconds is not long
   * enough for a sentence they did not expect.
   */
  function warn(text: string): void {
    notice.textContent = text;
    clearTimeout(noticeTimer);
    noticeTimer = undefined;
  }

  /**
   * The draft, a while after the last keystroke. Debounced because a keystroke
   * is cheap and a write to `localStorage` is not; the palette is written as
   * it is chosen, which happens once in a while rather than per character.
   */
  function keepDraft(text: string): void {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => saveDraft(storage, text), DRAFT_DEBOUNCE_MS);
  }

  /**
   * One compile per change: the gutter, the two lists and the diagram all show
   * the same one. Nothing here may throw — a page that dies on a keystroke has
   * nothing left to show — so a compiler that does is reported where the
   * diagnostics are.
   */
  function update(text: string, immediate: boolean): void {
    try {
      const shown = preview(text);
      editor.setDiagnostics(shown.diagnostics);
      fillDiagnostics(diagnostics, shown.diagnostics);
      show(diagnosticsPanel, shown.diagnostics.length > 0);
      fillLines(questions, shown.questions);
      show(questionsPanel, shown.questions.length > 0);
      // A sketch with an error in it compiles to a partial document, and a
      // partial document is not what anyone means to paste into a file.
      allowCopying(!shown.diagnostics.some((diagnostic) => diagnostic.severity === 'error'));
      if (immediate) {
        void diagram.drawNow(shown.mermaid);
      } else {
        diagram.draw(shown.mermaid);
      }
    } catch (error) {
      fillLines(diagnostics, [`${COMPILE_FAILED}: ${messageOf(error)}`]);
      show(diagnosticsPanel, true);
      allowCopying(false);
    }
  }

  function allowCopying(allowed: boolean): void {
    for (const button of [copyMermaid, copyLinkml]) {
      button.disabled = !allowed;
      if (allowed) {
        button.removeAttribute('title');
      } else {
        button.title = HAS_ERROR;
      }
    }
  }

  /**
   * The link, into the clipboard and into the address bar. The address bar
   * first: where the clipboard is refused — an old browser, a page served over
   * plain HTTP, a visitor who said no — the link is still there to be copied
   * by hand, which is the whole point of replacing it.
   */
  async function share(): Promise<void> {
    try {
      const url = shareUrl(window.location.href, await encodeSketch(editor.text()));
      window.history.replaceState(null, '', url);
      await copyText(url);
      say(LINK_COPIED);
    } catch (error) {
      warn(`${COPY_FAILED}: ${messageOf(error)}`);
    }
  }

  async function copy(text: () => string, confirmation: string): Promise<void> {
    try {
      await copyText(text());
      say(confirmation);
    } catch (error) {
      warn(`${COPY_FAILED}: ${messageOf(error)}`);
    }
  }

  /** The `<svg>` the pane is showing, or what to say when it is showing none. */
  function drawnSvg(): Element {
    const svg = diagram.svg();
    if (svg === undefined) {
      throw noDiagram();
    }
    return svg;
  }

  /**
   * A file, or a sentence saying why there is none. Rasterising can fail in
   * ways the page cannot foresee — a canvas the browser will not read back, a
   * browser with no canvas at all — and the browser's own message is more use
   * than ours, so it is what the notice carries.
   */
  async function saveFile(file: () => Promise<Blob>, filename: string): Promise<void> {
    try {
      download(await file(), filename);
    } catch (error) {
      warn(`${DOWNLOAD_FAILED}: ${messageOf(error)}`);
    }
  }

  const fragment = encodedFromHash(window.location.hash);
  /**
   * What the editor opens with. A link wins over everything, so a visit that
   * carries one does not read the draft at all; the editor starts empty and
   * the sketch arrives a moment later, rather than showing a sketch that is
   * about to be replaced.
   */
  const opening = fragment === undefined ? (readDraft(storage) ?? DEFAULT_EXAMPLE.source) : '';

  const editor = createEditor(editorHost, {
    doc: opening,
    highlighting: highlights(colours),
    onChange: (text) => {
      update(text, false);
      keepDraft(text);
    },
  });

  examples.addEventListener('change', () => {
    const chosen = EXAMPLES.find((example) => example.id === examples.value);
    if (chosen === undefined) {
      return;
    }
    // An example replaces the draft, through the same change listener every
    // other edit goes through.
    editor.setText(chosen.source);
    // A fresh sketch is a fresh diagram: the pan and the zoom of the last one
    // would leave it off screen.
    view.fit();
  });

  highlight.addEventListener('change', () => {
    if (!isHighlightColours(highlight.value)) {
      return;
    }
    colours = highlight.value;
    applyChoice(colours);
    saveHighlight(storage, colours);
  });

  function applyChoice(chosen: HighlightColours): void {
    applyHighlight(document.body, chosen);
    editor.setHighlighting(highlights(chosen));
  }

  fit.addEventListener('click', () => view.fit());
  shareButton.addEventListener('click', () => void share());
  copyMermaid.addEventListener(
    'click',
    () => void copy(() => mermaidText(editor.text()), MERMAID_COPIED),
  );
  copyLinkml.addEventListener(
    'click',
    () => void copy(() => linkmlText(editor.text()), LINKML_COPIED),
  );
  downloadSvg.addEventListener('click', () => {
    void saveFile(async () => svgBlob(drawnSvg()), SVG_FILENAME);
  });
  downloadPng.addEventListener('click', () => {
    void saveFile(() => pngBlob(drawnSvg()), PNG_FILENAME);
  });

  /**
   * The two shortcuts, on the window rather than in the editor's keymap: they
   * are the page's, and they work whether the cursor is in the sketch or the
   * visitor has just dragged the diagram. `editor.ts` takes Mod-Enter without
   * acting on it, so CodeMirror does not insert a line on the way here.
   */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) {
      return;
    }
    if (event.key.toLowerCase() === 's') {
      // Before anything else: this is the browser's save dialog.
      event.preventDefault();
      void share();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      update(editor.text(), true);
    }
  };
  window.addEventListener('keydown', onKeyDown);

  update(opening, true);

  /**
   * The sketch a link carried, put into the editor once it has inflated. A
   * fragment that decodes to nothing readable is ignored — it is as likely to
   * be a link a chat client truncated as anything else — and the page opens on
   * what a visit without one would have shown.
   */
  async function readFragment(encoded: string): Promise<void> {
    const text = await decodeSketch(encoded);
    if (text === undefined) {
      editor.setText(readDraft(storage) ?? DEFAULT_EXAMPLE.source);
      warn(BAD_FRAGMENT);
      return;
    }
    editor.setText(text);
  }

  return {
    setSketch: (text) => editor.setText(text),
    ready: fragment === undefined ? Promise.resolve() : readFragment(fragment),
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(noticeTimer);
      clearTimeout(draftTimer);
      applyHighlight(document.body, 'calm');
      editor.destroy();
      diagram.destroy();
      view.destroy();
    },
  };
}

function heading(text: string): HTMLElement {
  const element = document.createElement('h2');
  element.className = 'heading';
  element.textContent = text;
  return element;
}

/** The label of one of the header's selects, tied to it by id. */
function fieldLabel(field: HTMLElement, text: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.htmlFor = field.id;
  label.textContent = text;
  return label;
}

function action(id: string, text: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = id;
  button.type = 'button';
  button.textContent = text;
  return button;
}

/** A headed list, shown only while it has lines in it. */
function listPanel(className: string, text: string, list: HTMLElement): HTMLElement {
  const panel = document.createElement('section');
  panel.className = className;
  panel.hidden = true;
  panel.append(heading(text), list);
  return panel;
}

function show(panel: HTMLElement, visible: boolean): void {
  panel.hidden = !visible;
}

function fillDiagnostics(list: HTMLElement, diagnostics: readonly LineDiagnostic[]): void {
  list.replaceChildren(
    ...diagnostics.map((diagnostic) => {
      const item = document.createElement('li');
      // The severity is the colour of the bullet and the word a screen reader
      // reads; the text itself is the compiler's, unchanged.
      item.className = `diagnostic ${diagnostic.severity}`;
      item.textContent = diagnostic.text;
      return item;
    }),
  );
}

function fillLines(list: HTMLElement, lines: readonly string[]): void {
  list.replaceChildren(
    ...lines.map((line) => {
      const item = document.createElement('li');
      item.textContent = line;
      return item;
    }),
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
