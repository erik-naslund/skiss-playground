/**
 * The page: the editor on the left, the diagram on the right, and what the
 * compiler had to say between them. Every element is created here rather than
 * written into `index.html`, so a test can mount the page into a detached
 * element and put a sketch into it.
 *
 * This file is wiring and nothing else. What a sketch means is `preview.ts`,
 * what it looks like is `editor.ts` and `highlight.ts`, and what it draws is
 * `diagram.ts`.
 */

import { VERSION } from '@eriknaslund/skiss';
import { createDiagram } from './diagram';
import { createEditor } from './editor';
import { DEFAULT_EXAMPLE, EXAMPLES } from './examples';
import { panZoom } from './panzoom';
import { type LineDiagnostic, preview } from './preview';

const QUESTIONS_HEADING = 'Open questions';
const DIAGNOSTICS_HEADING = 'Diagnostics';
const COMPILE_FAILED = 'The sketch could not be compiled';

/** The page as `main.ts` mounts it, and as a test writes a sketch into. */
export interface Page {
  /** Puts `text` in the editor, as choosing an example does. */
  setSketch(text: string): void;
  destroy(): void;
}

export function mount(root: HTMLElement): Page {
  root.replaceChildren();

  const title = document.createElement('h1');
  title.textContent = 'Skiss playground';

  const version = document.createElement('span');
  version.className = 'version';
  version.textContent = `@eriknaslund/skiss ${VERSION}`;
  title.append(' ', version);

  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = 'Write a sketch, watch the diagram. Nothing leaves your browser.';

  const exampleLabel = document.createElement('label');
  exampleLabel.htmlFor = 'example';
  exampleLabel.textContent = 'Example';

  const examples = document.createElement('select');
  examples.id = 'example';
  for (const example of EXAMPLES) {
    const option = document.createElement('option');
    option.value = example.id;
    option.textContent = example.name;
    examples.append(option);
  }
  examples.value = DEFAULT_EXAMPLE.id;

  const chooser = document.createElement('div');
  chooser.className = 'chooser';
  chooser.append(exampleLabel, examples);

  const header = document.createElement('header');
  header.append(title, tagline, chooser);

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
      if (immediate) {
        void diagram.drawNow(shown.mermaid);
      } else {
        diagram.draw(shown.mermaid);
      }
    } catch (error) {
      fillLines(diagnostics, [`${COMPILE_FAILED}: ${messageOf(error)}`]);
      show(diagnosticsPanel, true);
    }
  }

  const editor = createEditor(editorHost, {
    doc: DEFAULT_EXAMPLE.source,
    onChange: (text) => update(text, false),
  });

  examples.addEventListener('change', () => {
    const chosen = EXAMPLES.find((example) => example.id === examples.value);
    if (chosen === undefined) {
      return;
    }
    editor.setText(chosen.source);
    // A fresh sketch is a fresh diagram: the pan and the zoom of the last one
    // would leave it off screen.
    view.fit();
  });

  fit.addEventListener('click', () => view.fit());

  update(DEFAULT_EXAMPLE.source, true);

  return {
    setSketch: (text) => editor.setText(text),
    destroy: () => {
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
