import { describe, expect, it } from 'vitest';
import { DEFAULT_EXAMPLE, EXAMPLES, exampleOf } from '../src/examples';
import { isDirty, replaceQuestion, type Sketch } from '../src/sketch';

const LOADED: Sketch = { title: 'Booking flow', text: 'Booking @Reservations\n    id*\n' };

describe('whether a sketch has been edited since it was loaded', () => {
  it('is clean while it is what was loaded from an example, a file or a link', () => {
    expect(isDirty({ ...LOADED }, LOADED)).toBe(false);
    expect(isDirty({ title: '', text: '' }, { title: '', text: '' })).toBe(false);
  });

  it('is dirty once the text differs', () => {
    expect(isDirty({ ...LOADED, text: `${LOADED.text}    seat\n` }, LOADED)).toBe(true);
    // A single space, which is still the visitor's own work.
    expect(isDirty({ ...LOADED, text: `${LOADED.text} ` }, LOADED)).toBe(true);
  });

  it('is dirty once the title differs, whatever the text says', () => {
    expect(isDirty({ ...LOADED, title: 'Booking flow v2' }, LOADED)).toBe(true);
    expect(isDirty({ ...LOADED, title: '' }, LOADED)).toBe(true);
  });
});

describe('what the visitor is asked before a sketch is replaced', () => {
  it('names the sketch and says where it goes from', () => {
    expect(replaceQuestion('Booking flow')).toBe(
      'Replace "Booking flow"? Your current sketch will be gone from the editor.',
    );
  });

  it('calls an untitled sketch by the name the input shows', () => {
    expect(replaceQuestion('')).toContain('"Untitled sketch"');
    expect(replaceQuestion('   ')).toContain('"Untitled sketch"');
  });
});

describe('the example a sketch is exactly', () => {
  it('is the example while both its name and its text are untouched', () => {
    expect(exampleOf(DEFAULT_EXAMPLE.name, DEFAULT_EXAMPLE.source)).toBe(DEFAULT_EXAMPLE);
    for (const example of EXAMPLES) {
      expect(exampleOf(example.name, example.source), example.id).toBe(example);
    }
  });

  it('is none once the text or the title has been edited', () => {
    expect(exampleOf(DEFAULT_EXAMPLE.name, `${DEFAULT_EXAMPLE.source}    age\n`)).toBeUndefined();
    expect(exampleOf('My catalogue', DEFAULT_EXAMPLE.source)).toBeUndefined();
    expect(exampleOf('', '')).toBeUndefined();
  });
});
