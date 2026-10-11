import {validCityExploration} from './city-exploration-validation.ts';
import {ADMIN_CARDS,ADMIN_GENERALS,CITY_DEFS,DISTRICTS,FACILITY_DEFS,ISSUE_DEFS,POLICY_DEFS,PROJECT_DEFS,SEAL_DEFS} from '../data/cities.ts';
import {GENERALS} from '../data/generals.ts';
import type {RunState} from './types.ts';
type O=Record<string,any>;
const obj=(x:unknown):x is O=>!!x&&typeof x==='object'&&!Array.isArray(x);
const num=(x:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof x==='number'&&Number.isInteger(x)&&x>=min&&x<=max;
const list=(x:unknown):x is any[]=>Array.isArray(x)&&x.length<=300;
const ids=(x:unknown,table:O)=>list(x)&&x.every(id=>typeof id==='string'&&Object.hasOwn(table,id));
const texts=(x:unknown)=>list(x)&&x.every(v=>typeof v==='string'&&v.length<=10000);
const unique=(x:any[])=>new Set(x).size===x.length;
export function validCampaign(r:RunState):boolean {
 const x:unknown=r.campaign;if(x===undefined)return true;
 if(!obj(x)||x.version!==1||x.dataVersion!=='henan-cities-1'||!num(x.seed)||!num(x.rng,-2147483648,4294967295)||x.faction!==r.lordId||!['approach','conquest','occupation','admin','ready','expedition','complete'].includes(x.stage)||!Object.hasOwn(CITY_DEFS,x.target)||!(x.active===null||Object.hasOwn(CITY_DEFS,x.active))||!obj(x.cities)||Object.keys(x.cities).some(id=>!Object.hasOwn(CITY_DEFS,id)))return false;
 if(!ids(x.roster,x.world?GENERALS:ADMIN_GENERALS)||!unique(x.roster)||(x.world?x.roster.length<1||x.roster.length>12:x.roster.length!==4)||!obj(x.fatigue)||!Object.entries(x.fatigue).every(([id,n])=>x.roster.includes(id)&&num(n,0,6))||!ids(x.captured,CITY_DEFS)||!unique(x.captured)||!list(x.roads)||x.roads.length!==3||!x.roads.every(road=>obj(road)&&Object.hasOwn(CITY_DEFS,road.a)&&Object.hasOwn(CITY_DEFS,road.b)&&road.a!==road.b&&num(road.condition,1,3)&&num(road.distance,1,2)))return false;
 if(!obj(x.approach)||!texts(x.approach.choices)||x.approach.choices.length>2||!unique(x.approach.choices)||!x.approach.choices.every((id:string)=>['scout','supply','protect','cut','raid'].includes(id))||!num(x.approach.intel,0,20)||!num(x.approach.supply,0,20)||!num(x.approach.trust,-3,10)||!num(x.approach.cut,0,20)||!num(x.approach.damage,0,10)||!(x.method===null||['assault','persuade','siege','inside'].includes(x.method))||!(x.activity===null||['conquest','issue'].includes(x.activity))||!texts(x.deferredPromises)||!texts(x.log)||!num(x.departures,0,x.world?100000:20)||!ids(x.unlocks,{settlement:1,trade:1,military:1}))return false;
 const stationed:string[]=[];
 for(const [id,c] of Object.entries(x.cities)){
  if(!obj(c)||c.id!==id||!(c.owner==='player'||c.owner==='local'&&x.personnel&&x.world?.startCity===id&&['preparing','failed'].includes(x.world.stage)&&c.exploration)||!obj(c.metrics)||!['life','order','security','production'].every(k=>num(c.metrics[k],0,100))||!['food','materials','people'].every(k=>num(c[k],0,200))||!num(c.readiness,0,100)||!num(c.phase,1,x.world?100000:5)||c.limit!==(x.world?100000:5)||!num(c.ap,0,4)||!obj(c.roles)||!['civil','logistics','guard'].every(k=>c.roles[k]===null||x.roster.includes(c.roles[k])))return false;
  if(c.exploration!==undefined&&!validCityExploration(c.exploration,c.id))return false;
  stationed.push(...Object.values(c.roles).filter((v):v is string=>typeof v==='string'));
  if(!list(c.districts)||c.districts.length!==6||!unique(c.districts.map(d=>d.id))||!c.districts.every(d=>obj(d)&&Object.hasOwn(DISTRICTS,d.id)&&num(d.damage,0,4)&&num(d.level,0,2)&&(d.facility===null||Object.hasOwn(FACILITY_DEFS,d.facility)&&FACILITY_DEFS[d.facility].district===d.id))||c.districts.filter(d=>d.facility).length>3)return false;
  if(!list(c.policies)||c.policies.length>2||!unique(c.policies.map(p=>p.id))||!c.policies.every(p=>obj(p)&&Object.hasOwn(POLICY_DEFS,p.id)&&num(p.remaining,1,5))||!ids(c.seals,SEAL_DEFS)||c.seals.length>2||!unique(c.seals)||!ids(c.blueprints,FACILITY_DEFS)||c.blueprints.length>3)return false;
  if(!num(c.nextUid,1)||!list(c.cards)||!unique(c.cards.map(card=>card.uid))||!c.cards.every(card=>obj(card)&&num(card.uid,1,c.nextUid-1)&&Object.hasOwn(ADMIN_CARDS,card.id)&&typeof card.upgrade==='boolean'&&['none','cheap','retain'].includes(card.mod)&&(card.owner===undefined||Object.values(c.roles).includes(card.owner))&&(card.temporary===undefined||typeof card.temporary==='boolean')))return false;
  const piles=['hand','draw','discard','exhaust'].flatMap(k=>list(c[k])?c[k]:[-1]);if(!unique(piles)||piles.length!==c.cards.length||!piles.every(uid=>c.cards.some((card:O)=>card.uid===uid)))return false;
  if(!ids(c.used,x.world?GENERALS:ADMIN_GENERALS)||!unique(c.used)||!obj(c.uses)||!Object.values(c.uses).every(v=>num(v,0,10))||!obj(c.groups)||!['locals','traders','refugees'].every(k=>num(c.groups[k],-3,3)))return false;
  if(!list(c.issues)||!unique(c.issues.map(i=>i.id))||!c.issues.every(i=>obj(i)&&Object.hasOwn(ISSUE_DEFS,i.id)&&num(i.due,0,5)&&num(i.progress,0,2)&&['active','resolved','failed'].includes(i.status))||!list(c.projects)||c.projects.filter(p=>!p.complete).length>2||!unique(c.projects.map(p=>p.id))||!c.projects.every(p=>obj(p)&&Object.hasOwn(PROJECT_DEFS,p.id)&&num(p.progress,0,3)&&p.need===3&&num(p.idle,0,x.world?100000:5)&&typeof p.complete==='boolean'&&(p.owner===null||x.roster.includes(p.owner))))return false;
  if(!list(c.promises)||!c.promises.every(p=>obj(p)&&['ration','authority','shared','escort','safety'].includes(p.id)&&num(p.due,1,x.world?100000:8)&&['active','fulfilled','broken'].includes(p.status))||!obj(c.threat)||!num(c.threat.due,1,5)||!num(c.threat.power,0,100)||typeof c.threat.resolved!=='boolean'||!(c.pact===null||obj(c.pact)&&['trade','guard'].includes(c.pact.kind)&&num(c.pact.remaining,1,3)))return false;
  if(!['strict','shared','military','merchant'].includes(c.occupation)||!['assault','persuade','siege','inside'].includes(c.conquest)||!['settlement','trade','military'].includes(c.build)||!['life','military','production','issues','combo','support','random','conserve'].includes(c.plan)||typeof c.outcome!=='string'||!texts(c.report)||!texts(c.log)||!obj(c.stats)||!obj(c.stats.plays)||!Object.entries(c.stats.plays).every(([id,v])=>Object.hasOwn(ADMIN_CARDS,id)&&num(v))||!ids(c.stats.facilities,FACILITY_DEFS)||!ids(c.stats.appointments,ADMIN_GENERALS)||!['chains','resolved','depleted','repeats'].every(k=>num(c.stats[k])))return false;
 }
 if(!unique(stationed)||stationed.some(id=>r.generals.some(g=>g.id===id))||x.captured.some((id:string)=>!x.cities[id])||Object.keys(x.cities).some(id=>!x.captured.includes(id)&&x.cities[id].owner!=='local'))return false;
 if(['admin','ready','complete'].includes(x.stage)&&(!x.active||!x.cities[x.active]))return false;
 if(x.stage==='complete'&&!x.world&&x.captured.length!==3)return false;
 if(x.activity&&(r.pending.kind!=='debate'||r.screen!=='node'))return false;
 return true;
}

