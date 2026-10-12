import type {DebateState,DuelState} from './social-types.ts';
export type RaisingFamily='cause'|'network'|'funds'|'supply'|'military'|'intel'|'promise';
export type RaisingOrigin='notable'|'militia'|'official';
export type RaisingResource='funds'|'food'|'troops'|'support'|'exposure'|'legitimacy'|'intel'|'debt'|'training'|'influence';
export type RaisingOperation={kind:'resource';field:RaisingResource;amount:number}|{kind:'draw'|'power'|'reveal'|'discount'|'refundMomentum';amount:number}|{kind:'generate';card:string}|{kind:'pledge';id:'autonomy'|'authority'|'ration'};
export interface RaisingEffect {source:string;priority:number;limit:number;timing:'play'|'after'|'step'|'duel';condition?:{previous?:RaisingFamily;family?:RaisingFamily;different?:boolean;ally?:string};operations:RaisingOperation[]}
export interface RaisingCard {personnelCard?:number;uid:number;id:string;upgrade?:'bold'|'quiet';mod?:'opening'|'fleeting'|'cycle'}
export interface RaisingState {
 version:1;seed:number;rng:number;origin:RaisingOrigin;representative:string;assistant:string;
 phase:'map'|'node'|'reward'|'plan'|'debate'|'duel'|'result'|'escape'|'founded';step:number;length:number;
 cards:RaisingCard[];draw:number[];hand:number[];discard:number[];exhaust:number[];nextUid:number;
 route:{id:string;kind:string;row:number;lane:number;open:boolean}[][];visited:string[];node:string|null;progress:number;event:string|null;
 power:number;played:number;previous:RaisingFamily|null;previousId:string|null;discount:number;uses:Record<string,number>;revealed:number;
 legitimacy:number;intel:number;training:number;influence:number;allies:string[];regional:string|null;schemes:string[];
 pledges:('autonomy'|'authority'|'ration')[];completed:string[];
 reward:null|{token:string;cards:string[];scheme:string;ally:string};revision:number;
 plan:null|'assembly'|'barracks'|'inside';gate:null|{debate:DebateState|null;duel:DuelState|null;debateGrade:string|null;duelGrade:string|null;representative:string;support:number;discount:number;tacticRefund:boolean};
 grade:null|'great'|'success'|'conditional'|'incomplete'|'escaped'|'lost';attempt:number;
 result:string[];log:string[];converted:boolean;injuries?:Record<string,number>;engine?:import('./card-engine-types.ts').EngineState;
 stats:{plays:Record<string,number>;picks:Record<string,number>;skips:number;removes:number;upgrades:number;mods:number;chains:number;reshuffles:number;recoveries:number;allyPicks:Record<string,number>};
}
