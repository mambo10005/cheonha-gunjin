export type CityId='xingyang'|'chenggao'|'gong';
export type Metric='life'|'order'|'security'|'production';
export type DistrictId='hall'|'market'|'farms'|'store'|'barracks'|'gate';
export type AdminRole='civil'|'logistics'|'guard';
export type AdminFamily='relief'|'farm'|'trade'|'security'|'military'|'works'|'records'|'intel'|'diplomacy';
export type CityBuild='settlement'|'trade'|'military';
export type Occupation='strict'|'shared'|'military'|'merchant';
export type Conquest='assault'|'persuade'|'siege'|'inside';
export type AdminPlan='life'|'military'|'production'|'issues'|'combo'|'support'|'random'|'conserve';
export interface AdminCard {personnelCard?:number;personnelOwners?:string[];personnelCost?:number;uid:number;id:string;upgrade:boolean;mod:'none'|'cheap'|'retain';owner?:string;temporary?:boolean;}
export interface CityIssue {id:string;due:number;progress:number;status:'active'|'resolved'|'failed';}
export interface CityDistrict {id:DistrictId;damage:number;facility:string|null;level:number;}
export interface CityProject {id:string;progress:number;need:number;owner:string|null;idle:number;complete:boolean;}
export interface CityPolicy {id:string;remaining:number;}
export interface CityPromise {id:string;due:number;status:'active'|'fulfilled'|'broken';}
export interface CityState {
 exploration?:import('./city-exploration-types.ts').CityExplorationState;
 funds?:number;reserveTroops?:number;training?:number;settledTurn?:number;delegated?:boolean;
 id:CityId;owner:'player'|'local';metrics:Record<Metric,number>;food:number;materials:number;people:number;readiness:number;
 districts:CityDistrict[];roles:Record<AdminRole,string|null>;policies:CityPolicy[];seals:string[];
 cards:AdminCard[];draw:number[];hand:number[];discard:number[];exhaust:number[];nextUid:number;
 phase:number;limit:number;ap:number;used:string[];lastFamily:AdminFamily|null;lastDistrict:DistrictId|null;uses:Record<string,number>;
 issues:CityIssue[];projects:CityProject[];groups:Record<'locals'|'traders'|'refugees',number>;promises:CityPromise[];
 blueprints:string[];threat:{due:number;power:number;resolved:boolean};pact:{kind:'trade'|'guard';remaining:number}|null;
 occupation:Occupation;conquest:Conquest;build:CityBuild;outcome:string;plan:AdminPlan;report:string[];log:string[];
 stats:{plays:Record<string,number>;chains:number;facilities:string[];appointments:string[];resolved:number;depleted:number;repeats:number};
}
export interface CampaignState {
 personnel?:import("./personnel-types.ts").PersonnelState;
 campaignId?:string;saveVersion?:7;scenarioId?:'henan-190';world?:import('./world-types.ts').WorldState;
 /** 사람 플레이테스트 프리셋 표시(저장 키 분리·로컬 로그). */
 playtest?:{preset:string;version:1;startedAt:number};
 /** Runtime adapter only; serialized once by campaign-save, never inside RunState. */
 readonly activeExpedition?:import('./types.ts').RunState;
 version:1;dataVersion:'henan-cities-1';seed:number;rng:number;faction:string;
 stage:'approach'|'conquest'|'occupation'|'admin'|'ready'|'expedition'|'complete';target:CityId;active:CityId|null;
 cities:Partial<Record<CityId,CityState>>;roster:string[];fatigue:Record<string,number>;captured:CityId[];
 roads:{a:CityId;b:CityId;condition:number;distance:number}[];
 approach:{choices:string[];intel:number;supply:number;trust:number;cut:number;damage:number};method:Conquest|null;
 activity:null|'conquest'|'issue';deferredPromises:string[];departures:number;unlocks:CityBuild[];log:string[];
}
export interface CityDelta {field:string;before:number;after:number;}
