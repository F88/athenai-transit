const EXPECTED_BUNDLE_VERSION = 3;

export function validateBundleEnvelope<K extends string>(
  json: unknown,
  expectedKind: K,
  path: string,
): asserts json is { bundle_version: 3; kind: K } {
  if (json === null) {
    throw new Error(`${path}: expected JSON object, got null`);
  }
  if (Array.isArray(json)) {
    throw new Error(`${path}: expected JSON object, got array`);
  }
  if (typeof json !== 'object') {
    throw new Error(`${path}: expected JSON object, got ${typeof json}`);
  }
  const obj = json as Record<string, unknown>;
  if (obj.bundle_version !== EXPECTED_BUNDLE_VERSION) {
    throw new Error(
      `${path}: invalid bundle_version (expected ${EXPECTED_BUNDLE_VERSION}, got ${String(obj.bundle_version)})`,
    );
  }
  if (obj.kind !== expectedKind) {
    throw new Error(
      `${path}: invalid bundle kind (expected "${expectedKind}", got "${String(obj.kind)}")`,
    );
  }
}
