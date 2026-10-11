import type {AdminPlan,CityId} from './city-types.ts';
export type StartType='wanderer'|'castellan';
export type Rising='volunteers'|'officials'|'merchants';
export type Doctrine='people'|'law'|'strategy';
export interface WorldState {
 stage:'setup'|'preparing'|'founding'|'strategy'|'operation'|'won'|'failed';view:'map'|'city';turn:number;ap:number;
 startCity:CityId;startType:StartType;founder:'chengong'|'zhangliao'|'guojia';doctrine:Doctrine;perk:'credit'|'granary'|'network';
 raising?:import('./raising-types.ts').RaisingState;
 factionName:string;flagColor:string;goal:'core'|'league';treasury:number;prestige:number;capital:CityId|null;
 preparation:{step:number;ap:number;funds:number;food:number;troops:number;support:number;exposure:number;base:boolean;actions:string[];failed:number;workers:string[]};
 rising:Rising|null;reserveOfficers:string[];candidates:{id:string;city:CityId;clue:number;recruited:boolean}[];
 owners:Record<CityId,'player'|'rival'|'neutral'>;management:Partial<Record<CityId,AdminPlan|'direct'>>;
 rival:{name:string;core:CityId;food:number;funds:number;troops:number;people:number;officer:string;army:null|{origin:CityId;target:CityId;troops:number;food:number;arrival:number};plan:string;losses:number};
 neutral:{name:string;food:number;trust:number};diplomacy:{truceUntil:number;tradeUntil:number;subordinate:boolean;obligation:number};
 operation:null|{id:number;origin:CityId;target:CityId;objective:'conquest'|'recon';route:number[];index:number;cost:number;returned:boolean;training:number};
 operationSerial:number;growth:Record<string,{combat:number;debate:number;governance:number}>;
 personalDebate?:Record<string,import('./debate-deck-types.ts').DebateCard[]>;
 officerBranches?:import('./build.ts').ExpeditionBuild['growth'];
 discoveries:Partial<Record<CityId,{turn:number;source:string;strength:number}>>;history:string[];victory:string[];
 stats:{risingStep:number;firstDeparture:number;conquests:number;recruits:number;starved:number;returns:number;aiAttacks:number;defenses:number;cityIncome:Record<string,number>};
}
