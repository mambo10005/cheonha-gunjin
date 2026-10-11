import type {RaisingOrigin} from './raising-types.ts';
export type PersonnelActivity='raising'|'combat'|'debate'|'admin'|'diplomacy';
export type Relationship='unknown'|'contact'|'cooperating'|'trusted'|'recruited'|'valued'|'core'|'departed';
export type OfficerDuty='available'|'rest'|'mission'|'moving'|'injured'|'captive'|'departed'|'rival';
export interface OfficerRecord {
 id:string;information:number;relationship:Relationship;trust:number;loyalty:number;xp:number;fatigue:number;
 task:boolean;proof:boolean;cooperation:'card'|'relation'|'decline'|null;growth:'expert'|'authority'|null;
 duty:OfficerDuty;until:number;events:string[];
}
export interface LibraryCard {
 uid:number;id:string;sourceType:'protagonist'|'officer'|'city'|'event'|'joint';sourceId:string;
 ownerType:'personal'|'faction'|'city'|'temporary'|'promise'|'consumable';owners:string[];
 activities:PersonnelActivity[];expires:number|null;spent:boolean;raisingExhausted?:boolean;upgrade?:'bold'|'quiet';mod?:'opening'|'fleeting'|'cycle';
}
export interface PersonnelState {
 version:1;protagonistId:string;background:RaisingOrigin;goal:string;record:string[];
 officers:Record<string,OfficerRecord>;encounters:Record<string,string>;party:string[];
 library:LibraryCard[];nextUid:number;loadouts:Record<PersonnelActivity,number[]>;
 representative:string|null;assistant:string|null;refined:boolean;doctrine:'people'|'law'|'strategy'|null;
 jointEvents:string[];claims:string[];revision:number;turn:number;
 stats:{recruits:number;equips:Record<string,number>;plays:Record<string,number>;officerPlays?:Record<string,number>;officerEquips?:Record<string,number>;excluded:number;growth:Record<string,number>;jointPlays:number;loyaltyCosts:number};
}
