/**
 * The page: the editor on the left, the diagram on the right, and what the
 * compiler had to say between them. Every element is created here rather than
 * written into `index.html`, so a test can mount the page into a detached
 * element and put a sketch into it.
 *
 * This file is wiring and nothing else. What a sketch means is `preview.ts`,
 * what it looks like is `editor.ts` and `highlight.ts`, what it draws is
 * `diagram.ts`, what a link holds is `share.ts`, what a file holds and what
 * every download is called is `files.ts`, what leaves as a file is `image.ts`
 * and `download.ts`, what survives a reload is `storage.ts`, and what the
 * title means is `title.ts` and `sketch.ts`.
 */

import { VERSION } from '@eriknaslund/skiss';
import { createDiagram } from './diagram';
import { copyText, download } from './download';
import { createEditor } from './editor';
import { DEFAULT_EXAMPLE, EXAMPLES, exampleOf } from './examples';
import { linkmlText, mermaidText } from './exports';
import {
  ACCEPT,
  fileKind,
  importSketch,
  linkmlFilename,
  looksLikeLinkML,
  pngFilename,
  REFUSED,
  skissFilename,
  svgFilename,
  titleFromFilename,
} from './files';
import { noDiagram, pngBlob, svgBlob } from './image';
import {
  applyHighlight,
  HIGHLIGHT_OPTIONS,
  type HighlightColours,
  highlights,
  isHighlightColours,
} from './palette';
import { panZoom } from './panzoom';
import { type LineDiagnostic, preview } from './preview';
import { decodeSketch, encodedFromHash, encodeSketch, shareUrl, titleFromHash } from './share';
import { isDirty, replaceQuestion, type Sketch } from './sketch';
import {
  browserStorage,
  DRAFT_DEBOUNCE_MS,
  readDraft,
  readDraftTitle,
  readHighlight,
  saveDraft,
  saveDraftTitle,
  saveHighlight,
} from './storage';
import { clampTitle, documentTitle, MAX_TITLE_LENGTH, slugOf, UNTITLED } from './title';

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
const READ_FAILED = 'That file could not be read';

/** The select's first option: no example, and what a sketch of one's own sits on. */
const NO_EXAMPLE = 'Load an example…';

/** What the notice above the editor says about a file, and about pasted text. */
const IMPORTED = 'Imported as a sketch';
const NOT_IMPORTED = 'No LinkML schema could be read out of that';
const PASTE_OFFER = 'This looks like LinkML. Import it as a sketch?';

/** What marks the editor pane while a file is being dragged over it. */
const DROPPING_CLASS = 'dropping';

/** What the page needs from outside itself, which is one question. */
export interface PageOptions {
  /**
   * What asks before a dirty sketch is replaced. `window.confirm` in the page;
   * a test answers it without a human. It is the only dialog the page has —
   * no library, and nothing that has to be styled.
   */
  confirm?: (question: string) => boolean;
}

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

