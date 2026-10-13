import { FIELD_ATTRIBUTE_KEYS, GOALKEEPER_ATTRIBUTE_KEYS, type AttributeKey, type Catalog, type Club, type Player, type MatchLineup, type Position } from './model.js';
import { SeededRng } from './rng.js';

const positions: Position[] = [
  'GK', 'DL', 'DC', 'DC', 'DR', 'DM', 'MC', 'MC', 'AML', 'AMR', 'ST',
  'MC', 'ST', 'DC', 'DR', 'DL', 'AML', 'ST', 'MC', 'DM', 'ST', 'GK', 'GK',
];
const attributeKeys = [...FIELD_ATTRIBUTE_KEYS, ...GOALKEEPER_ATTRIBUTE_KEYS];

export function createSyntheticRplScaleCatalog(seed: number): Catalog {
  const rng = new SeededRng(seed), clubs: Club[] = [], players: Player[] = [];
  for (let c = 1; c <= 16; c++) {
    const clubId = 'fictional-' + c, ids: string[] = [];
    for (let p = 1; p <= 23; p++) {
      const id = clubId + '-player-' + p;
      const attributes = {} as Record<AttributeKey, number>;
      for (const key of attributeKeys) attributes[key] = 30 + Math.floor(rng.nextFloat() * 51);
      players.push({
        id, displayName: 'Fictional Player ' + c + '-' + p,
        primaryPosition: positions[p - 1]!, foreignerForCompetition: p > 17, attributes,
      });
      ids.push(id);
    }
    clubs.push({ id: clubId, displayName: 'Fictional Club ' + c, registeredPlayerIds: ids });
  }
  return { schemaVersion: 1, source: 'synthetic', packId: 'fictional-rpl-scale', packVersion: '1', clubs, players };
}
export function defaultSyntheticLineup(club: Club): MatchLineup {
  return { clubId: club.id, starters: club.registeredPlayerIds.slice(0, 11), bench: club.registeredPlayerIds.slice(11, 23) };
}
