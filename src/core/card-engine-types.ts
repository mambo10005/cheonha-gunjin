/**
 * 거병 카드 공통 문법과 표식 엔진의 상태 타입.
 * 카드는 접근법의 열쇠가 아니라 표식을 만들고(produce) 소비하며(consume) 사건의 장애를 실제로 줄인다.
 */
export type CardFamily='cause'|'intel'|'network'|'military'|'supply'|'scheme';
export type CardAction='investigate'|'persuade'|'prepare'|'mobilize'|'trade'|'resolve';
export type Mark='clue'|'ledger'|'support'|'inside'|'alert'|'supply'|'momentum'|'promise'|'burden'|'opinion'|'guard';
export type MarkBag=Partial<Record<Mark,number>>;
export type ActivityKind='explore'|'debate'|'duel'|'battle'|'admin';
export interface CardGain {force?:number;marks?:MarkBag;draw?:number;power?:number}
export interface CardGrammar {
 id:string;family:CardFamily;action:CardAction;force:number;produces:MarkBag;
 consumes?:{mark:Mark;amount:number;gain:CardGain;text:string};
 followup?:{after:{action?:CardAction;family?:CardFamily;mark?:Mark;differentOwner?:boolean};gain:CardGain;text:string};
 activityVariants:Record<ActivityKind,string>;owner:string|null;
 upgradeBranches:{bold:{name:string;text:string;gain:CardGain};quiet:{name:string;text:string;gain:CardGain}};
 conversionRules:{debate?:string;duel?:DuelTacticSlot;battle?:string;admin?:string};
 burden?:boolean;
}
export type DuelTacticSlot='opening'|'response'|'gambit';
export interface ObstacleState {id:string;hp:number;max:number}
export interface PuzzleState {
 id:string;status:'active'|'resolved'|'partial'|'failed';focus:string|null;obstacles:ObstacleState[];marks:MarkBag;alert:number;
 resolution:string|null;plays:number;inspected:string[];items:string[];log:string[];
}
export interface ChainLink {card:string;family:CardFamily;action:CardAction;owner:string|null;produced:Mark[];consumed:Mark[]}
export interface EngineArgument {id:string;source:'clue'|'item'|'talent'|'manager'|'puzzle';label:string;text:string}
export interface DuelLoadout {opening:string|null;response:string|null;gambit:string|null}
export interface EngineReward {token:string;event:string;cards:string[];stratagems:string[];item:string|null;officer:string|null}
export interface EngineState {
 version:1;stratagems:string[];stratagemSwaps:number;
 scene:{location:string;marks:MarkBag;chain:ChainLink[];uses:Record<string,number>;draws:number;powerGain:number}|null;
 puzzles:Record<string,PuzzleState>;
 arguments:EngineArgument[];loadout:DuelLoadout;battleCards:{id:string;source:string;label:string}[];
 principles:Record<string,'base'|'alt'>;growth:Record<string,'add'|'upgrade'|'replace'|'principle'>;
 legacy:{id:string;kind:'policy'|'obligation'|'gate';text:string}[];
 reward:EngineReward|null;rewardsTaken:string[];rests:number[];
 pact:null|{talent:string;open:boolean;cards:string[];stratagems:string[];swaps:{removed:string;added:string}[];stratagem:string|null};
 telemetry:EngineTelemetry;
 profile?:'lenient'|'standard'|'harsh';insideDistance?:'near'|'mid'|'far';
 debates?:{context:string;grade:string;base:string;clauses:string[];pressure:boolean;rounds:number;failed:string[]}[];
 duels?:{context:string;grade:string;result:string;rounds:number;reasons:string[]}[];
 stats:{privateInterest?:number;chains:Record<string,number>;consumed:Record<string,number>;produced:Record<string,number>;distinctOwners:string[];burdenUses:number;forceDealt:number;cardsRemoved:number;cardsUpgraded:number;skips:number};
 log:string[];
}
/** 사람 플레이 전 로컬 계측. 외부 전송 없이 저장 기록과 디버그 리포트에만 남는다. */
export interface EngineTelemetry {
 plays:Record<string,number>;events:Record<string,number>;stratagems:Record<string,number>;firstPlays:string[];
 rewards:{taken:string[];declined:number};swaps:string[];sequences:{kind:'debate'|'duel'|'battle';context:string;actions:string[];result:string}[];
 withdrawals:number;cancels:number;afterFailure:string[];results:string[];
 survey?:Record<string,string>;
}
