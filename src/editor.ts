/**
 * The editor: CodeMirror 6 with the sketch's own colours and the compiler's
 * diagnostics in a gutter beside the lines they belong to. The Obsidian
 * plugin's `src/editor.ts` is the model for both; what is Obsidian's there —
 * the fences, the settings, the themes' variables — is not here, because this
 * page is one document and owns its own palette.
 *
 * This file holds no language logic: what is coloured comes from
 * `highlight.ts`, what is marked comes from `preview.ts`, and both are plain
 * data by the time they arrive.
 */

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  Compartment,
  EditorSelection,
  EditorState,
  type Extension,
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from '@codemirror/state';
import {
  type Command,
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  gutter,
  keymap,
  lineNumbers,
  type PluginValue,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { highlightSpans } from './highlight';
import type { LineDiagnostic } from './preview';

/** What Tab inserts. Skiss only cares that a field line is indented, and four spaces is what the examples are written with. */
const INDENT = '    ';

/**
 * How long Tab moves the focus instead of indenting after Escape was pressed.
 * A keyboard user must be able to leave the editor, and Escape-then-Tab is
 * what CodeMirror offers for it.
 */
const TAB_FOCUS_MS = 3000;

/** The editor as the page holds it: text in, text out, diagnostics in. */
export interface Editor {
  text(): string;
  /** Replaces the whole document, as choosing an example does. */
  setText(text: string): void;
  setDiagnostics(diagnostics: readonly LineDiagnostic[]): void;
  /**
   * Colours the sketch, or stops colouring it. *Off* in the header takes the
   * extension out; the gutter and everything else stay where they are.
   */
  setHighlighting(on: boolean): void;
  focus(): void;
  destroy(): void;
}

/** One `Decoration` per class, so a redraw reuses them rather than allocating. */
const marks = new Map<string, Decoration>();

function markFor(className: string): Decoration {
  const existing = marks.get(className);
  if (existing !== undefined) {
    return existing;
  }
  const mark = Decoration.mark({ class: className });
  marks.set(className, mark);
  return mark;
}

/** The spans of the lines on screen, as a decoration set. */
function decorationsOf(view: EditorView): DecorationSet {
  const { doc } = view.state;
  // The viewport as line numbers, once, rather than per line of the document.
  const visible = view.visibleRanges.map((range) => ({
    first: doc.lineAt(range.from).number,
    last: doc.lineAt(range.to).number,
  }));
  const wanted = (line: number): boolean =>
    visible.some((range) => line >= range.first && line <= range.last);

  const builder = new RangeSetBuilder<Decoration>();
  for (const span of highlightSpans(doc.toString(), wanted)) {
    if (span.line > doc.lines) {
      continue;
    }
    const line = doc.line(span.line);
    builder.add(line.from + span.from, line.from + span.to, markFor(span.className));
  }
  return builder.finish();
}

class SkissHighlighter implements PluginValue {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = decorationsOf(view);
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = decorationsOf(update.view);
    }
  }
}

const highlighting = ViewPlugin.fromClass(SkissHighlighter, {
  decorations: (plugin) => plugin.decorations,
});

/** What the page hands the gutter after every compile. */
const setDiagnosticsEffect = StateEffect.define<readonly LineDiagnostic[]>();

/**
 * The diagnostics the gutter draws. They are held rather than derived: the
 * page compiles the sketch and dispatches the result, so the gutter, the list
 * and the diagram all show one compile rather than three.
 */
const diagnosticsField = StateField.define<readonly LineDiagnostic[]>({
  create: () => [],
  update: (diagnostics, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setDiagnosticsEffect)) {
        return effect.value;
      }
    }
    return diagnostics;
  },
});

class DiagnosticMarker extends GutterMarker {
  constructor(
    private readonly severity: LineDiagnostic['severity'],
    private readonly message: string,
  ) {
    super();
  }

  eq(other: GutterMarker): boolean {
    return (
      other instanceof DiagnosticMarker &&
      other.severity === this.severity &&
      other.message === this.message
    );
  }

  toDOM(): Node {
    const el = document.createElement('span');
    el.className = `skiss-gutter-marker skiss-gutter-${this.severity}`;
    el.title = this.message;
    // The bar is colour only, so what it says has to reach a screen reader too.
    el.setAttribute('aria-label', `${this.severity}: ${this.message}`);
    return el;
  }
}

