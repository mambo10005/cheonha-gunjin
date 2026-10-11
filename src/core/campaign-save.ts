import {validateAndMigrateRun} from './save-validation.ts';
import {validWorld} from './world-validation.ts';
import {bindCampaign,migrateCityCampaign} from './world.ts';
import type {CampaignState} from './city-types.ts';
import type {RunState} from './types.ts';
import type {KV,LoadResult} from './save.ts';
import {INN_QUESTS} from '../data/inn.ts';
export const CAMPAIGN_KEY='cheonha-gunjin.campaign';
export const CAMPAIGN_SAVE_VERSION=7;
export function campaignSnapshot(r:RunState){const c=r.campaign!;const {campaign:unused,...army}=r;void unused;return {...c,activeExpedition:army};}
export function saveCampaign(kv:KV,r:RunState):boolean {try{kv.setItem(CAMPAIGN_KEY,JSON.stringify({version:7,savedAt:Date.now(),data:campaignSnapshot(r)}));return true;}catch{return false;}}
/** Preserve completed receipts and route older ready-to-report escort saves through the new physical shipment step. */
function migrateLocationQuests(campaign:Record<string,any>){
 for(const city of Object.values(campaign.cities??{}) as any[]){const quest=city?.exploration?.inn?.quests?.escort;if(!quest)continue;const finalStep=INN_QUESTS.escort.steps.length-1;
  if(quest.reported===true&&quest.status==='completed'){quest.step=finalStep;continue;}
  if(quest.status==='readyToReport'&&quest.step===2){quest.step=2;quest.status='active';quest.evidence??=[];if(!quest.evidence.includes('legacy-approved'))quest.evidence.push('legacy-approved');if(!quest.conclusion)quest.conclusion='이전 저장의 계약 또는 통행 승인';}
 }
}
export function loadCampaign(kv:KV):LoadResult<CampaignState> {
 try {const raw=kv.getItem(CAMPAIGN_KEY);if(!raw)return {ok:false,reason:'none'};const e=JSON.parse(raw);if(e?.version!==7)return {ok:false,reason:'version'};if(!e.data||!e.data.world||!e.data.activeExpedition)return {ok:false,reason:'corrupt'};
  const {activeExpedition,...campaign}=e.data;migrateLocationQuests(campaign);const r=validateAndMigrateRun({...activeExpedition,campaign},activeExpedition.version);if(!r||!validWorld(r))return {ok:false,reason:'corrupt'};return {ok:true,data:bindCampaign(r)};
 }catch{return {ok:false,reason:'corrupt'};}
}
export function importLegacyCampaign(kv:KV,r:RunState):LoadResult<CampaignState> {const converted=migrateCityCampaign(structuredClone(r));if(!converted||!validWorld(converted.activeExpedition!))return {ok:false,reason:'corrupt'};if(!saveCampaign(kv,converted.activeExpedition!))return {ok:false,reason:'corrupt'};return {ok:true,data:converted};}
