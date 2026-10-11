import {startPrologue} from './prologue.ts';
import {createLocalExplorationCity} from './city.ts';
import {initializeCityExploration} from './city-exploration.ts';
import type {RunState} from './types.ts';
import type {CityId} from './city-types.ts';
import type {RaisingOrigin} from './raising-types.ts';
import type {Result} from './run.ts';
export const CITY_EXPLORATION_SEED=141001;

/** New games use the spatial city. Legacy runs keep their saved route and choices. */
export function startCityExploration(r:RunState,city:CityId,protagonist:string,origin:RaisingOrigin):Result {
 const result=startPrologue(r,city,protagonist,origin);if(!result.ok)return result;
 initializeCityExploration(r,createLocalExplorationCity(r,city));return {ok:true};
}
