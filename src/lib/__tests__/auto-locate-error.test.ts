import { describe, expect, it } from 'vitest';
import { classifyAutoLocateError } from '../auto-locate-error';

function buildError(code: 1 | 2 | 3, message: string): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

describe('classifyAutoLocateError', () => {
  it('classifies PERMISSION_DENIED (code 1) as disable', () => {
    const action = classifyAutoLocateError(buildError(1, 'User denied geolocation prompt'));

    expect(action.kind).toBe('disable');
    expect(action.logMessage).toBe('auto-locate permission denied: User denied geolocation prompt');
  });

  it('classifies POSITION_UNAVAILABLE (code 2) as transient', () => {
    const action = classifyAutoLocateError(buildError(2, 'Position unavailable'));

    expect(action.kind).toBe('transient');
    expect(action.logMessage).toBe('auto-locate transient error code=2: Position unavailable');
  });

  it('classifies TIMEOUT (code 3) as transient', () => {
    const action = classifyAutoLocateError(buildError(3, 'Timeout expired'));

    expect(action.kind).toBe('transient');
    expect(action.logMessage).toBe('auto-locate transient error code=3: Timeout expired');
  });

  it('embeds the raw error message verbatim in the log', () => {
    const action = classifyAutoLocateError(buildError(2, 'GPS signal lost: indoor location'));

    expect(action.logMessage).toContain('GPS signal lost: indoor location');
  });
});
