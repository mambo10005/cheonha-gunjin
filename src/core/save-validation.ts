import {validDebateBuild,validDeckNegotiation,validDeckReward} from './debate-deck-validation.ts';
import {validGeography} from './geography.ts';
import {validCampaign} from './city-validation.ts';
import {validWorld} from './world-validation.ts';
import {defaultDebateBuild} from './debate-deck.ts';
import { CLAUSES } from './accords.ts';
import { ARGUMENTS, DEMANDS } from '../data/arguments.ts';
import { DOCTRINES, GROWTH, defaultBuild } from './build.ts';
import { TACTICS } from '../data/tactics.ts';
import { CARDS } from '../data/cards.ts';
import { GENERALS } from '../data/generals.ts';
import { ENCOUNTERS, ENEMIES } from '../data/enemies.ts';
import { LORDS } from '../data/lords.ts';
import { RELICS } from '../data/relics.ts';
import { EVENTS } from '../data/events.ts';
import { DEBATE_OPPONENTS, DUEL_OPPONENTS, SOCIAL_EVENTS } from '../data/social.ts';
import { defaultSocial } from './diplomacy.ts';
import type { RunState } from './types.ts';

type Obj = Record<string, unknown>;
const obj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => num(x) && Number.isInteger(x) && x >= min && x <= max;
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every(v => typeof v === 'string');
const known = (x: unknown, data: object): x is string => typeof x === 'string' && Object.hasOwn(data, x);
const enumOf = (x: unknown, values: string[]): boolean => typeof x === 'string' && values.includes(x);
const row = (x: unknown): boolean => x === 'front' || x === 'rear';
const cards = (x: unknown): boolean => Array.isArray(x) && x.every(c => obj(c) && integer(c.uid, 1) && known(c.id, CARDS));
const generals = (x: unknown): boolean => Array.isArray(x) && x.length <= 4 && x.every(g => obj(g) && known(g.id, GENERALS) && row(g.row)) && new Set(x.map(g => g.id)).size === x.length && ['front', 'rear'].every(r => x.filter(g => g.row === r).length <= 2);
const numbers = (x: unknown): boolean => obj(x) && Object.values(x).every(v => num(v) && v >= 0);
function intent(x: unknown): boolean {
  if (x === null) return true; if (!obj(x)) return false;
  switch (x.kind) {
    case 'attack': return (row(x.row) || x.row === 'both') && integer(x.dmg) && integer(x.hits, 1);
    case 'block': return integer(x.n);
    case 'buff': return integer(x.str) && (x.block === undefined || integer(x.block)) && (x.allies === undefined || typeof x.allies === 'boolean');
    case 'cleanse': return integer(x.block);
    case 'summon': return known(x.defId, ENEMIES) && integer(x.fallbackBlock);
    default: return false;
  }
}
const traits = ['parry', 'surge', 'composure', 'insight', 'mediator', 'quartermaster', 'envoy'];
function context(x: unknown): boolean {
  return obj(x) && (x.kind === 'supply' || x.kind === 'recruit' && known(x.candidate, GENERALS) || x.kind === 'agreement' && known(x.clause, CLAUSES) && enumOf(x.faction, ['caravan', 'militia', 'villages']) && CLAUSES[x.clause as keyof typeof CLAUSES].faction === x.faction || x.kind === 'diplomacy' && enumOf(x.faction, ['caravan', 'militia', 'villages']) && enumOf(x.trade, ['supply', 'passage', 'support']));
}
export function activity(x: unknown, kind: 'duel' | 'debate'): boolean {
  if(obj(x)&&x.dialogueLog!==undefined&&(!Array.isArray(x.dialogueLog)||x.dialogueLog.length>10||!x.dialogueLog.every(l=>obj(l)&&typeof l.source==='string'&&(l.source===x.generalId||l.source===x.opponentId)&&integer(l.round,0,4)&&typeof l.text==='string'&&l.text.length<=500)))return false;
  if(kind==='debate'&&obj(x)&&x.deck!==undefined)return known(x.generalId,GENERALS)&&known(x.opponentId,DEBATE_OPPONENTS)&&integer(x.rng,-2147483648,4294967295)&&strings(x.log)&&integer(x.agreement)&&integer(x.aptitude,1,3)&&strings(x.traits)&&context(x.context)&&validDeckNegotiation(x);
  if (!obj(x) || !known(x.generalId, GENERALS) || !integer(x.rng, -2147483648, 4294967295) || !integer(x.round, 0, 4) || x.maxRounds !== 4 || !strings(x.log) || !integer(x.aptitude, 1, 3) || !strings(x.traits) || !x.traits.every(t => traits.includes(t))) return false;
  if (kind === 'duel' && x.build !== undefined && (!runtime(x.build) || !strings(x.tactics) || x.tactics.length > 2 || new Set(x.tactics).size !== x.tactics.length || !x.tactics.every(t => known(t, TACTICS)) || !strings(x.usedTactics) || !x.usedTactics.every(t => (x.tactics as string[]).includes(t)) || new Set(x.usedTactics).size !== x.usedTactics.length || !integer(x.protection) || !integer(x.enemyShield))) return false;
  if (kind === 'duel' && x.rewardClaimed !== undefined && (typeof x.rewardClaimed !== 'boolean' || x.rewardClaimed && x.result !== 'win')) return false;
  if (kind === 'duel') return known(x.opponentId, DUEL_OPPONENTS) && integer(x.hp) && integer(x.maxHp, 1) && x.hp <= x.maxHp && integer(x.enemyHp) && integer(x.enemyMaxHp, 1) && x.enemyHp <= x.enemyMaxHp && integer(x.momentum, 0, 5) && strings(x.pattern) && x.pattern.length === 4 && x.pattern.every(a => enumOf(a, ['strike', 'probe', 'guard', 'finisher'])) && integer(x.patternOffset, 0, 3) && (x.lastAction === null || enumOf(x.lastAction, ['strike', 'probe', 'guard', 'finisher'])) && enumOf(x.result, ['ongoing', 'win', 'lose', 'draw', 'surrender']) && (x.result !== 'ongoing' || x.round < 4 && x.hp > 0 && x.enemyHp > 0);
  if (x.negotiation !== undefined) {
    if (!negotiation(x.negotiation) || !known(x.opponentId,DEMANDS)) return false;
    const n=x.negotiation as Obj, d=DEMANDS[x.opponentId as keyof typeof DEMANDS], counter=n.counter as Obj;
    const expected:Record<string,number>={...d.needs}; if(counter.applied) expected[counter.axis as string]=(expected[counter.axis as string] ?? 0)+1;
    if (n.trustNeeded!==d.trust || n.burdenLimit!==d.burden || !d.counters.includes(counter.axis as never) || counter.applied !== ((x.round as number)>=2) || n.burden !== (n.paid as number)/2 + (n.promise?2:0) || (n.paid as number)%2!==0 || JSON.stringify(Object.entries(n.needs as Obj).sort())!==JSON.stringify(Object.entries(expected).sort())) return false;
  }
  return known(x.opponentId, DEBATE_OPPONENTS) && integer(x.resolve) && integer(x.agreement) && integer(x.trust) && strings(x.concerns) && x.concerns.length === 4 && x.concerns.every(c => enumOf(c, ['profit', 'honor', 'trust', 'safety'])) && strings(x.revealed) && x.revealed.every((c, i) => c === (x.concerns as string[])[i]) && (x.lastAction === null || enumOf(x.lastAction, ['evidence', 'rebuttal', 'concede', 'proposal'])) && enumOf(x.result, ['ongoing', 'success', 'partial', 'failure']) && (x.result !== 'ongoing' || x.round < 4) && context(x.context);
}
function pending(x: unknown, depth = 0): boolean {
  if (!obj(x) || depth > 5) return false;
  const cardIds = (a: unknown) => strings(a) && a.every(id => known(id, CARDS));
  const grade = (a: unknown) => a === undefined || enumOf(a, ['success', 'partial', 'failure']);
  switch (x.kind) {
    case 'debateReward': return validDeckReward(x.reward)&&pending(x.then,depth+1);
    case 'growth': return (x.general === undefined || known(x.general, GENERALS)) && typeof x.token === 'string' && pending(x.then, depth + 1);
    case 'none': case 'rest': case 'supply': return true;
    case 'event': return known(x.eventId, EVENTS) && (x.resultText === undefined || typeof x.resultText === 'string');
    case 'reward': return integer(x.food) && cardIds(x.cards) && typeof x.picked === 'boolean' && (x.extra === undefined || obj(x.extra) && x.extra.type === 'relic' && strings(x.extra.options) && x.extra.options.every(id => known(id, RELICS)) && typeof x.extra.picked === 'boolean');
    case 'recruit': return strings(x.options) && x.options.every(id => known(id, GENERALS));
    case 'replaceGeneral': return known(x.incoming, GENERALS) && pending(x.then, depth + 1);
    case 'deckPick': return enumOf(x.mode, ['remove', 'duplicate']) && integer(x.cost) && pending(x.then, depth + 1);
    case 'market': return Array.isArray(x.cards) && x.cards.every(c => obj(c) && known(c.id, CARDS) && integer(c.price) && typeof c.sold === 'boolean') && (x.relic === null || obj(x.relic) && known(x.relic.id, RELICS) && integer(x.relic.price) && typeof x.relic.sold === 'boolean') && integer(x.removePrice) && typeof x.removed === 'boolean';
    case 'duelOffer': return known(x.opponentId, DUEL_OPPONENTS);
    case 'duel': case 'debate': return activity(x.state, x.kind);
    case 'parley': return (x.mode === 'supply' || x.mode === 'recruit' && known(x.candidate, GENERALS)) && grade(x.negotiated) && (x.terms === undefined || terms(x.terms));
    case 'council': return enumOf(x.faction, ['caravan','militia','villages']) && (x.negotiated === undefined || obj(x.negotiated) && known(x.negotiated.clause,CLAUSES) && CLAUSES[x.negotiated.clause as keyof typeof CLAUSES].faction === x.faction && enumOf(x.negotiated.result,['success','partial','failure']) && terms(x.negotiated.terms));
    case 'diplomacy': return enumOf(x.faction, ['caravan', 'militia', 'villages']) && (x.negotiated === undefined || obj(x.negotiated) && enumOf(x.negotiated.trade, ['supply', 'passage', 'support']) && grade(x.negotiated.result) && x.negotiated.result !== undefined);
    case 'socialResult': return typeof x.text === 'string';
    default: return false;
  }
}
function battle(b: unknown): boolean {
  if (b === null) return true;
  if (obj(b) && b.build !== undefined && !runtime(b.build)) return false;
  if (!obj(b) || !integer(b.rng, -2147483648, 4294967295) || !integer(b.turn, 1) || !integer(b.hp) || !integer(b.maxHp, 1) || !integer(b.food) || !integer(b.energy) || !integer(b.baseEnergy) || !integer(b.momentum) || !generals(b.generals) || !strings(b.relics) || !b.relics.every(id => known(id, RELICS)) || !known(b.lordId, LORDS) || !known(b.encounterId, ENCOUNTERS) || !enumOf(b.terrain, ['plains', 'mountain', 'river', 'fortress']) || !enumOf(b.result, ['ongoing', 'win', 'lose']) || ![0, 1].includes(b.difficulty as number) || typeof b.shakenRear !== 'boolean' || !integer(b.nextEnemyUid, 1) || !integer(b.budget, -1000000) || !cards(b.hand) || !cards(b.draw) || !cards(b.discard) || !cards(b.exhausted)) return false;
  if (![b.block, b.counter].every(x => obj(x) && integer(x.front) && integer(x.rear)) || !obj(b.stats) || !numbers(b.stats.damageTaken) || !numbers(b.stats.rowTaken) || !integer(b.stats.damageDealt) || !integer(b.stats.cardsPlayed)) return false;
  if (!Array.isArray(b.log) || !b.log.every(l => obj(l) && integer(l.turn) && typeof l.text === 'string' && enumOf(l.kind, ['info', 'player', 'enemy', 'general', 'damage', 'warn']))) return false;
  if (!obj(b.flags) || !['firstMuUsed', 'firstChaekDiscountUsed', 'freeSwapUsed', 'sunQuanUsed', 'drumUsed', 'guojiaUsed'].every(k => typeof (b.flags as Obj)[k] === 'boolean') || !integer(b.flags.zhangliaoUses) || !integer(b.flags.chengongBonus) || !strings(b.flags.familiesPlayed) || !b.flags.familiesPlayed.every(f => enumOf(f, ['mu', 'bang', 'chaek']))) return false;
  return Array.isArray(b.enemies) && b.enemies.every(e => obj(e) && known(e.defId, ENEMIES) && integer(e.uid, 1) && typeof e.name === 'string' && integer(e.hp) && integer(e.maxHp, 1) && integer(e.block) && integer(e.str) && integer(e.burn) && ['dead', 'confused', 'turncoat'].every(k => typeof e[k] === 'boolean') && integer(e.patternIdx) && [1, 2].includes(e.phase as number) && intent(e.intent));
}
function social(x: unknown): boolean {
  return obj(x) && enumOf(x.protocol,['legacy','clauses']) && accords(x.accords) && obj(x.relations) && ['caravan', 'militia', 'villages'].every(k => integer((x.relations as Obj)[k], -1, 2)) && strings(x.used) && integer(x.duels, 0, 2) && (x.passage === null || obj(x.passage) && integer(x.passage.moves, 1, 4) && x.passage.discount === 1) && (x.support === null || obj(x.support) && integer(x.support.block) && integer(x.support.damage) && integer(x.support.rewardPenalty, 0, 1));
}
export function validateAndMigrateRun(data: unknown, version: number): RunState | null {
  if (!obj(data) || data.version !== version || ![1, 2, 3, 4, 5, 6].includes(version)) return null;
  const d = structuredClone(data);
  if (version === 1) { d.version = 3; d.social = defaultSocial(); }
  if (version < 3) { d.version = 3; d.build = defaultBuild(); }
  if (version < 4) { if (!obj(d.social)) return null; d.social.protocol = 'legacy'; d.social.accords = {nextUid:1,agreements:[]}; }
  if(version<5)d.debateBuild=defaultDebateBuild();
  d.version = 6;
  if(!validDebateBuild(d.debateBuild))return null;
  if (!build(d.build, d.generals)) return null;
  if (!integer(d.seed, 0)) return null;
  if (!integer(d.rng, -2147483648, 4294967295) || !known(d.lordId, LORDS) || ![0, 1].includes(d.difficulty as number) || !strings(d.unlocked) || !d.unlocked.every(g => known(g, GENERALS)) || !integer(d.hp) || !integer(d.maxHp, 1) || !integer(d.food) || !integer(d.nextUid, 1) || !cards(d.deck) || !generals(d.generals) || !strings(d.relics) || !d.relics.every(r => known(r, RELICS)) || !strings(d.history) || !strings(d.lastBattleSummary) || !strings(d.defeatReason) || !obj(d.flags) || typeof d.flags.allyBlessing !== 'boolean' || !integer(d.flags.rewardPenalty) || !social(d.social) || !pending(d.pending) || !battle(d.battle)) return null;
  if (!Array.isArray(d.map) || d.map.length !== 8 || !d.map.every((r, f) => Array.isArray(r) && r.length === (f === 7 ? 1 : 3) && r.every((n, c) => obj(n) && n.floor === f && n.col === c && enumOf(n.type, ['battle', 'elite', 'recruit', 'market', 'rest', 'supply', 'event', 'boss']) && enumOf(n.terrain, ['plains', 'mountain', 'river', 'fortress']) && Array.isArray(n.next) && n.next.every(i => integer(i, 0, f === 6 ? 0 : 2)) && (n.type !== 'event' || known(n.eventId, EVENTS) || known(n.eventId, SOCIAL_EVENTS)) && (!['battle', 'elite', 'boss'].includes(n.type as string) || known(n.encounterId, ENCOUNTERS))))) return null;
  if (!integer(d.floor, -1, 7) || !integer(d.col, -1, 2) || d.floor === -1 && d.col !== -1 || d.floor >= 0 && !(d.map[d.floor] as unknown[])[d.col]) return null;
  if (d.mapTrail !== undefined) {
    if (!Array.isArray(d.mapTrail) || d.mapTrail.length > 8 || !d.mapTrail.every((p,i,trail) => obj(p) && integer(p.floor,0,d.floor as number) && integer(p.col,0,2) && !!(d.map as Obj[][])[p.floor as number]?.[p.col as number] && (i===0 || obj(trail[i-1]) && p.floor === (trail[i-1].floor as number)+1 && ((d.map as Obj[][])[trail[i-1].floor as number][trail[i-1].col as number].next as number[]).includes(p.col as number)))) return null;
    const last=d.mapTrail.at(-1); if (last && (!obj(last) || last.floor!==d.floor || last.col!==d.col)) return null;
  }
  if (!enumOf(d.screen, ['map', 'node', 'battle', 'victory', 'defeat']) || (d.screen === 'battle') !== (d.battle !== null) || d.screen === 'battle' && d.floor < 0 || d.screen !== 'node' && (d.pending as Obj).kind !== 'none' && version !== 1) return null;
  if ((d.pending as Obj).kind === 'duel' || (d.pending as Obj).kind === 'debate') {
    const state = (d.pending as Obj).state as Obj;
    if (!(d.generals as Obj[]).some(g => g.id === state.generalId) || d.screen !== 'node') return null;
  }
  if (!accordCoordinates(d as unknown as RunState)) return null;
  if ((d.pending as Obj).kind === 'debate') { const n = ((d.pending as Obj).state as Obj).negotiation; if (obj(n) && n.food !== d.food) return null; }
  if (['duel', 'duelOffer'].includes((d.pending as Obj).kind as string)) {
    if (d.floor < 0 || d.screen !== 'node') return null;
    const node = (d.map[d.floor] as Obj[])[d.col];
    if (!['battle', 'elite'].includes(node.type as string) || !known(node.encounterId, ENCOUNTERS)) return null;
  }
  if(!validGeography(d as unknown as RunState))return null;
  if(!validCampaign(d as unknown as RunState))return null;
  if(!validWorld(d as unknown as RunState))return null;
  return d as unknown as RunState;
}

