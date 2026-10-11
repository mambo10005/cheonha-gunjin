import {locationSceneDefinition} from '../data/location-scenes.ts';
import type {CityExplorationState} from './city-exploration-types.ts';
import type {LocationScenePhase,LocationSceneState} from './location-scene-types.ts';

const key=(city:string,location:string)=>`${city}:${location}`;
export function ensureLocationScene(x:CityExplorationState):LocationSceneState {
 const id=key(x.cityId,x.location),definition=locationSceneDefinition(x.cityId,x.location);
 if(!definition)throw new Error(`Missing location scene definition: ${id}`);
 x.locationScenes??={};
 return x.locationScenes[id]??(x.locationScenes[id]={version:1,cityId:x.cityId,locationId:x.location,phase:'overview',zoneId:definition.zones[0].id,selectedCharacterId:null,selectedInspectableId:null,inspected:[],clues:[],usedInteractions:[],visits:0,lastEventId:null});
}
export function scenePhase(state:LocationSceneState,phase:LocationScenePhase){state.phase=phase;}
export const locationSceneKey=key;
