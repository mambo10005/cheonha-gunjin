import type {CityId,DistrictId} from './city-types.ts';
import type {DebateState,DuelState} from './social-types.ts';
import type {RaisingFamily} from './raising-types.ts';
import type {InnState} from './inn-types.ts';
import type {LocationSceneState} from './location-scene-types.ts';
export type ExplorationScene='map'|'location'|'debate'|'duel'|'result';
export type ExplorationPlan='assembly'|'barracks'|'inside';
export interface ExplorationLocation {id:string;name:string;x:number;y:number;kind:string;nodeKind:string;district?:DistrictId;description:string;postRole:string;risk:number;secret?:boolean;opens?:'day'|'night';}
export interface ExplorationLink {a:string;b:string;time:number;food:number;exposure:number;secret?:boolean;}
export interface CityExplorationDefinition {cityId:CityId;title:string;type:string;terrain:string;start:string;bounds:{width:number;height:number};locations:ExplorationLocation[];links:ExplorationLink[];groups:string[];}
export type ExplorationItemId='letter'|'ledger'|'seal'|'ration'|'medicine'|'map';
export interface ExplorationItem {uid:number;id:ExplorationItemId;source:string;important:boolean;}
export interface ExplorationEventState {id:string;stage:number;status:'active'|'success'|'failure'|'withdrawn';choice:string|null;outcome:string;roll:number;claimed:boolean;committedFamilies:RaisingFamily[];itemUsed:ExplorationItemId|null;}
export interface ExplorationEffect {funds?:number;food?:number;troops?:number;support?:number;exposure?:number;intel?:number;legitimacy?:number;training?:number;influence?:number;debt?:number;item?:ExplorationItemId;card?:string;secure?:boolean;damage?:number;group?:'locals'|'traders';groupChange?:number;plan?:ExplorationPlan;promise?:'autonomy'|'authority'|'ration';}
export interface ExplorationApproach {id:string;label:string;description:string;kind:'talk'|'investigate'|'trade'|'card'|'item'|'debate'|'duel'|'companion'|'risk';time:number;cost?:{funds?:number;food?:number};family?:RaisingFamily;item?:ExplorationItemId;companionFamily?:RaisingFamily;minIntel?:number;minLegitimacy?:number;effects:ExplorationEffect;next?:number;failure?:string;}
export interface ExplorationEventDefinition {id:string;location:string;title:string;opening:string;stages:{text:string;approaches:ExplorationApproach[]}[];oncePerCampaign:true;}
export type ExplorationSemanticType='cityExplorationStarted'|'locationSelected'|'travelCostPaid'|'timeAdvanced'|'locationEntered'|'characterDiscovered'|'rumorDiscovered'|'eventStarted'|'cardCommitted'|'itemUsed'|'debateStarted'|'duelStarted'|'relationshipChanged'|'temporarySupportGranted'|'officerRecruited'|'cardGranted'|'cardUpgraded'|'protagonistGrowthOffered'|'locationSecured'|'uprisingPlanUnlocked'|'cityStateChanged'|'itemGranted'|'eventResolved'|'dispatchCompleted'|'protagonistGrown'|'innEntered'|'innkeeperSelected'|'patronArrived'|'patronSelected'|'topicSelected'|'locationUnlocked'|'rumorRevealed'|'questOffered'|'questAccepted'|'questStepAdvanced'|'questReadyToReport'|'questReported'|'questExpired'|'innkeeperRelationChanged'|'lodgingStarted'|'sceneZoneSelected'|'sceneCharacterSelected'|'sceneObjectInspected'|'sceneConversationStarted'|'sceneInteractionResolved';
export interface ExplorationSemanticEvent {id:number;type:ExplorationSemanticType;text:string;location:string;character?:string;card?:string;item?:ExplorationItemId;}
export interface CityExplorationState {
 version:1;cityId:CityId;seed:number;rng:number;revision:number;location:string;selected:string;scene:ExplorationScene;
 inn?:InnState;
 locationScenes?:Record<string,LocationSceneState>;
 camera:{x:number;y:number;zoom:number};tick:number;budget:number;fatigue:number;companions:string[];companionSlots:number;
 locations:Record<string,{visits:number;discovered:boolean;secured:boolean;damage:number;closedUntil:number;lastVisit:number}>;
 sightings:Record<string,{location:string;known:boolean;next:string;until:number}>;
 event:ExplorationEventState|null;events:Record<string,ExplorationEventState>;debate:DebateState|null;duel:DuelState|null;
 socialApproach:string|null;items:ExplorationItem[];nextItemUid:number;itemSlots:number;importantSlots:number;pendingItem:ExplorationItem|null;
 growth:{xp:number;offered:boolean;branch:null|'insight'|'resolve';principle:string};
 dispatches:{officer:string;location:string;due:number;complete:boolean;claim:string}[];relationships:Record<string,{kind:'trust'|'competition';score:number}>;
 unlockedPlans:ExplorationPlan[];rumors:string[];flags:string[];queue:ExplorationSemanticEvent[];nextEventId:number;acknowledged:number;converted:boolean;
 stats:{visits:Record<string,number>;encounters:Record<string,number>;approaches:Record<string,number>;cards:Record<string,number>;items:Record<string,number>;withdrawals:number;failures:number;debates:number;duels:number;growth:Record<string,number>;plans:Record<string,number>;dispatches:number};
}
