/**
 * Reject malformed or non-JSON source trees before any consumer reads fields
 * or calls JSON.stringify. Includes accessors, toJSON functions, aliases,
 * cycles, array holes, symbols, custom prototypes and nonfinite numbers.
 *
 * Do not use JSON.stringify as the validation step: it invokes getters and
 * can silently omit security-relevant source properties.
 */
export function isPlainJsonTree(value: unknown): boolean {
  try {
    const seen = new WeakSet<object>();
    function inspect(item: unknown): boolean {
      if (item === null || typeof item === 'string' ||
          typeof item === 'boolean') return true;
      if (typeof item === 'number') return Number.isFinite(item);
      if (typeof item !== 'object' || seen.has(item)) return false;
      seen.add(item);
      const prototype: unknown = Object.getPrototypeOf(item);
      if (Array.isArray(item)) {
        if (prototype !== Array.prototype ||
            Reflect.ownKeys(item).length !== item.length + 1) return false;
        for (let i = 0; i < item.length; i++) {
          const property = Object.getOwnPropertyDescriptor(item, i);
          if (!property?.enumerable || !Object.hasOwn(property, 'value') ||
              !inspect(property.value)) return false;
        }
        return true;
      }
      if (prototype !== Object.prototype && prototype !== null) return false;
      for (const key of Reflect.ownKeys(item)) {
        if (typeof key !== 'string') return false;
        const property = Object.getOwnPropertyDescriptor(item, key);
        if (!property?.enumerable || !Object.hasOwn(property, 'value') ||
            !inspect(property.value)) return false;
      }
      return true;
    }
    return inspect(value);
  } catch {
    return false;
  }
}
