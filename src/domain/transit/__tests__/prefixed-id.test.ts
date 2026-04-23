import { describe, expect, it } from 'vitest';

import { extractPrefix } from '../prefixed-id';

describe('extractPrefix', () => {
  it('extracts prefix before colon', () => {
    expect(extractPrefix('kobus:123')).toBe('kobus');
  });

  it('returns full string when no colon', () => {
    expect(extractPrefix('kobus')).toBe('kobus');
  });

  it('handles prefix with hyphen and underscore', () => {
    expect(extractPrefix('keio-bus:route_1')).toBe('keio-bus');
  });

  it('handles empty prefix before colon', () => {
    expect(extractPrefix(':123')).toBe('');
  });
});
