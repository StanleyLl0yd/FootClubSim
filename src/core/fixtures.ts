export interface Fixture {
  readonly id: string;
  readonly round: number;
  readonly homeClubId: string;
  readonly awayClubId: string;
}
export interface Round {
  readonly number: number;
  readonly fixtures: readonly Fixture[];
}
/** Generate synthetic fixtures, not a copy of the official RPL calendar. */
export function generateDoubleRoundRobin(ids: readonly string[]): readonly Round[] {
  const n = ids.length;
  if (n < 2 || n > 64 || n % 2 !== 0 || new Set(ids).size !== n ||
      ids.some(id => id.length < 1 || id.length > 128)) {
    throw new RangeError('Invalid clubs');
  }
  const rotation = [...ids];
  const firstLeg: Round[] = [];
  for (let round = 0; round < n - 1; round++) {
    const fixtures: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const flip = (i + round) % 2 === 1;
      const a = rotation[i]!, b = rotation[n - 1 - i]!;
      fixtures.push({
        id: 'a-' + round + '-' + i,
        round: round + 1,
        homeClubId: flip ? b : a,
        awayClubId: flip ? a : b,
      });
    }
    firstLeg.push({ number: round + 1, fixtures });
    rotation.splice(1, 0, rotation.pop()!);
  }
  return firstLeg.concat(firstLeg.map(r => ({
    number: r.number + n - 1,
    fixtures: r.fixtures.map((f, i) => ({
      id: 'b-' + r.number + '-' + i,
      round: r.number + n - 1,
      homeClubId: f.awayClubId,
      awayClubId: f.homeClubId,
    })),
  })));
}