/** What one line's marker says: the worse of the severities, and every message. */
export interface GutterLine {
  line: number;
  severity: LineDiagnostic['severity'];
  /** The messages of that line, one per line of the tooltip. */
  message: string;
}

/**
 * One marker per line, whatever the line carries: a line with an error and a
 * warning on it is an error line, and the tooltip lists both. Ascending by
 * line, because that is the order a gutter takes its markers in. A diagnostic
 * on a line the document no longer has is dropped rather than marked somewhere
 * it would mislead.
 */
export function gutterLines(diagnostics: readonly LineDiagnostic[], lines: number): GutterLine[] {
  const byLine = new Map<number, LineDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    if (diagnostic.line < 1 || diagnostic.line > lines) {
      continue;
    }
    const found = byLine.get(diagnostic.line);
    if (found === undefined) {
      byLine.set(diagnostic.line, [diagnostic]);
    } else {
      found.push(diagnostic);
    }
  }

  return [...byLine.entries()]
    .sort(([a], [b]) => a - b)
    .map(([line, onLine]) => ({
      line,
      severity: onLine.some((diagnostic) => diagnostic.severity === 'error')
        ? ('error' as const)
        : ('warning' as const),
      message: onLine.map((diagnostic) => diagnostic.message).join('\n'),
    }));
}

function gutterMarkers(view: EditorView): RangeSet<GutterMarker> {
  const { doc } = view.state;
  const markers = gutterLines(view.state.field(diagnosticsField), doc.lines).map((marker) =>
    new DiagnosticMarker(marker.severity, marker.message).range(doc.line(marker.line).from),
  );
  return RangeSet.of(markers);
}

/** Tab, as a sketch is indented: four spaces, and a selection replaced by them. */
const insertIndent: Command = (view) => {
  view.dispatch(
    view.state.changeByRange((range) => ({
      changes: { from: range.from, to: range.to, insert: INDENT },
      range: EditorSelection.cursor(range.from + INDENT.length),
    })),
    { scrollIntoView: true, userEvent: 'input' },
  );
  return true;
};

/**
 * Escape, so Tab is a way out of the editor for the next few seconds rather
 * than four more spaces. It returns false, so the default keymap's own Escape
 * runs after it.
 */
const escapeTabTrap: Command = (view) => {
  view.setTabFocusMode(TAB_FOCUS_MS);
  return false;
};

/**
 * The palette as an extension that can be swapped without rebuilding the
 * editor, which is what *Off* does: a compartment is CodeMirror's own way of
 * reconfiguring one part of a running editor, and it leaves the document, the
 * history and the cursor where they are.
 */
const palette = new Compartment();

function colouring(on: boolean): Extension {
  return on ? highlighting : [];
}

function extensions(onChange: (text: string) => void, highlight: boolean): Extension[] {
  return [
    lineNumbers(),
    history(),
    // Before the default keymap, which binds Tab to nothing, Escape to
    // simplifying the selection and Mod-Enter to a blank line.
    keymap.of([
      { key: 'Tab', run: insertIndent },
      { key: 'Escape', run: escapeTabTrap },
      // Taken, and nothing done with it: the page listens for Mod-Enter on the
      // window, so it forces a render from inside the editor as well as
      // outside it, and this is what keeps CodeMirror from inserting a line
      // under the cursor on the way there.
      { key: 'Mod-Enter', run: () => true },
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    palette.of(colouring(highlight)),
    diagnosticsField,
    gutter({ class: 'skiss-gutter', markers: gutterMarkers }),
    // A sketch line with a description on it is long, and the pane is
    // resizable: wrapping is what keeps the page from scrolling sideways.
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }),
    EditorView.contentAttributes.of({ 'aria-label': 'Sketch', spellcheck: 'false' }),
  ];
}

export function createEditor(
  parent: HTMLElement,
  options: { doc: string; onChange: (text: string) => void; highlighting: boolean },
): Editor {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: options.doc,
      extensions: extensions(options.onChange, options.highlighting),
    }),
  });

  return {
    text: () => view.state.doc.toString(),
    setText: (text) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: EditorSelection.cursor(0),
      });
    },
    setDiagnostics: (diagnostics) => {
      view.dispatch({ effects: setDiagnosticsEffect.of(diagnostics) });
    },
    setHighlighting: (on) => {
      view.dispatch({ effects: palette.reconfigure(colouring(on)) });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
