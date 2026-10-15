/** Deep equality of JSON-compatible canonical values without losing undefined fields or array holes. */
export function sameCanonicalValue(expected: unknown, actual: unknown): boolean {
  if (expected === actual) return true;
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual) ||
        expected.length !== actual.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (!Object.hasOwn(expected, i) || !Object.hasOwn(actual, i) ||
          !sameCanonicalValue(expected[i], actual[i])) return false;
    }
    return true;
  }
  if (expected === null || actual === null ||
      typeof expected !== 'object' || typeof actual !== 'object') return false;
  const left = expected as Record<string, unknown>;
  const right = actual as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length &&
    keys.every(key => Object.hasOwn(right, key) && sameCanonicalValue(left[key], right[key]));
}
