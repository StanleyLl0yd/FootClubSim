import {LIGA_PRIKOLOV_IDENTITIES} from '../branding/identities.js';
import {createSyntheticRplScaleCatalog} from '../core/synthetic.js';
import type {Catalog,Club,Player} from '../core/model.js';

/**
 * PLAYABLE PROTOTYPE ONLY: original club identities + fully synthetic
 * players and attributes. No borrowed RPL registrations, photographs,
 * roster claims or rights-gated personnel drafts enter this pack.
 * It has different immutable IDs/pack metadata from the M0 test catalog.
 */
export const LIGA_PRIKOLOV_PREVIEW_PACK_ID='liga-prikolov-preview' as const;
const GIVEN=[
  'Алексей','Вадим','Георгий','Даниил','Евгений','Захар',
  'Илья','Кирилл','Леонид','Максим','Никита','Олег',
  'Павел','Роман','Семён','Тимофей','Фёдор','Юрий',
  'Арсений','Виктор','Григорий','Матвей','Руслан','Тимур',
] as const;
const FAMILY=[
  'Береговой','Ветров','Горский','Долинин','Ельцов','Журавлёв',
  'Зорин','Ильин','Клёнов','Луговой','Миронов','Неверов',
  'Орлов','Поляков','Рябинин','Серов','Тихонов','Устинов',
  'Фомин','Холодов','Цветков','Чернов','Шилов','Ясенев',
  'Белов','Градов','Дубровин','Ершов','Калинин','Лисов',
  'Мельник','Осокин','Руднев','Северин','Тополев','Филатов',
] as const;

/** Never infer or introduce authentic real-club membership from these names. */
export function createLigaPrikolovPreviewCatalog(seed:number):Catalog{
  if(!Number.isSafeInteger(seed)||seed<1||seed>0xffffffff)
    throw RangeError('Invalid synthetic preview seed');
  const legacy=createSyntheticRplScaleCatalog(seed);
  if(legacy.clubs.length!==LIGA_PRIKOLOV_IDENTITIES.length||
      legacy.clubs.length!==16)throw Error('Club identities incomplete');
  const originalPlayers=new Map(legacy.players.map(player=>
    [player.id,player]));
  const clubs:Club[]=[];
  const players:Player[]=[];
  for(let clubIndex=0;clubIndex<legacy.clubs.length;clubIndex++){
    const original=legacy.clubs[clubIndex]!;
    const identity=LIGA_PRIKOLOV_IDENTITIES[clubIndex]!;
    const ids:string[]=[];
    for(let playerIndex=0;
        playerIndex<original.registeredPlayerIds.length;playerIndex++){
      const originalId=original.registeredPlayerIds[playerIndex]!;
      const player=originalPlayers.get(originalId);
      if(!player)throw Error('Unmapped synthetic player');
      const id=identity.id+'-player-'+(playerIndex+1);
      // A full-cycle permutation prevents hundreds of duplicate full names.
      const identityIndex=clubIndex*23+playerIndex;
      const nameId=(identityIndex*37+seed)%(GIVEN.length*FAMILY.length);
      const given=GIVEN[nameId%GIVEN.length]!;
      const family=FAMILY[Math.floor(nameId/GIVEN.length)]!;
      players.push({...player,id,displayName:given+' '+family});
      ids.push(id);
    }
    clubs.push({
      id:identity.id,displayName:identity.name,registeredPlayerIds:ids,
    });
  }
  return{schemaVersion:1,source:'synthetic',
    packId:LIGA_PRIKOLOV_PREVIEW_PACK_ID,
    packVersion:'1-seed-'+seed,clubs,players};
}
