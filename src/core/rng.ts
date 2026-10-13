/** Versioned non-cryptographic generator for reproducible simulation experiments. */
export const RNG_VERSION = 'xorshift32-v1' as const;

export class SeededRng {
  private state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) {
      throw new RangeError('Seed must be a non-zero 32-bit unsigned integer');
    }
    this.state = seed >>> 0;
  }

  nextUint32(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state;
  }

  nextFloat(): number {
    return this.nextUint32() / 0x100000000;
  }

  snapshot(): number {
    return this.state;
  }
}
