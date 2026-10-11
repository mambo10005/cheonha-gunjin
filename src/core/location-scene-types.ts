export type LocationArchetype='inn'|'resource'|'market'|'administration'|'military'|'gate'|'knowledge'|'community'|'transport'|'danger'|'workshop';
export type LocationScenePhase='overview'|'zoneSelected'|'characterSelected'|'conversation'|'investigation'|'cardInteraction'|'itemInteraction'|'negotiationPreparation'|'debate'|'duelPreparation'|'duel'|'combatPreparation'|'combat'|'decision'|'resolution'|'report'|'lodgingOrRest'|'exit';
export interface LocationZone {id:string;name:string;description:string;objects:string[];}
export interface LocationInspectable {id:string;name:string;description:string;clue?:string;}
export interface LocationSceneDefinition {locationId:string;archetype:LocationArchetype;title:string;background:string;managerRole:string;zones:LocationZone[];inspectables:LocationInspectable[];preUprising:string[];postUprising:string[];}
/** Save-compatible scene memory. The game event and quest engines remain the source of truth for their outcomes. */
export interface LocationSceneState {version:1;cityId:string;locationId:string;phase:LocationScenePhase;zoneId:string;selectedCharacterId:string|null;selectedInspectableId:string|null;inspected:string[];clues:string[];usedInteractions:string[];visits:number;lastEventId:string|null;}
