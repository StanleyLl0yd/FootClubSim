import {LIGA_PRIKOLOV_IDENTITIES}
  from '../branding/identities.js';
import {ClubBadge} from './ClubBadge.js';

/** Use approved original art only for the exact fictional club ID and name. */
export function LigaClubLabel({clubId,name,size=20}:{
  readonly clubId:string;readonly name:string;readonly size?:number;
}){
  const identity=LIGA_PRIKOLOV_IDENTITIES.find(club=>
    club.id===clubId&&club.name===name);
  return <span className="liga-club-label">
    {identity&&<ClubBadge club={identity} size={size}/>}
    <span>{name}</span>
  </span>;
}
