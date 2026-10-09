import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './client';

describe('resolveApiBaseUrl', () => {
  it('defaults to the local backend when unset or empty', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('http://localhost:8000');
    expect(resolveApiBaseUrl('   ')).toBe('http://localhost:8000');
  });
  it('treats "/" as same origin (combined single-server mode)', () => {
    expect(resolveApiBaseUrl('/')).toBe('');
  });
  it('strips trailing slashes from explicit URLs', () => {
    expect(resolveApiBaseUrl('https://api.example.test/')).toBe('https://api.example.test');
  });
});
