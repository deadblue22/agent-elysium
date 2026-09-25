// Seedable dice (docs/design.md §7.1): the same seed gives the same rolls.

export type Rng = () => number;

/** mulberry32: small, fast, and good enough for dice. Returns floats in [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollD6(rng: Rng): number {
  return 1 + Math.floor(rng() * 6);
}

export function roll2d6(rng: Rng): [number, number] {
  return [rollD6(rng), rollD6(rng)];
}

/** A seed from the clock, for unseeded play. */
export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
}
