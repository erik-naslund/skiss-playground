import { describe, expect, it } from 'vitest';
import { clampTitle, documentTitle, MAX_TITLE_LENGTH, slugOf } from '../src/title';

describe('the slug every download and the schema are named after', () => {
  it('lowercases the title and puts a hyphen where a space was', () => {
    expect(slugOf('Booking sketch')).toBe('booking-sketch');
    expect(slugOf('Booking flow')).toBe('booking-flow');
    expect(slugOf('ALL CAPS')).toBe('all-caps');
  });

  it('collapses punctuation into single hyphens and trims the ends', () => {
    expect(slugOf('  Booking / payments  ')).toBe('booking-payments');
    expect(slugOf('Fleet, v2 (draft)')).toBe('fleet-v2-draft');
    expect(slugOf('--- Booking ---')).toBe('booking');
    expect(slugOf("Erik's sketch")).toBe('erik-s-sketch');
    // A hyphen the visitor typed is a hyphen, not two.
    expect(slugOf('star-wars catalogue')).toBe('star-wars-catalogue');
  });

  it('folds the accents of a title written in its own language', () => {
    expect(slugOf('Bokföring')).toBe('bokforing');
    expect(slugOf('Café Ångström')).toBe('cafe-angstrom');
    expect(slugOf('Übersicht')).toBe('ubersicht');
  });

  it('falls back to the sketch where a title leaves nothing to name a file with', () => {
    expect(slugOf('')).toBe('sketch');
    expect(slugOf('   ')).toBe('sketch');
    expect(slugOf('!!!')).toBe('sketch');
    // A title in a script that folds to nothing at all still names a file.
    expect(slugOf('日本語')).toBe('sketch');
    expect(slugOf('🛳')).toBe('sketch');
  });

  it('is never longer than the title the header takes', () => {
    const longest = clampTitle('a b'.repeat(200));

    expect(longest.length).toBe(MAX_TITLE_LENGTH);
    expect(slugOf(longest).length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
  });
});

describe('the title the header takes', () => {
  it('keeps a title of at most 120 characters as it was', () => {
    const title = 'Booking flow';

    expect(clampTitle(title)).toBe(title);
    expect(clampTitle('x'.repeat(MAX_TITLE_LENGTH))).toHaveLength(MAX_TITLE_LENGTH);
  });

  it('cuts a longer one down to 120', () => {
    expect(clampTitle('x'.repeat(500))).toHaveLength(120);
  });
});

describe('what the browser tab says', () => {
  it('names the sketch first, and the page after it', () => {
    expect(documentTitle('Booking')).toBe('Booking · Skiss playground');
    expect(documentTitle('  Booking  ')).toBe('Booking · Skiss playground');
  });

  it('is the page alone where the sketch has no title', () => {
    expect(documentTitle('')).toBe('Skiss playground');
    expect(documentTitle('   ')).toBe('Skiss playground');
  });
});
