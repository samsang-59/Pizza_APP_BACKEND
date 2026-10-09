import { describe, expect, it } from 'vitest';

// All UI source files (raw text), excluding tests and fixtures.
const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../test/**', '!../fixtures/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const BANNED = ['most likely', 'predicted path', 'optimal', 'confidence region'];

describe('static UI copy', () => {
  it('scans a meaningful number of source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(30);
  });

  it.each(Object.entries(sources))('%s contains no banned phrases', (_file, text) => {
    const lower = text.toLowerCase();
    for (const phrase of BANNED) expect(lower).not.toContain(phrase);
    // "probability" is only allowed inside the phrase "NOT probabilities".
    const stripped = lower.replace(/not probabilities/g, '');
    expect(stripped).not.toMatch(/probabilit/);
  });
});
