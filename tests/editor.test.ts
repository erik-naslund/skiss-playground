import { describe, expect, it } from 'vitest';
import { gutterLines } from '../src/editor';
import type { LineDiagnostic } from '../src/preview';

function diagnostic(
  line: number,
  severity: LineDiagnostic['severity'],
  message: string,
): LineDiagnostic {
  return { line, severity, message, text: `line ${line}: ${message}` };
}

describe('the gutter markers', () => {
  it('mark the line of every diagnostic, in document order', () => {
    const markers = gutterLines(
      [diagnostic(7, 'error', 'unreadable'), diagnostic(2, 'warning', 'undeclared')],
      10,
    );

    expect(markers.map((marker) => marker.line)).toEqual([2, 7]);
  });

  it('tell an error and a warning apart', () => {
    const markers = gutterLines(
      [diagnostic(1, 'warning', 'undeclared'), diagnostic(2, 'error', 'unreadable')],
      10,
    );

    expect(markers.map((marker) => marker.severity)).toEqual(['warning', 'error']);
  });

  it('are one per line, an error line where the line carries both', () => {
    const markers = gutterLines(
      [diagnostic(3, 'warning', 'undeclared'), diagnostic(3, 'error', 'unreadable')],
      10,
    );

    expect(markers.length).toBe(1);
    expect(markers[0]?.severity).toBe('error');
    // The tooltip says both, one to a line.
    expect(markers[0]?.message).toBe('undeclared\nunreadable');
  });

  it('drop a diagnostic on a line the sketch no longer has', () => {
    expect(gutterLines([diagnostic(12, 'error', 'unreadable')], 4)).toEqual([]);
    expect(gutterLines([diagnostic(0, 'error', 'unreadable')], 4)).toEqual([]);
  });
});
