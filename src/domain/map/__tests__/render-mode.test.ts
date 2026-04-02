import { describe, expect, it } from 'vitest';
import { resolveRenderModes } from '../render-mode';

describe('resolveRenderModes', () => {
  it('returns standard/lightweight for "standard" mode', () => {
    const result = resolveRenderModes('standard', 10);
    expect(result).toEqual({ nearby: 'standard', far: 'lightweight' });
  });

  it('returns lightweight/lightweight for "lightweight" mode', () => {
    const result = resolveRenderModes('lightweight', 18);
    expect(result).toEqual({ nearby: 'lightweight', far: 'lightweight' });
  });

  it('returns standard/lightweight in auto mode when zoom >= 15', () => {
    expect(resolveRenderModes('auto', 15)).toEqual({ nearby: 'standard', far: 'lightweight' });
    expect(resolveRenderModes('auto', 18)).toEqual({ nearby: 'standard', far: 'lightweight' });
  });

  it('returns lightweight/lightweight in auto mode when zoom < 15', () => {
    expect(resolveRenderModes('auto', 14)).toEqual({ nearby: 'lightweight', far: 'lightweight' });
    expect(resolveRenderModes('auto', 10)).toEqual({ nearby: 'lightweight', far: 'lightweight' });
  });
});
