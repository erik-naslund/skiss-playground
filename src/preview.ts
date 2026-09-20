/**
 * What the page shows for a sketch: the Mermaid the compiler generates, the
 * diagnostics of both passes on the lines they belong to, and the open
 * questions the sketch carries. A function from text to data, so the pipeline
 * can be tested without a DOM, and the wiring in `page.ts` is left with
 * nothing but elements.
 */

import {
  type ClassNode,
  type Diagnostic,
  parse,
  resolve,
  type Severity,
  toMermaid,
} from '@eriknaslund/skiss';

/** A diagnostic as the gutter and the list below the editor need it. */
export interface LineDiagnostic {
  /** The sketch's own line, 1-based, as the compiler counts it. */
  line: number;
  severity: Severity;
  /** The compiler's own wording, which the gutter marker shows on hover. */
  message: string;
  /** The line of the list: `line N: message`. */
  text: string;
}

export interface Preview {
  /** The Mermaid class diagram source. Never empty: a sketch with nothing in it still yields a header line. */
  mermaid: string;
  /** Every diagnostic of both passes, errors first. */
  diagnostics: LineDiagnostic[];
  /** The `?` doubts of the sketch, in source order, each prefixed with what carries it. */
  questions: string[];
}

export function preview(source: string): Preview {
  // `resolve` copies the parse diagnostics into its own list and appends what
  // it finds, so one list carries both passes. Neither ever throws: bad input
  // is diagnostics and a partial document.
  const resolved = resolve(parse(source));
  return {
    mermaid: toMermaid(resolved),
    diagnostics: lineDiagnostics(resolved.diagnostics),
    questions: questionsOf(resolved.classes),
  };
}

/**
 * The diagnostics in the order the list shows them: every error, then every
 * warning, each group in the order the compiler reported it. An error is what
 * stops the sketch from meaning what it says, so it is never below a warning
 * in a list a reader skims.
 */
export function lineDiagnostics(diagnostics: readonly Diagnostic[]): LineDiagnostic[] {
  const shown = diagnostics.map(
    (diagnostic): LineDiagnostic => ({
      line: diagnostic.line,
      severity: diagnostic.severity,
      message: diagnostic.message,
      text: `line ${diagnostic.line}: ${diagnostic.message}`,
    }),
  );
  return [
    ...shown.filter((diagnostic) => diagnostic.severity === 'error'),
    ...shown.filter((diagnostic) => diagnostic.severity !== 'error'),
  ];
}

/**
 * The `?` doubts of a document, in source order, each prefixed with what
 * carries it and separated by a colon, as the Obsidian plugin lists them under
 * the same heading.
 */
function questionsOf(classes: readonly ClassNode[]): string[] {
  const questions: string[] = [];
  for (const classNode of classes) {
    if (classNode.note !== undefined) {
      questions.push(`${classNode.name.text}: ${classNode.note}`);
    }
    for (const field of classNode.fields) {
      if (field.note !== undefined) {
        questions.push(`${classNode.name.text}.${field.name.text}: ${field.note}`);
      }
    }
  }
  return questions;
}
