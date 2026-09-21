import { describe, expect, it } from 'vitest';
import {
  readDraft,
  readDraftTitle,
  readHighlight,
  saveDraft,
  saveDraftTitle,
  saveHighlight,
} from '../src/storage';

/** A `Storage` holding whatever a test puts in it, and nothing else. */
function fakeStorage(entries: Record<string, string> = {}): Storage {
  const held = new Map(Object.entries(entries));
  return {
    get length() {
      return held.size;
    },
    clear: () => held.clear(),
    getItem: (key) => held.get(key) ?? null,
    key: (index) => [...held.keys()][index] ?? null,
    removeItem: (key) => void held.delete(key),
    setItem: (key, value) => void held.set(key, value),
  };
}

/**
 * What a browser that refuses storage leaves the page with: a full quota, a
 * private window, or an owner who has blocked it.
 */
function blockedStorage(): Storage {
  const refuse = (): never => {
    throw new DOMException('the quota has been exceeded', 'QuotaExceededError');
  };
  return { ...fakeStorage(), getItem: refuse, setItem: refuse };
}

describe('the draft between visits', () => {
  it('reads back the sketch that was saved', () => {
    const storage = fakeStorage();
    const sketch = 'Character @Catalog\n    id*\n';

    saveDraft(storage, sketch);

    expect(readDraft(storage)).toBe(sketch);
  });

  it('has no draft to restore on a first visit', () => {
    expect(readDraft(fakeStorage())).toBeUndefined();
  });

  it('leaves the page working where storage is blocked', () => {
    expect(readDraft(blockedStorage())).toBeUndefined();
    expect(readDraft(undefined)).toBeUndefined();
    expect(() => saveDraft(blockedStorage(), 'Planet\n')).not.toThrow();
    expect(() => saveDraft(undefined, 'Planet\n')).not.toThrow();
  });

  it('keeps the title of the draft beside its text', () => {
    const storage = fakeStorage();

    saveDraft(storage, 'Booking @Reservations\n    id*\n');
    saveDraftTitle(storage, 'Booking flow');

    expect(readDraft(storage)).toBe('Booking @Reservations\n    id*\n');
    expect(readDraftTitle(storage)).toBe('Booking flow');
  });

  it('restores a draft written before the title existed, with no title', () => {
    const storage = fakeStorage({ 'skiss-playground:draft': 'Planet\n    id*\n' });

    expect(readDraft(storage)).toBe('Planet\n    id*\n');
    expect(readDraftTitle(storage)).toBe('');
  });

  it('has no title, and throws nothing, where storage is blocked', () => {
    expect(readDraftTitle(blockedStorage())).toBe('');
    expect(readDraftTitle(undefined)).toBe('');
    expect(() => saveDraftTitle(blockedStorage(), 'Booking')).not.toThrow();
    expect(() => saveDraftTitle(undefined, 'Booking')).not.toThrow();
  });
});

describe('the palette between visits', () => {
  it('reads back the choice that was stored', () => {
    const storage = fakeStorage();

    saveHighlight(storage, 'vivid');
    expect(readHighlight(storage)).toBe('vivid');

    saveHighlight(storage, 'off');
    expect(readHighlight(storage)).toBe('off');
  });

  it('falls back to Calm for a stored value that is not a palette', () => {
    // A key from an older version, a value somebody typed into the console, or
    // a key another page on the same origin wrote.
    for (const stored of ['loud', '', 'CALM', '{"colours":"vivid"}']) {
      const storage = fakeStorage({ 'skiss-playground:highlight': stored });
      expect(readHighlight(storage), stored).toBe('calm');
    }
    expect(readHighlight(fakeStorage())).toBe('calm');
  });

  it('falls back to Calm, and throws nothing, where storage is blocked', () => {
    expect(readHighlight(blockedStorage())).toBe('calm');
    expect(readHighlight(undefined)).toBe('calm');
    expect(() => saveHighlight(blockedStorage(), 'vivid')).not.toThrow();
    expect(() => saveHighlight(undefined, 'vivid')).not.toThrow();
  });

  it('keeps the draft and the palette apart', () => {
    const storage = fakeStorage();

    saveDraft(storage, 'Planet\n    id*\n');
    saveHighlight(storage, 'off');

    expect(readDraft(storage)).toBe('Planet\n    id*\n');
    expect(readHighlight(storage)).toBe('off');
  });
});
