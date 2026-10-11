import {validPersonnel} from './personnel-validation.ts';
import {validRaising} from './raising-validation.ts';
import {CITY_DEFS} from '../data/cities.ts';
import {GENERALS} from '../data/generals.ts';
import {GROWTH} from './build.ts';
import {validDebateBuild} from './debate-deck-validation.ts';
import type {RunState} from './types.ts';
type O=Record<string,any>;
const obj=(x:unknown):x is O=>!!x&&typeof x==='object'&&!Array.isArray(x);
const int=(x:unknown,min=0,max=100000)=>Number.isInteger(x)&&typeof x==='number'&&x>=min&&x<=max;
const text=(x:unknown)=>typeof x==='string'&&x.length<=10000;
const ids=(x:unknown)=>Array.isArray(x)&&x.length<=12&&new Set(x).size===x.length&&x.every(id=>typeof id==='string'&&Object.hasOwn(GENERALS,id));
const city=(x:unknown)=>typeof x==='string'&&Object.hasOwn(CITY_DEFS,x);
export function validWorld(r:RunState):boolean {
 const c=r.campaign,w=c?.world;if(!c||!w)return true;const x=w as unknown as O;
 if(c.saveVersion!==7||c.scenarioId!=='henan-190'||!text(c.campaignId)||!obj(x)||!['setup','preparing','founding','strategy','operation','won','failed'].includes(x.stage)||!['map','city'].includes(x.view)||!int(x.turn)||!int(x.ap,0,3)||!city(x.startCity)||!['wanderer','castellan'].includes(x.startType)||!['chengong','zhangliao','guojia'].includes(x.founder)||!['people','law','strategy'].includes(x.doctrine)||!['credit','granary','network'].includes(x.perk)||!text(x.factionName)||x.factionName.length>24||typeof x.flagColor!=='string'||!/^#[0-9a-f]{6}$/i.test(x.flagColor)||!['core','league'].includes(x.goal)||!int(x.treasury)||!int(x.prestige)||!(x.capital===null||city(x.capital)))return false;
 if(!validRaising(r)||!validPersonnel(r))return false;
 const p=x.preparation;if(!obj(p)||!['step','ap','funds','food','troops','support','exposure','failed'].every(k=>int(p[k]))||p.step<1||p.step>5||p.ap>3||typeof p.base!=='boolean'||!Array.isArray(p.actions)||new Set(p.actions).size!==p.actions.length||!p.actions.every((id:string)=>['talent','credit','grain','recruit','support','base','conceal'].includes(id))||!Array.isArray(p.workers))return false;
 if(!(x.rising===null||['volunteers','officials','merchants'].includes(x.rising))||!ids(x.reserveOfficers)||x.reserveOfficers.some((id:string)=>!c.roster.includes(id)||r.generals.some(g=>g.id===id)||Object.values(c.cities).some(city=>Object.values(city!.roles).includes(id))))return false;
 if(!Array.isArray(x.candidates)||![6,8].includes(x.candidates.length)||new Set(x.candidates.map((p:O)=>p.id)).size!==x.candidates.length||!x.candidates.every((p:O)=>obj(p)&&Object.hasOwn(GENERALS,p.id)&&city(p.city)&&int(p.clue)&&typeof p.recruited==='boolean'))return false;
 if(!obj(x.owners)||!Object.keys(CITY_DEFS).every(id=>['player','rival','neutral'].includes(x.owners[id])&&(x.owners[id]==='player')===c.captured.includes(id as any))||!obj(x.management)||!Object.entries(x.management).every(([id,plan])=>c.captured.includes(id as any)&&['direct','life','military','production','issues','support','conserve'].includes(String(plan)))||Object.values(x.management).filter(p=>p==='direct').length>2)return false;
 const ai=x.rival;if(!obj(ai)||!text(ai.name)||!city(ai.core)||!['food','funds','troops','people','losses'].every(k=>int(ai[k]))||!Object.hasOwn(GENERALS,ai.officer)||!text(ai.plan)||!(ai.army===null||obj(ai.army)&&city(ai.army.origin)&&city(ai.army.target)&&['troops','food','arrival'].every(k=>int(ai.army[k]))))return false;
 if(!obj(x.neutral)||!text(x.neutral.name)||!int(x.neutral.food)||!int(x.neutral.trust,-100000)||!obj(x.diplomacy)||!['truceUntil','tradeUntil','obligation'].every(k=>int(x.diplomacy[k]))||typeof x.diplomacy.subordinate!=='boolean')return false;
 const op=x.operation;if(!int(x.operationSerial)||!(op===null||obj(op)&&int(op.id,1,x.operationSerial)&&city(op.origin)&&city(op.target)&&['conquest','recon'].includes(op.objective)&&Array.isArray(op.route)&&op.route.length>=2&&op.route.length<=8&&op.route.every((f:number,i:number)=>int(f,0,7)&&(i===0||f>op.route[i-1]))&&int(op.index,0,op.route.length)&&int(op.cost)&&typeof op.returned==='boolean'&&int(op.training,0,2)))return false;
 if(x.stage==='operation'&&!op||x.stage==='strategy'&&op||x.stage==='strategy'&&!c.captured.length||x.capital!==null&&!c.captured.includes(x.capital))return false;
 if(!obj(x.growth)||!Object.entries(x.growth).every(([id,g])=>Object.hasOwn(GENERALS,id)&&obj(g)&&['combat','debate','governance'].every(k=>int(g[k])))||!obj(x.discoveries)||!Object.entries(x.discoveries).every(([id,d])=>city(id)&&obj(d)&&int(d.turn)&&text(d.source)&&int(d.strength)))return false;
 if(!Array.isArray(x.history)||x.history.length>200||!x.history.every(text)||!Array.isArray(x.victory)||!x.victory.every(text)||!obj(x.stats)||!['risingStep','firstDeparture','conquests','recruits','starved','returns','aiAttacks','defenses'].every(k=>int(x.stats[k]))||!obj(x.stats.cityIncome)||!Object.entries(x.stats.cityIncome).every(([id,n])=>city(id)&&int(n)))return false;
 for(const id of c.captured){const v=c.cities[id]!;if(!int(v.funds,0,200)||!int(v.reserveTroops,0,200)||!int(v.training,0,2)||!int(v.settledTurn,0,x.turn)||typeof v.delegated!=='boolean'||v.hand.length>8)return false;}
 const deployed=[...r.generals.map(g=>g.id),...x.reserveOfficers,...Object.values(c.cities).flatMap(v=>Object.values(v!.roles).filter(Boolean))];if(new Set(deployed).size!==deployed.length||deployed.length!==c.roster.length||deployed.some(id=>!c.roster.includes(id)))return false;
 if(x.personalDebate!==undefined){if(!obj(x.personalDebate)||!Object.entries(x.personalDebate).every(([id,cards])=>c.roster.includes(id)&&Array.isArray(cards)&&cards.every(card=>obj(card)&&card.owner===id)&&validDebateBuild({...r.debateBuild,representative:id,cards})))return false;const uids=[...r.debateBuild.cards.map(card=>card.uid),...Object.values(x.personalDebate).flatMap((cards:any)=>cards.map((card:O)=>card.uid))];if(new Set(uids).size!==uids.length)return false;}
 if(x.officerBranches!==undefined&&(!obj(x.officerBranches)||!Object.entries(x.officerBranches).every(([id,g])=>c.roster.includes(id)&&!r.generals.some(v=>v.id===id)&&obj(g)&&Object.hasOwn(GROWTH,g.branch)&&int(g.level,1,2))))return false;
 if(['strategy','won'].includes(x.stage)&&(r.hp!==0||r.food!==0))return false;
 return true;
}