export function mount(root: HTMLElement, options: PageOptions = {}): Page {
  root.replaceChildren();

  const storage = browserStorage();
  const ask = options.confirm ?? ((question: string) => window.confirm(question));

  const banner = document.createElement('h1');
  banner.textContent = 'Skiss playground';

  const version = document.createElement('span');
  version.className = 'version';
  version.textContent = `@eriknaslund/skiss ${VERSION}`;
  banner.append(' ', version);

  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = 'Write a sketch, watch the diagram. Nothing leaves your browser.';

  /**
   * The title, which is the visitor's name for the sketch and nothing the
   * language knows about (issue #9). It is what the tab says, what every
   * download is called and what the schema is named.
   */
  const titleField = document.createElement('input');
  titleField.id = 'title';
  titleField.type = 'text';
  titleField.maxLength = MAX_TITLE_LENGTH;
  titleField.placeholder = UNTITLED;
  // A sketch's name is not an address or a name the browser has seen before.
  titleField.autocomplete = 'off';

  const examples = document.createElement('select');
  examples.id = 'example';
  // The state the select is in for as long as the sketch is the visitor's own
  // rather than one of the four: first, so it is what an empty page shows.
  const noExample = document.createElement('option');
  noExample.value = '';
  noExample.textContent = NO_EXAMPLE;
  examples.append(noExample);
  for (const example of EXAMPLES) {
    const option = document.createElement('option');
    option.value = example.id;
    option.textContent = example.name;
    examples.append(option);
  }

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
    fieldLabel(titleField, 'Title'),
    titleField,
    fieldLabel(examples, 'Example'),
    examples,
    fieldLabel(highlight, 'Highlight colours'),
    highlight,
  );

  const openButton = action('open', 'Open');
  const saveSkiss = action('save-skiss', 'Save .skiss');
  const saveLinkml = action('save-linkml', 'Save LinkML');
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

  /**
   * The file a visitor chooses, through the input the browser gives for it
   * rather than a drop target of our own: *Open* presses it, so the page is one
   * button and the dialog is the platform's. It is hidden rather than left out —
   * the element is what reads the file.
   */
  const fileInput = document.createElement('input');
  fileInput.id = 'file';
  fileInput.type = 'file';
  fileInput.accept = ACCEPT;
  fileInput.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(
    openButton,
    saveSkiss,
    saveLinkml,
    shareButton,
    copyMermaid,
    copyLinkml,
    downloadSvg,
    downloadPng,
    fileInput,
    notice,
  );

  const header = document.createElement('header');
  header.append(banner, tagline, chooser, actions);

  const editorHost = document.createElement('div');
  editorHost.id = 'editor';

  /**
   * What a file brought with it: the sentence of what happened, the projection's
   * own report of what it could not carry, and — for text that looks like a
   * schema somebody pasted — the button that imports it. It sits above the
   * editor because the editor is what it is about, and stays until the next
   * edit rather than for two seconds: a list of what a schema lost is not read
   * that fast.
   */
  const fileMessage = document.createElement('p');
  fileMessage.id = 'file-message';

  const fileReport = document.createElement('ul');
  fileReport.id = 'file-report';

  const importButton = action('import-linkml', 'Import as a sketch');

  const filePanel = document.createElement('section');
  filePanel.className = 'file-panel';
  filePanel.hidden = true;
  filePanel.setAttribute('role', 'status');
  filePanel.setAttribute('aria-live', 'polite');
  filePanel.append(fileMessage, fileReport, importButton);

  const diagnostics = document.createElement('ul');
  diagnostics.id = 'diagnostics';
  const diagnosticsPanel = listPanel('diagnostics-panel', DIAGNOSTICS_HEADING, diagnostics);

  const questions = document.createElement('ul');
  questions.id = 'questions';
  const questionsPanel = listPanel('questions-panel', QUESTIONS_HEADING, questions);

  const editorPane = document.createElement('section');
  editorPane.className = 'pane editor-pane';
  editorPane.append(heading('Sketch'), filePanel, editorHost, diagnosticsPanel, questionsPanel);

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

  /**
   * The sketch as it was last loaded from an example, a file or a link. What
   * is on screen differing from it is what *dirty* means, and what a
   * confirmation stands in front of.
   */
  let loaded: Sketch = { title: '', text: '' };

  /** Whether the change the editor is about to report is the page's own. */
  let ownEdit = false;

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
   * The draft — the sketch and its title — a while after the last keystroke.
   * Debounced because a keystroke is cheap and a write to `localStorage` is
   * not; the palette is written as it is chosen, which happens once in a while
   * rather than per character.
   */
  function keepDraft(): void {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      saveDraft(storage, editor.text());
      saveDraftTitle(storage, titleField.value);
    }, DRAFT_DEBOUNCE_MS);
  }

  /** The sketch as it stands: what the header says it is called and what the editor holds. */
  function current(): Sketch {
    return { title: titleField.value, text: editor.text() };
  }

  /**
   * The title, in the header and in the browser's own tab. Everything that
   * follows from it — the tab, the select's state — follows from here, so
   * there is one way for the title to change.
   */
  function setTitle(text: string): void {
    titleField.value = clampTitle(text);
    document.title = documentTitle(titleField.value);
    showExample();
  }

  /**
   * The select follows the sketch rather than the last thing that was chosen:
   * the example while the sketch still is exactly that example, title and all,
   * and the blank option from the first keystroke that makes it something
   * else.
   */
  function showExample(): void {
    examples.value = exampleOf(titleField.value, editor.text())?.id ?? '';
  }

  /**
   * Whether something may replace what is in the editor. A sketch that still
   * is what was loaded goes without a word; the visitor's own work is replaced
   * only if they say so, because the editor is the only place it exists.
   */
  function mayReplace(): boolean {
    return !isDirty(current(), loaded) || ask(replaceQuestion(titleField.value));
  }

  /** A sketch the page itself loaded: it is on screen, and it is what dirty is measured against. */
  function loadSketch(sketch: Sketch): void {
    setTitle(sketch.title);
    editor.setText(sketch.text);
    loaded = { title: titleField.value, text: sketch.text };
    // A fresh sketch is a fresh diagram: the pan and the zoom of the last one
    // would leave it off screen.
    view.fit();
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
      allowExports(!shown.diagnostics.some((diagnostic) => diagnostic.severity === 'error'));
      if (immediate) {
        void diagram.drawNow(shown.mermaid);
      } else {
        diagram.draw(shown.mermaid);
      }
    } catch (error) {
      fillLines(diagnostics, [`${COMPILE_FAILED}: ${messageOf(error)}`]);
      show(diagnosticsPanel, true);
      allowExports(false);
    }
  }

  /**
   * The three ways the compiled schema and diagram leave the page. *Save
   * .skiss* is not one of them: the sketch itself is the visitor's own text,
   * error or no error, and a file of it is how they come back to put it right.
   */
  function allowExports(allowed: boolean): void {
    for (const button of [copyMermaid, copyLinkml, saveLinkml]) {
      button.disabled = !allowed;
      if (allowed) {
        button.removeAttribute('title');
      } else {
        button.title = HAS_ERROR;
      }
    }
  }

  /**
   * What the panel above the editor says: a sentence, the projection's report
   * line by line, and the offer's button where there is something to press.
   * Everything empty is the panel gone, rather than an empty box above the
   * sketch.
   */
  function tell(message: string, report: readonly string[], offer: boolean): void {
    fileMessage.textContent = message;
    fileMessage.hidden = message === '';
    fillLines(fileReport, report);
    fileReport.hidden = report.length === 0;
    importButton.hidden = !offer;
    filePanel.hidden = message === '' && report.length === 0;
  }

  function sayNothingAboutFiles(): void {
    tell('', [], false);
  }

  /**
   * The sketch the page itself put in the editor — out of a file, or out of a
   * schema it imported. The report of how it got there survives this change and
   * is taken away by the next one, which is the visitor's own edit.
   */
  function fromFile(text: string): void {
    ownEdit = true;
    editor.setText(text);
    // Text identical to what is already there is no change and fires no
    // listener, which would otherwise leave the flag set for a real edit.
    ownEdit = false;
    // A fresh sketch is a fresh diagram, as choosing an example is.
    view.fit();
  }

  /**
   * A file the visitor chose or dropped. What it is read as is its extension and
   * nothing else, and a file of any other kind is refused by name rather than
   * guessed at. Nothing is uploaded: the bytes are read by the browser itself
   * (AGENTS.md §2).
   */
  async function openFile(file: File): Promise<void> {
    const kind = fileKind(file.name);
    if (kind === undefined) {
      tell(REFUSED, [], false);
      return;
    }
    // Asked before the file is read, and after it is clear the page can read
    // it at all: a refusal replaces nothing, so it is nothing to ask about.
    if (!mayReplace()) {
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch (error) {
      tell(`${READ_FAILED}: ${messageOf(error)}`, [], false);
      return;
    }
    if (kind === 'sketch') {
      sayNothingAboutFiles();
      fromFile(text);
      // The file's own name is the title, which is what it saves as again.
      setTitle(titleFromFilename(file.name));
      loaded = current();
      say(`${file.name} opened`);
      return;
    }
    importText(text, file.name);
  }

  /**
   * A LinkML schema as a sketch: the package projects it, and what the
   * projection could not carry is above the editor until the next edit. A file
   * no schema could be read out of leaves the editor as it was — the visitor
   * still has whatever they were writing — and says so.
   */
  function importText(text: string, name: string | undefined): void {
    const imported = importSketch(text);
    if (imported.source === undefined) {
      tell(NOT_IMPORTED, imported.report, false);
      return;
    }
    tell(IMPORTED, imported.report, false);
    fromFile(imported.source);
    if (name !== undefined) {
      setTitle(titleFromFilename(name));
      loaded = current();
    }
    // Text the visitor pasted and imported is their own work, not something
    // loaded: it keeps whatever title it had, and stays dirty.
  }

  /**
   * Text as a file, through the same anchor the pictures go through. Generating
   * the LinkML can throw where the sketch is one the compiler cannot read, so
   * the text is produced in here and a failure is a sentence rather than a
   * download that never starts.
   */
  function saveText(text: () => string, filename: string): void {
    try {
      // Both files are text; what the browser calls them is the `download`
      // attribute's business, not the type's.
      download(new Blob([text()], { type: 'text/plain;charset=utf-8' }), filename);
    } catch (error) {
      warn(`${DOWNLOAD_FAILED}: ${messageOf(error)}`);
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
      const url = shareUrl(
        window.location.href,
        await encodeSketch(editor.text()),
        titleField.value,
      );
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
   * What the page opens with. A link wins over everything, so a visit that
   * carries one does not read the draft at all; the editor starts empty and
   * the sketch arrives a moment later, rather than showing a sketch that is
   * about to be replaced.
   */
  const opening: Sketch = fragment === undefined ? withoutALink() : { title: '', text: '' };

  const editor = createEditor(editorHost, {
    doc: opening.text,
    highlighting: highlights(colours),
    onChange: (text) => {
      update(text, false);
      keepDraft();
      showExample();
      if (ownEdit) {
        // A sketch the page itself wrote: what it has to say about it is
        // already above the editor.
        return;
      }
      // The visitor's own edit takes the last file's report away, and is the
      // one chance to notice that what they pasted is a schema rather than a
      // sketch. Noticing is all it does: the import waits for the button.
      if (looksLikeLinkML(text)) {
        tell(PASTE_OFFER, [], true);
      } else {
        sayNothingAboutFiles();
      }
    },
  });

  examples.addEventListener('change', () => {
    const chosen = EXAMPLES.find((example) => example.id === examples.value);
    // The blank option loads nothing, and a sketch that was not replaced is
    // still what it was: either way the select goes back to saying so.
    if (chosen === undefined || !mayReplace()) {
      showExample();
      return;
    }
    // An example replaces the draft, through the same change listener every
    // other edit goes through.
    loadSketch({ title: chosen.name, text: chosen.source });
  });

  titleField.addEventListener('input', () => {
    setTitle(titleField.value);
    keepDraft();
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

  openButton.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    // Cleared so that opening the same file twice is a change the second time:
    // an input that still holds the file reports none.
    fileInput.value = '';
    if (file !== undefined) {
      void openFile(file);
    }
  });

  importButton.addEventListener('click', () => importText(editor.text(), undefined));

  saveSkiss.addEventListener('click', () => {
    saveText(() => editor.text(), skissFilename(titleField.value));
  });
  saveLinkml.addEventListener('click', () => {
    saveText(
      () => linkmlText(editor.text(), slugOf(titleField.value)),
      linkmlFilename(titleField.value),
    );
  });

  fit.addEventListener('click', () => view.fit());
  shareButton.addEventListener('click', () => void share());
  copyMermaid.addEventListener(
    'click',
    () => void copy(() => mermaidText(editor.text()), MERMAID_COPIED),
  );
  copyLinkml.addEventListener(
    'click',
    () => void copy(() => linkmlText(editor.text(), slugOf(titleField.value)), LINKML_COPIED),
  );
  downloadSvg.addEventListener('click', () => {
    void saveFile(async () => svgBlob(drawnSvg()), svgFilename(titleField.value));
  });
  downloadPng.addEventListener('click', () => {
    void saveFile(() => pngBlob(drawnSvg()), pngFilename(titleField.value));
  });

  /**
   * A file dragged onto the sketch. The pane rather than the editor itself, so a
   * drop anywhere near the sketch counts, and in the capture phase so a file
   * never reaches CodeMirror, which would try to read it as text. A drag that
   * carries no file is left alone entirely: dragging text about inside the
   * editor is CodeMirror's own, and none of it is ours to cancel.
   */
  const onDragOver = (event: DragEvent): void => {
    if (!carriesFile(event)) {
      return;
    }
    // Without this the browser opens the file instead of handing it over.
    event.preventDefault();
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = 'copy';
    }
    editorPane.classList.add(DROPPING_CLASS);
  };

  const onDragLeave = (event: DragEvent): void => {
    // A drag moving between the pane's own children leaves it as it is; only
    // one that has left the pane altogether takes the mark off.
    if (event.relatedTarget instanceof Node && editorPane.contains(event.relatedTarget)) {
      return;
    }
    editorPane.classList.remove(DROPPING_CLASS);
  };

  const onDrop = (event: DragEvent): void => {
    const file = event.dataTransfer?.files?.[0];
    if (file === undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    editorPane.classList.remove(DROPPING_CLASS);
    void openFile(file);
  };

  editorPane.addEventListener('dragover', onDragOver);
  editorPane.addEventListener('dragleave', onDragLeave);
  editorPane.addEventListener('drop', onDrop, true);

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

  setTitle(opening.title);
  loaded = baselineOf(opening);
  update(opening.text, true);

  /**
   * The sketch a link carried, put into the editor once it has inflated. A
   * fragment that decodes to nothing readable is ignored — it is as likely to
   * be a link a chat client truncated as anything else — and the page opens on
   * what a visit without one would have shown.
   */
  async function readFragment(encoded: string): Promise<void> {
    const text = await decodeSketch(encoded);
    if (text === undefined) {
      const fallback = withoutALink();
      loadSketch(fallback);
      // A draft that came back because the link could not be read is the
      // visitor's own, exactly as it is on a visit that carried no link.
      loaded = baselineOf(fallback);
      warn(BAD_FRAGMENT);
      return;
    }
    // A link carries its title beside the sketch, and one written before the
    // title existed carries none: that sketch opens untitled.
    loadSketch({ title: clampTitle(titleFromHash(window.location.hash)), text });
  }

  /**
   * What a visit with no link to read opens with: the draft of the last visit,
   * title and all, or the first example on a first visit.
   */
  function withoutALink(): Sketch {
    const text = readDraft(storage);
    return text === undefined
      ? { title: DEFAULT_EXAMPLE.name, text: DEFAULT_EXAMPLE.source }
      : { title: clampTitle(readDraftTitle(storage)), text };
  }

  /**
   * What *dirty* is measured against for a sketch the page did not load itself.
   * A draft restored from the last visit is exactly one of the examples or it
   * is the visitor's own work, and the second is worth asking about before
   * something replaces it: no visit remembers what the one before it loaded.
   */
  function baselineOf(sketch: Sketch): Sketch {
    return exampleOf(sketch.title, sketch.text) === undefined ? { title: '', text: '' } : sketch;
  }

  return {
    setSketch: (text) => editor.setText(text),
    ready: fragment === undefined ? Promise.resolve() : readFragment(fragment),
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      document.title = documentTitle('');
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

/**
 * Whether a drag carries a file at all. `types` is all the browser will say
 * about a drag before it is dropped — the files themselves cannot be read until
 * then — and `Files` is the one entry that matters here.
 */
function carriesFile(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') === true;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
