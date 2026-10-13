import type { Round } from './fixtures.js';
import { isStableId } from './identifiers.js';
import type { ValidationError } from './validation.js';

/** Validate any candidate home-and-away calendar without trusting a generator. */
export function validateDoubleRoundRobin(
  rounds: readonly Round[], clubIds: readonly string[],
): readonly ValidationError[] {
  const errors: ValidationError[] = [];
  if (!Array.isArray(clubIds) || clubIds.length < 2 || clubIds.length > 64 ||
      clubIds.length % 2 !== 0 || !Array.from(clubIds).every(isStableId) ||
      new Set(clubIds).size !== clubIds.length) {
    return [{ code: 'INVALID_CLUBS', at: 'clubs' }];
  }
  const count = clubIds.length;
  const allClubs = new Set(clubIds);
  if (!Array.isArray(rounds) || rounds.length !== 2 * (count - 1)) {
    return [{ code: 'INVALID_ROUND_COUNT', at: 'rounds' }];
  }

  const seenFixtures = new Set<string>();
  const seenPairs = new Set<string>();
  for (const [index, round] of rounds.entries()) {
    const at = 'rounds[' + index + ']';
    if (!round || round.number !== index + 1 || !Array.isArray(round.fixtures) ||
        round.fixtures.length !== count / 2) {
      errors.push({ code: 'INVALID_ROUND', at });
      continue;
    }
    const participants = new Set<string>();
    for (const [fixtureIndex, fixture] of round.fixtures.entries()) {
      const location = at + '.fixtures[' + fixtureIndex + ']';
      if (!fixture || !isStableId(fixture.id) ||
          seenFixtures.has(fixture.id) || fixture.round !== round.number) {
        errors.push({ code: 'INVALID_FIXTURE_ID', at: location });
      } else seenFixtures.add(fixture.id);

      if (!fixture || !allClubs.has(fixture.homeClubId) ||
          !allClubs.has(fixture.awayClubId) ||
          fixture.homeClubId === fixture.awayClubId) {
        errors.push({ code: 'INVALID_OPPONENTS', at: location });
        continue;
      }
      if (participants.has(fixture.homeClubId) || participants.has(fixture.awayClubId)) {
        errors.push({ code: 'DUPLICATE_ROUND_PARTICIPANT', at: location });
      }
      participants.add(fixture.homeClubId);
      participants.add(fixture.awayClubId);
      const pair = JSON.stringify([fixture.homeClubId, fixture.awayClubId]);
      if (seenPairs.has(pair)) errors.push({ code: 'DUPLICATE_HOME_AWAY_PAIR', at: location });
      seenPairs.add(pair);
    }
    if (participants.size !== count) errors.push({ code: 'MISSING_ROUND_PARTICIPANT', at });
  }
  if (seenPairs.size !== count * (count - 1)) {
    errors.push({ code: 'INCOMPLETE_HOME_AWAY_PAIRS', at: 'rounds' });
  }
  return errors;
}