function build(x: unknown, army: unknown): boolean {
  return obj(x) && strings(x.doctrines) && x.doctrines.length <= 2 && new Set(x.doctrines).size === x.doctrines.length && x.doctrines.every(id => known(id, DOCTRINES)) && strings(x.claimed) && new Set(x.claimed).size === x.claimed.length && obj(x.growth) && Array.isArray(army) && Object.entries(x.growth).every(([id, value]) => known(id, GENERALS) && army.some(g => obj(g) && g.id === id) && obj(value) && known(value.branch, GROWTH) && integer(value.level, 1, 2));
}
function runtime(x: unknown): boolean {
  return obj(x) && obj(x.tokens) && ['riposte','charge','insight'].every(t => integer((x.tokens as Obj)[t], 0, 2)) && obj(x.uses) && Object.values(x.uses).every(n => integer(n, 0, 2)) && integer(x.epoch) && Array.isArray(x.sources) && x.sources.length <= 6 && x.sources.every(s => obj(s) && (known(s.id, DOCTRINES) || known(s.id, GROWTH)) && integer(s.level, 1, 2) && typeof s.label === 'string' && (s.owner === undefined || known(s.owner, GENERALS)));
}

const axes = ['profit','safety','honor','authority'];
function terms(x: unknown): boolean { return obj(x) && (x.deck===undefined||typeof x.deck==='boolean') && integer(x.penalty,0,1) && integer(x.paid,0,8) && typeof x.description === 'string'; }
function negotiation(x: unknown): boolean {
 return obj(x) && obj(x.scores) && axes.every(a => integer((x.scores as Obj)[a],0,20)) && obj(x.needs) && Object.entries(x.needs).every(([a,v]) => axes.includes(a) && integer(v,0,10)) && integer(x.trustNeeded,1,5) && integer(x.burden,0,5) && integer(x.burdenLimit,1,3) && integer(x.food) && integer(x.paid,0,8) && integer(x.reports,0,2) && integer(x.credentials,0,2) && typeof x.concessionReady === 'boolean' && typeof x.promise === 'boolean' && obj(x.counter) && enumOf(x.counter.axis,axes) && x.counter.amount === 1 && typeof x.counter.applied === 'boolean' && (x.lastArgument === null || known(x.lastArgument,ARGUMENTS));
}
function coordinate(x: unknown): boolean { return obj(x) && integer(x.floor,0,7) && integer(x.col,0,2); }
function accords(x: unknown): boolean {
 if (!obj(x) || !integer(x.nextUid,1) || !Array.isArray(x.agreements) || x.agreements.length > 8) return false;
 const seen = new Set(), clauses = new Set(); let active = 0;
 return x.agreements.every(a => {
  if (!obj(a) || !integer(a.uid,1) || a.uid >= (x.nextUid as number) || seen.has(a.uid) || !known(a.clause,CLAUSES) || CLAUSES[a.clause as keyof typeof CLAUSES].faction !== a.faction || !coordinate(a.target) || !(a.supply === null || coordinate(a.supply)) || !(a.beneficiary === null || known(a.beneficiary,GENERALS)) || !enumOf(a.stage,['waiting','armed']) || !enumOf(a.status,['active','fulfilled','broken','expired']) || ![0,2].includes(a.deposit as number) || typeof a.boosted !== 'boolean' || !integer(a.createdFloor,0,6)) return false;
  seen.add(a.uid);
  if (a.status === 'active') { if (++active > 2 || clauses.has(a.clause)) return false; clauses.add(a.clause); }
  return (a.clause === 'escort') === (a.supply !== null) && (a.clause === 'operation') === (a.beneficiary !== null) && (a.stage !== 'armed' || a.clause === 'escort');
 });
}
function accordCoordinates(run: RunState): boolean {
 return run.social.accords.agreements.every(a => {
  const target=run.map[a.target.floor]?.[a.target.col], supply=a.supply && run.map[a.supply.floor]?.[a.supply.col];
  if (!target || a.target.floor <= a.createdFloor || !['battle','elite','boss'].includes(target.type) || a.clause === 'operation' && target.type !== 'elite' || a.clause === 'sponsorship' && target.type === 'boss') return false;
  if (a.supply && (!supply || supply.type !== 'supply' || a.supply.floor <= a.createdFloor || a.supply.floor >= a.target.floor)) return false;
  if (a.status === 'active' && (a.target.floor < run.floor || a.beneficiary && !run.generals.some(g=>g.id === a.beneficiary))) return false;
  return true;
 });
}
