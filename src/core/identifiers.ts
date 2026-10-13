/** Stable domain identifiers are opaque, bounded and never contain whitespace or controls. */
export function isStableId(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length > 0 && value.length <= 128 &&
    value === value.trim() &&
    !/[\s\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value);
}
