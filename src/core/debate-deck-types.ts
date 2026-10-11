import type { Axis } from './accord-types.ts';
export type Method='honor'|'profit'|'trust'|'pressure'|'information'|'scheme';
export type Upgrade='stable'|'linked';
export type Modification='fleeting'|'opening'|'cycle'|'clean';
export interface DebateCard { personnelCard?:number;personnelOwners?:string[]; personnelCost?:number; uid:number; id:string; owner?:string; upgrade?:Upgrade; mod?:Modification; inherited?:'reveal'|'trust'; temporary?:boolean }
export type Operation={kind:'score';axis:Axis;amount:number}|{kind:'trust'|'focus'|'draw'|'burden'|'food'|'reports'|'guard'|'discount'|'reveal'|'amplify';amount:number}|{kind:'promise';promise:'ration'|'authority'}|{kind:'generate';card:string}|{kind:'copy'|'exhaustHand'|'reclaim'};
export interface Effect { timing:'play'|'after'|'burden'|'round'; condition?:{previous?:Method;family?:Method;different?:number;paid?:boolean;answered?:boolean;burdenBefore?:boolean}; operations:Operation[]; limit:number; priority:number; source:string }
export interface DebateCardDef {id:string;name:string;family:Method;cost:number;text:string;effects:Effect[];exhaust?:boolean;owner?:string;hindrance?:boolean;mods:Modification[];upgrades?:Record<Upgrade,{text:string;effects:Effect[]}>}
export interface DeckCampaign { enabled:boolean; representative:string|null; assistant:string|null; cards:DebateCard[]; nextUid:number; seals:string[]; slots:number; claimed:string[]; obligations:{id:string;kind:'ration'|'authority';due:number;status:'active'|'fulfilled'|'broken'}[] }
export type CounterKind='profit'|'safety'|'doubt'|'burden'|'delay'|'review';
export interface DeckRuntime { cards:DebateCard[];draw:number[];hand:number[];discard:number[];exhaust:number[];nextUid:number;revision:number;assistant:string|null;seals:string[];counters:CounterKind[];counterIndex:number;revealed:number;guard:number;discount:number;amplify:number;played:number;previous:Method|null;families:Method[];axisFamilies:Partial<Record<Axis,Method[]>>;uses:Record<string,number>;previousBurden:boolean;promises:('ration'|'authority')[];withdrawn:boolean;elite:boolean;adviceUsed:boolean;lastCard:string|null;chain:number;receipt:'settled';stats:{plays:Record<string,number>;reshuffles:number;drawn:number;chains:number} }
export interface DeckReward {token:string;offers:string[];seal:string;result:'success'|'partial';elite:boolean}
